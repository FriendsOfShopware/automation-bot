import { Octokit } from '@octokit/core';
import { eq, and, sql, inArray, count, desc } from 'drizzle-orm';
import { getDb, githubIssues, githubSyncStatus } from '../db';
import type { GitHubIssueFromAPI, GitHubRepository, RepoSyncMessage } from './types';

const ORG_NAME = 'FriendsOfShopware';

// Queue all repositories for sync - used by scheduled handler
export async function enqueueAllRepos(octo: Octokit, queue: Queue<RepoSyncMessage>): Promise<{ queued: number }> {
	const repos = await fetchAllRepositories(octo);
	const activeRepos = repos.filter(repo => !repo.archived && !repo.disabled);

	// Send repos in batches to the queue (max 100 messages per batch)
	const batchSize = 100;
	for (let i = 0; i < activeRepos.length; i += batchSize) {
		const batch = activeRepos.slice(i, i + batchSize);
		await queue.sendBatch(batch.map(repo => ({
			body: { repo },
		})));
	}

	console.log(`Queued ${activeRepos.length} repositories for sync`);
	return { queued: activeRepos.length };
}

// Sync a single repository - used by queue consumer
export async function syncSingleRepository(octo: Octokit, d1: D1Database, repo: GitHubRepository): Promise<{ synced: number }> {
	const db = getDb(d1);

	try {
		const synced = await syncRepositoryIssues(octo, d1, repo);

		await db.insert(githubSyncStatus)
			.values({
				repositoryFullName: repo.full_name,
				lastSyncedAt: new Date().toISOString(),
				issuesCount: synced,
				openIssuesCount: repo.open_issues_count,
				error: null,
			})
			.onConflictDoUpdate({
				target: githubSyncStatus.repositoryFullName,
				set: {
					lastSyncedAt: new Date().toISOString(),
					issuesCount: synced,
					openIssuesCount: repo.open_issues_count,
					error: null,
				},
			});

		console.log(`Synced ${synced} issues from ${repo.full_name}`);
		return { synced };
	} catch (error) {
		const errorMsg = error instanceof Error ? error.message : String(error);

		await db.insert(githubSyncStatus)
			.values({
				repositoryFullName: repo.full_name,
				lastSyncedAt: new Date().toISOString(),
				issuesCount: 0,
				openIssuesCount: 0,
				error: errorMsg,
			})
			.onConflictDoUpdate({
				target: githubSyncStatus.repositoryFullName,
				set: {
					lastSyncedAt: new Date().toISOString(),
					error: errorMsg,
				},
			});

		console.error(`Failed to sync ${repo.full_name}: ${errorMsg}`);
		throw error;
	}
}

async function fetchAllRepositories(octo: Octokit): Promise<GitHubRepository[]> {
	const repos: GitHubRepository[] = [];
	let page = 1;

	while (true) {
		const response = await octo.request('GET /orgs/{org}/repos', {
			org: ORG_NAME,
			type: 'all',
			per_page: 100,
			page,
		});

		if (response.data.length === 0) {
			break;
		}

		for (const repo of response.data) {
			repos.push({
				id: repo.id,
				name: repo.name,
				full_name: repo.full_name,
				owner: { login: repo.owner.login },
				open_issues_count: repo.open_issues_count ?? 0,
				archived: repo.archived ?? false,
				disabled: repo.disabled ?? false,
			});
		}

		if (response.data.length < 100) {
			break;
		}
		page++;
	}

	return repos;
}

async function syncRepositoryIssues(octo: Octokit, d1: D1Database, repo: GitHubRepository): Promise<number> {
	const db = getDb(d1);
	const issues = await fetchAllOpenIssues(octo, repo.owner.login, repo.name);

	// Get existing issue IDs for this repo to handle deletions
	const existingIssues = await db.select({ id: githubIssues.id })
		.from(githubIssues)
		.where(and(
			eq(githubIssues.repositoryFullName, repo.full_name),
			eq(githubIssues.state, 'open')
		));

	const existingIds = new Set(existingIssues.map(r => r.id));
	const fetchedIds = new Set(issues.map(i => i.id));

	// Mark issues that are no longer open as closed
	const toClose = [...existingIds].filter(id => !fetchedIds.has(id));
	if (toClose.length > 0) {
		await db.update(githubIssues)
			.set({
				state: 'closed',
				syncedAt: new Date().toISOString(),
			})
			.where(inArray(githubIssues.id, toClose));
	}

	// Upsert all fetched issues
	for (const issue of issues) {
		await upsertIssue(d1, issue, repo);
	}

	return issues.length;
}

async function fetchAllOpenIssues(octo: Octokit, owner: string, repo: string): Promise<GitHubIssueFromAPI[]> {
	const issues: GitHubIssueFromAPI[] = [];
	let page = 1;

	while (true) {
		const response = await octo.request('GET /repos/{owner}/{repo}/issues', {
			owner,
			repo,
			state: 'open',
			per_page: 100,
			page,
		});

		if (response.data.length === 0) {
			break;
		}

		for (const issue of response.data) {
			issues.push(issue as GitHubIssueFromAPI);
		}

		if (response.data.length < 100) {
			break;
		}
		page++;
	}

	return issues;
}

export async function upsertIssue(d1: D1Database, issue: GitHubIssueFromAPI, repo: GitHubRepository): Promise<void> {
	const db = getDb(d1);
	const labels = issue.labels.map(l => l.name);
	const assignees = issue.assignees.map(a => a.login);

	await db.insert(githubIssues)
		.values({
			id: issue.id,
			nodeId: issue.node_id,
			number: issue.number,
			title: issue.title,
			body: issue.body,
			state: issue.state,
			stateReason: issue.state_reason ?? null,
			locked: issue.locked,
			commentsCount: issue.comments,
			createdAt: issue.created_at,
			updatedAt: issue.updated_at,
			closedAt: issue.closed_at,
			authorLogin: issue.user?.login ?? null,
			authorAvatarUrl: issue.user?.avatar_url ?? null,
			authorAssociation: issue.author_association,
			repositoryId: repo.id,
			repositoryOwner: repo.owner.login,
			repositoryName: repo.name,
			repositoryFullName: repo.full_name,
			labels: JSON.stringify(labels),
			assignees: JSON.stringify(assignees),
			milestoneId: issue.milestone?.id ?? null,
			milestoneTitle: issue.milestone?.title ?? null,
			isPullRequest: issue.pull_request !== undefined,
			htmlUrl: issue.html_url,
			reactionsTotal: issue.reactions?.total_count ?? 0,
			syncedAt: new Date().toISOString(),
		})
		.onConflictDoUpdate({
			target: githubIssues.nodeId,
			set: {
				title: issue.title,
				body: issue.body,
				state: issue.state,
				stateReason: issue.state_reason ?? null,
				locked: issue.locked,
				commentsCount: issue.comments,
				updatedAt: issue.updated_at,
				closedAt: issue.closed_at,
				labels: JSON.stringify(labels),
				assignees: JSON.stringify(assignees),
				milestoneId: issue.milestone?.id ?? null,
				milestoneTitle: issue.milestone?.title ?? null,
				htmlUrl: issue.html_url,
				reactionsTotal: issue.reactions?.total_count ?? 0,
				syncedAt: new Date().toISOString(),
			},
		});
}

export async function deleteIssue(d1: D1Database, issueId: number): Promise<void> {
	const db = getDb(d1);
	await db.delete(githubIssues).where(eq(githubIssues.id, issueId));
}

export async function getIssueStats(d1: D1Database): Promise<{
	total: number;
	open: number;
	closed: number;
	byRepo: Array<{ repo: string; open: number; closed: number }>;
}> {
	const db = getDb(d1);

	const [totalResult] = await db.select({ count: count() }).from(githubIssues);
	const [openResult] = await db.select({ count: count() }).from(githubIssues).where(eq(githubIssues.state, 'open'));
	const [closedResult] = await db.select({ count: count() }).from(githubIssues).where(eq(githubIssues.state, 'closed'));

	const byRepoResult = await db.select({
		repo: githubIssues.repositoryFullName,
		open: sql<number>`SUM(CASE WHEN ${githubIssues.state} = 'open' THEN 1 ELSE 0 END)`,
		closed: sql<number>`SUM(CASE WHEN ${githubIssues.state} = 'closed' THEN 1 ELSE 0 END)`,
	})
		.from(githubIssues)
		.groupBy(githubIssues.repositoryFullName)
		.orderBy(desc(sql`open`));

	return {
		total: totalResult?.count ?? 0,
		open: openResult?.count ?? 0,
		closed: closedResult?.count ?? 0,
		byRepo: byRepoResult,
	};
}

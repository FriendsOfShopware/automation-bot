import { Octokit } from '@octokit/core';
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
export async function syncSingleRepository(octo: Octokit, db: D1Database, repo: GitHubRepository): Promise<{ synced: number }> {
	try {
		const synced = await syncRepositoryIssues(octo, db, repo);

		await db.prepare(`
			INSERT INTO github_sync_status (repository_full_name, last_synced_at, issues_count, open_issues_count, error)
			VALUES (?, datetime('now'), ?, ?, NULL)
			ON CONFLICT(repository_full_name) DO UPDATE SET
				last_synced_at = datetime('now'),
				issues_count = excluded.issues_count,
				open_issues_count = excluded.open_issues_count,
				error = NULL
		`).bind(repo.full_name, synced, repo.open_issues_count).run();

		console.log(`Synced ${synced} issues from ${repo.full_name}`);
		return { synced };
	} catch (error) {
		const errorMsg = error instanceof Error ? error.message : String(error);

		await db.prepare(`
			INSERT INTO github_sync_status (repository_full_name, last_synced_at, issues_count, open_issues_count, error)
			VALUES (?, datetime('now'), 0, 0, ?)
			ON CONFLICT(repository_full_name) DO UPDATE SET
				last_synced_at = datetime('now'),
				error = excluded.error
		`).bind(repo.full_name, errorMsg).run();

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

async function syncRepositoryIssues(octo: Octokit, db: D1Database, repo: GitHubRepository): Promise<number> {
	const issues = await fetchAllOpenIssues(octo, repo.owner.login, repo.name);

	// Get existing issue IDs for this repo to handle deletions
	const existingResult = await db.prepare(`
		SELECT id FROM github_issues WHERE repository_full_name = ? AND state = 'open'
	`).bind(repo.full_name).all<{ id: number }>();

	const existingIds = new Set(existingResult.results?.map(r => r.id) ?? []);
	const fetchedIds = new Set(issues.map(i => i.id));

	// Mark issues that are no longer open as closed
	const toClose = [...existingIds].filter(id => !fetchedIds.has(id));
	if (toClose.length > 0) {
		const placeholders = toClose.map(() => '?').join(',');
		await db.prepare(`
			UPDATE github_issues SET state = 'closed', synced_at = datetime('now') WHERE id IN (${placeholders})
		`).bind(...toClose).run();
	}

	// Upsert all fetched issues
	for (const issue of issues) {
		await upsertIssue(db, issue, repo);
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

export async function upsertIssue(db: D1Database, issue: GitHubIssueFromAPI, repo: GitHubRepository): Promise<void> {
	const labels = issue.labels.map(l => l.name);
	const assignees = issue.assignees.map(a => a.login);
	const isPullRequest = issue.pull_request !== undefined ? 1 : 0;

	await db.prepare(`
		INSERT INTO github_issues (
			id, node_id, number, title, body, state, state_reason, locked, comments_count,
			created_at, updated_at, closed_at, author_login, author_avatar_url, author_association,
			repository_id, repository_owner, repository_name, repository_full_name,
			labels, assignees, milestone_id, milestone_title, is_pull_request, html_url,
			reactions_total, synced_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
		ON CONFLICT(node_id) DO UPDATE SET
			title = excluded.title,
			body = excluded.body,
			state = excluded.state,
			state_reason = excluded.state_reason,
			locked = excluded.locked,
			comments_count = excluded.comments_count,
			updated_at = excluded.updated_at,
			closed_at = excluded.closed_at,
			labels = excluded.labels,
			assignees = excluded.assignees,
			milestone_id = excluded.milestone_id,
			milestone_title = excluded.milestone_title,
			html_url = excluded.html_url,
			reactions_total = excluded.reactions_total,
			synced_at = datetime('now')
	`).bind(
		issue.id,
		issue.node_id,
		issue.number,
		issue.title,
		issue.body,
		issue.state,
		issue.state_reason ?? null,
		issue.locked ? 1 : 0,
		issue.comments,
		issue.created_at,
		issue.updated_at,
		issue.closed_at,
		issue.user?.login ?? null,
		issue.user?.avatar_url ?? null,
		issue.author_association,
		repo.id,
		repo.owner.login,
		repo.name,
		repo.full_name,
		JSON.stringify(labels),
		JSON.stringify(assignees),
		issue.milestone?.id ?? null,
		issue.milestone?.title ?? null,
		isPullRequest,
		issue.html_url,
		issue.reactions?.total_count ?? 0
	).run();
}

export async function deleteIssue(db: D1Database, issueId: number): Promise<void> {
	await db.prepare(`DELETE FROM github_issues WHERE id = ?`).bind(issueId).run();
}

export async function getIssueStats(db: D1Database): Promise<{
	total: number;
	open: number;
	closed: number;
	byRepo: Array<{ repo: string; open: number; closed: number }>;
}> {
	const totalResult = await db.prepare(`SELECT COUNT(*) as count FROM github_issues`).first<{ count: number }>();
	const openResult = await db.prepare(`SELECT COUNT(*) as count FROM github_issues WHERE state = 'open'`).first<{ count: number }>();
	const closedResult = await db.prepare(`SELECT COUNT(*) as count FROM github_issues WHERE state = 'closed'`).first<{ count: number }>();

	const byRepoResult = await db.prepare(`
		SELECT repository_full_name as repo,
			SUM(CASE WHEN state = 'open' THEN 1 ELSE 0 END) as open,
			SUM(CASE WHEN state = 'closed' THEN 1 ELSE 0 END) as closed
		FROM github_issues
		GROUP BY repository_full_name
		ORDER BY open DESC
	`).all<{ repo: string; open: number; closed: number }>();

	return {
		total: totalResult?.count ?? 0,
		open: openResult?.count ?? 0,
		closed: closedResult?.count ?? 0,
		byRepo: byRepoResult.results ?? [],
	};
}

import { Hono } from "hono/tiny";
import { Webhooks } from "@octokit/webhooks";
import { getOctoClient } from "../github";
import { commandRegistry } from "../commands";
import { upsertIssue, deleteIssue } from "../issues/sync";
import type { GitHubIssueFromAPI, GitHubRepository } from "../issues/types";

// See https://docs.github.com/en/graphql/reference/enums#commentauthorassociation
const DEFAULT_ALLOWED_COMMENTER_ASSOCIATIONS = new Set([
	'COLLABORATOR', // Author has been invited to collaborate on the repository.
	'OWNER', // Author is the owner of the repository.
	'MEMBER', // Author is a member of the organization that owns the repository.
]);

const webhook = new Hono<{ Bindings: Env }>();

webhook.post('/', async c => {
	const webhooks = new Webhooks({
		secret: c.env.GITHUB_WEBHOOK_SECRET,
	})

	webhooks.on('issue_comment.created', async ({ payload }) => {
		if (payload.comment.user?.type === 'Bot' || payload.issue.pull_request === undefined) {
			return
		}

		if (!DEFAULT_ALLOWED_COMMENTER_ASSOCIATIONS.has(payload.comment.author_association)) {
			return
		}

		const text = payload.comment.body.trim()

		if (!text.startsWith('@frosh-automation') && !text.startsWith('@frosh-ci')) {
			return
		}

		const parts = text.split(' ')
		const commandName = parts[1]
		const args = parts.slice(2)

		const command = commandRegistry.get(commandName)

		if (!command) {
			return
		}

		const octo = getOctoClient(c.env)

		await octo.request('POST /repos/{owner}/{repo}/issues/comments/{comment_id}/reactions', {
			owner: payload.repository.owner.login,
			repo: payload.repository.name,
			comment_id: payload.comment.id,
			content: '+1',
		});

		const pr = await octo.request('GET /repos/{owner}/{repo}/pulls/{pull_number}', {
			owner: payload.repository.owner.login,
			repo: payload.repository.name,
			pull_number: payload.issue.number,
		});

		const workflows = await octo.request('GET /repos/{owner}/{repo}/actions/workflows', {
			owner: 'FriendsOfShopware',
			repo: 'automation-bot',
		});

		const workflowId = workflows.data.workflows.find(w => w.path === command.workflowPath)?.id

		if (!workflowId) {
			console.log('Workflow not found')
			return
		}

		const uuid = crypto.randomUUID()

		// Store in KV for token exchange (short-term)
		await c.env.kv.put(uuid, JSON.stringify({
			repository_id: pr.data.base.repo!!.id,
		}), { expirationTtl: 10 * 60 })

		// Store full execution context in D1
		await c.env.db.prepare(`
			INSERT INTO executions (id, command, status, repository_id, head_owner, head_repo, head_branch, head_sha, base_owner, base_repo, pr_number, args)
			VALUES (?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?)
		`).bind(
			uuid,
			commandName,
			pr.data.base.repo!!.id,
			pr.data.head.repo!!.owner.login,
			pr.data.head.repo!!.name,
			pr.data.head.ref,
			pr.data.head.sha,
			pr.data.base.repo!!.owner.login,
			pr.data.base.repo!!.name,
			payload.issue.number,
			args.length > 0 ? JSON.stringify(args) : null
		).run();

		await octo.request('POST /repos/{owner}/{repo}/actions/workflows/{workflow_id}/dispatches', {
			owner: 'FriendsOfShopware',
			repo: 'automation-bot',
			workflow_id: workflowId,
			ref: 'main',
			inputs: {
				id: uuid,
			},
		});
	});

	// Handle issue events for real-time D1 sync
	webhooks.on(['issues.opened', 'issues.edited', 'issues.closed', 'issues.reopened', 'issues.labeled', 'issues.unlabeled', 'issues.assigned', 'issues.unassigned', 'issues.milestoned', 'issues.demilestoned'], async ({ payload }) => {
		const repo: GitHubRepository = {
			id: payload.repository.id,
			name: payload.repository.name,
			full_name: payload.repository.full_name,
			owner: { login: payload.repository.owner.login },
			open_issues_count: payload.repository.open_issues_count ?? 0,
			archived: payload.repository.archived ?? false,
			disabled: payload.repository.disabled ?? false,
		};

		const issue: GitHubIssueFromAPI = {
			id: payload.issue.id,
			node_id: payload.issue.node_id,
			number: payload.issue.number,
			title: payload.issue.title,
			body: payload.issue.body ?? null,
			state: payload.issue.state as string,
			state_reason: payload.issue.state_reason ?? null,
			locked: payload.issue.locked ?? false,
			comments: payload.issue.comments,
			created_at: payload.issue.created_at,
			updated_at: payload.issue.updated_at,
			closed_at: payload.issue.closed_at,
			user: payload.issue.user ? {
				login: payload.issue.user.login,
				avatar_url: payload.issue.user.avatar_url ?? '',
			} : null,
			author_association: payload.issue.author_association,
			labels: payload.issue.labels?.map(l => ({ name: typeof l === 'string' ? l : (l?.name ?? '') })) ?? [],
			assignees: payload.issue.assignees?.filter(a => a !== null).map(a => ({ login: a!.login })) ?? [],
			milestone: payload.issue.milestone ? {
				id: payload.issue.milestone.id,
				title: payload.issue.milestone.title,
			} : null,
			html_url: payload.issue.html_url,
			reactions: payload.issue.reactions ? {
				total_count: payload.issue.reactions.total_count,
			} : undefined,
		};

		await upsertIssue(c.env.db, issue, repo);
		console.log(`Issue ${payload.action}: ${repo.full_name}#${issue.number}`);
	});

	webhooks.on('issues.deleted', async ({ payload }) => {
		await deleteIssue(c.env.db, payload.issue.id);
		console.log(`Issue deleted: ${payload.repository.full_name}#${payload.issue.number}`);
	});

	webhooks.on('issues.transferred', async ({ payload }) => {
		// Delete from old repo, will be synced from new repo on next scheduled run
		await deleteIssue(c.env.db, payload.issue.id);
		console.log(`Issue transferred: ${payload.repository.full_name}#${payload.issue.number}`);
	});

	await webhooks.verifyAndReceive({
		id: c.req.header('x-request-id') as string,
		// @ts-expect-error
		name: c.req.header('x-github-event') as string,
		signature: c.req.header('x-hub-signature-256') as string,
		payload: await c.req.text(),
	})

	return c.json({ ok: true })
});

export default webhook;

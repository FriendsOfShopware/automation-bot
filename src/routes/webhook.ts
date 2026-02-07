import { Hono } from "hono/tiny";
import { Webhooks } from "@octokit/webhooks";
import { getOctoClient } from "../lib/github";
import { commandRegistry } from "../lib/commands";
import { dispatchCommand } from "../lib/dispatch";
import { upsertIssue } from "../lib/upsert-issue";

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

	webhooks.on(['issues.opened', 'issues.reopened', 'issues.edited', 'issues.labeled', 'issues.unlabeled', 'issues.transferred'], async ({ payload }) => {
		await upsertIssue(c.env.db, payload.repository.id, payload.issue as any, false);
	});

	webhooks.on(['issues.closed', 'issues.deleted'], async ({ payload }) => {
		await c.env.db.prepare('DELETE FROM github_issues WHERE repo_id = ? AND number = ?')
			.bind(payload.repository.id, payload.issue.number)
			.run();
	});

	webhooks.on(['pull_request.opened', 'pull_request.reopened', 'pull_request.edited', 'pull_request.labeled', 'pull_request.unlabeled'], async ({ payload }) => {
		await upsertIssue(c.env.db, payload.repository.id, payload.pull_request as any, true);
	});

	webhooks.on('pull_request.closed', async ({ payload }) => {
		await c.env.db.prepare('DELETE FROM github_issues WHERE repo_id = ? AND number = ?')
			.bind(payload.repository.id, payload.pull_request.number)
			.run();
	});

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
		const rawArgs = parts.slice(2)

		// Parse args as key=value pairs
		const args: Record<string, string> = {};
		for (const arg of rawArgs) {
			const eqIdx = arg.indexOf('=');
			if (eqIdx !== -1) {
				args[arg.slice(0, eqIdx)] = arg.slice(eqIdx + 1);
			}
		}

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

		await dispatchCommand({
			env: c.env,
			commandName,
			pr: {
				repositoryId: pr.data.base.repo!!.id,
				headOwner: pr.data.head.repo!!.owner.login,
				headRepo: pr.data.head.repo!!.name,
				headBranch: pr.data.head.ref,
				headSha: pr.data.head.sha,
				baseOwner: pr.data.base.repo!!.owner.login,
				baseRepo: pr.data.base.repo!!.name,
			},
			prNumber: payload.issue.number,
			args,
			triggeredBy: payload.comment.user?.login ?? 'unknown',
			triggerSource: 'webhook',
		});
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

import { Hono } from "hono/tiny";
import { Webhooks } from "@octokit/webhooks";
import { getOctoClient } from "../github";
import { commandRegistry } from "../commands";

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

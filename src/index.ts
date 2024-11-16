import { Hono } from "hono/tiny";
import { createAppAuth } from "@octokit/auth-app";
import { Octokit } from "@octokit/core";
import { Webhooks } from "@octokit/webhooks";

// See https://docs.github.com/en/graphql/reference/enums#commentauthorassociation
const DEFAULT_ALLOWED_COMMENTER_ASSOCIATIONS = new Set([
	'COLLABORATOR', // Author has been invited to collaborate on the repository.
	'OWNER', // Author is the owner of the repository.
	'MEMBER', // Author is a member of the organization that owns the repository.
]);

const commandToWorkflow = new Map([
	['fix-cs', '.github/workflows/fix-cs.yml'],
]);

const app = new Hono<{ Bindings: Env }>()

app.post('/webhook', async c => {
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

		const command = payload.comment.body.trim()

		if (!command.startsWith('@frosh-automation')) {
			return
		}

		const [_, workflow] = command.split(' ')

		const workflowPath = commandToWorkflow.get(workflow)

		if (!workflowPath) {
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

		await octo.request('POST /repos/{owner}/{repo}/actions/workflows/{workflow_id}/dispatches', {
			owner: 'FriendsOfShopware',
			repo: 'automation-bot',
			workflow_id: 128346036,
			ref: 'main',
			inputs: {
				owner: pr.data.head.repo!!.owner.login,
				repo: pr.data.head.repo!!.name,
				branch: pr.data.head.ref,
			}
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

function getOctoClient(env: Env) {
	return new Octokit({
		authStrategy: createAppAuth,
		auth: {
			appId: env.GITHUB_APP_ID,
			privateKey: env.GITHUB_PRIVATE_KEY,
			installationId: env.GITHUB_INSTALLATION_ID,
		},
	})
}

export default app;
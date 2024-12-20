import { Hono } from "hono/tiny";
import { createAppAuth } from "@octokit/auth-app";
import { Octokit } from "@octokit/core";
import { Webhooks } from "@octokit/webhooks";
import { parseJwt, getKey } from "@cfworker/jwt";

// See https://docs.github.com/en/graphql/reference/enums#commentauthorassociation
const DEFAULT_ALLOWED_COMMENTER_ASSOCIATIONS = new Set([
	'COLLABORATOR', // Author has been invited to collaborate on the repository.
	'OWNER', // Author is the owner of the repository.
	'MEMBER', // Author is a member of the organization that owns the repository.
]);

const commandToWorkflow = new Map([
	['fix-cs', '.github/workflows/csfixer.yml'],
	['create-instance', '.github/workflows/instance.yml'],
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

		const workflows = await octo.request('GET /repos/{owner}/{repo}/actions/workflows', {
			owner: 'FriendsOfShopware',
			repo: 'automation-bot',
		});

		const workflowId = workflows.data.workflows.find(w => w.path === workflowPath)?.id

		if (!workflowId) {
			console.log('Workflow not found')
			return
		}

		const uuid = crypto.randomUUID()

		await c.env.kv.put(uuid, JSON.stringify({
			repository_id: pr.data.base.repo!!.id,
		}), {expirationTtl: 10 * 60})

		await octo.request('POST /repos/{owner}/{repo}/actions/workflows/{workflow_id}/dispatches', {
			owner: 'FriendsOfShopware',
			repo: 'automation-bot',
			workflow_id: workflowId,
			ref: 'main',
			inputs: {
				id: uuid,
				owner: pr.data.head.repo!!.owner.login,
				repo: pr.data.head.repo!!.name,
				branch: pr.data.head.ref,
				baseRepo: `${pr.data.base.repo!!.owner.login}/${pr.data.base.repo!!.name}`,
				prNumber: payload.issue.number,
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

app.post('/api/token/generate/:id', async c => {
	const authHeader = c.req.header('Authorization')

	if (!authHeader) {
		return c.json({ error: 'Authorization header is missing' }, 401)
	}

	const check = await parseJwt({ jwt: authHeader, audience: 'github-bot.fos.gg', issuer: 'https://token.actions.githubusercontent.com', resolveKey: async (key) => await getKey(key)})

	if (!check.valid) {
		return c.json({ error: 'Invalid token' }, 401)
	}

	const payload = check.payload as unknown as { actor: string}

	if (payload.actor !== 'frosh-automation[bot]') {
		return c.json({ error: 'Invalid actor' }, 401)
	}

	const id = c.req.param('id');

	if (!id) {
		return c.json({ error: 'ID is missing' }, 400)
	}

	const data = await c.env.kv.get(id)

	if (!data) {
		return c.json({ error: 'ID not found' }, 404)
	}

	const { repository_id } = JSON.parse(data)

	const octo = getOctoClient(c.env)

	const tokenResponse = await octo.request('POST /app/installations/{installation_id}/access_tokens', {
		installation_id: parseInt(c.env.GITHUB_INSTALLATION_ID as string),
		permissions: {
			contents: 'write',
		},
		repository_ids: [repository_id],
	});

	return c.json({ token: tokenResponse.data.token })
});

app.post('/api/token/delete/:id', async c => {
	const authHeader = c.req.header('Authorization')

	if (!authHeader) {
		return c.json({ error: 'Authorization header is missing' }, 401)
	}

	const check = await parseJwt({ jwt: authHeader, audience: 'github-bot.fos.gg', issuer: 'https://token.actions.githubusercontent.com', resolveKey: async (key) => await getKey(key)})

	if (!check.valid) {
		return c.json({ error: 'Invalid token' }, 401)
	}

	const payload = check.payload as unknown as { actor: string}

	if (payload.actor !== 'frosh-automation[bot]') {
		return c.json({ error: 'Invalid actor' }, 401)
	}

	const id = c.req.param('id');

	if (!id) {
		return c.json({ error: 'ID is missing' }, 400)
	}

	const data = await c.env.kv.get(id)

	if (!data) {
		return c.json({ error: 'ID not found' }, 404)
	}

	const githubToken = c.req.header('GitHub-Bot-Access-Token')

	if (!githubToken) {
		return c.json({ error: 'GitHub-Bot-Access-Token header is missing' }, 401)
	}

	const octo = getOctoClient(c.env)

	const resp = await fetch('https://api.github.com/installation/token', {
		method: 'DELETE',
		headers: {
			'Authorization': `Bearer ${githubToken}`,
			'User-Agent': 'frosh-automation[bot]',
			'Accept': 'application/vnd.github.v3+json',
		},
	})

	if (!resp.ok) {
		return c.json({ error: 'Failed to delete token' }, 500)
	}

	await c.env.kv.delete(id)

	return c.json({ ok: true })
});

export default app;
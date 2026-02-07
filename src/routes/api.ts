import { Hono } from "hono/tiny";
import { getOctoClient } from "../lib/github";
import { commandRegistry } from "../lib/commands";
import { validateOidcToken } from "../lib/auth";
import { ExecutionRow, rowToExecutionContext } from "../lib/execution";

const api = new Hono<{ Bindings: Env }>();

api.post('/token/generate/:id', async c => {
	const validation = await validateOidcToken(c.req.header('Authorization'));
	if (!validation.valid) {
		return c.json({ error: validation.error }, 401);
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

	// Update execution status to running
	await c.env.db.prepare(`UPDATE executions SET status = 'running' WHERE id = ?`).bind(id).run();

	// Get execution context from D1
	const execution = await c.env.db.prepare(`SELECT * FROM executions WHERE id = ?`).bind(id).first<ExecutionRow>();

	const octo = getOctoClient(c.env)

	const tokenResponse = await octo.request('POST /app/installations/{installation_id}/access_tokens', {
		installation_id: parseInt(c.env.GITHUB_INSTALLATION_ID as string),
		permissions: {
			contents: 'write',
			statuses: 'write',
			pull_requests: 'write',
		},
		repository_ids: [repository_id],
	});

	// Return token along with execution context
	return c.json({
		token: tokenResponse.data.token,
		execution: execution ? rowToExecutionContext(execution) : null,
	});
});

api.post('/token/delete/:id', async c => {
	const validation = await validateOidcToken(c.req.header('Authorization'));
	if (!validation.valid) {
		return c.json({ error: validation.error }, 401);
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

api.post('/report/:id', async c => {
	const validation = await validateOidcToken(c.req.header('Authorization'));
	if (!validation.valid) {
		return c.json({ error: validation.error }, 401);
	}

	const id = c.req.param('id');

	if (!id) {
		return c.json({ error: 'ID is missing' }, 400);
	}

	const executionRow = await c.env.db.prepare(`SELECT * FROM executions WHERE id = ?`).bind(id).first<ExecutionRow>();

	if (!executionRow) {
		return c.json({ error: 'Execution not found' }, 404);
	}

	const command = commandRegistry.get(executionRow.command);

	if (!command) {
		return c.json({ error: 'Command not found' }, 404);
	}

	let payload: Record<string, unknown>;
	try {
		payload = await c.req.json<Record<string, unknown>>();
	} catch {
		return c.json({ error: 'Invalid JSON payload' }, 400);
	}

	const octo = getOctoClient(c.env);
	const execution = rowToExecutionContext(executionRow);

	const result = await command.postExecution({
		octo,
		execution,
		payload,
	});

	// Update execution in D1
	await c.env.db.prepare(`
		UPDATE executions
		SET status = ?, result = ?, completed_at = CURRENT_TIMESTAMP
		WHERE id = ?
	`).bind(result.status, JSON.stringify(payload), id).run();

	return c.json({ ok: true });
});

export default api;

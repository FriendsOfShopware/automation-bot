import { Hono } from "hono/tiny";
import { getOctoClient } from "../github";
import { commandRegistry } from "../commands";
import { validateOidcToken } from "../auth";
import { ExecutionRow, rowToExecutionContext } from "../execution";
import { getIssueStats } from "../issues/sync";
import type { GitHubIssueRow, GitHubSyncStatusRow } from "../issues/types";

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

// Dashboard API endpoints for GitHub issues

api.get('/issues/stats', async c => {
	const stats = await getIssueStats(c.env.db);
	return c.json(stats);
});

api.get('/issues', async c => {
	const state = c.req.query('state') || 'open';
	const repo = c.req.query('repo');
	const author = c.req.query('author');
	const label = c.req.query('label');
	const limit = Math.min(parseInt(c.req.query('limit') || '100'), 500);
	const offset = parseInt(c.req.query('offset') || '0');

	let query = 'SELECT * FROM github_issues WHERE 1=1';
	const params: (string | number)[] = [];

	if (state && state !== 'all') {
		query += ' AND state = ?';
		params.push(state);
	}

	if (repo) {
		query += ' AND repository_full_name = ?';
		params.push(repo);
	}

	if (author) {
		query += ' AND author_login = ?';
		params.push(author);
	}

	if (label) {
		query += ' AND labels LIKE ?';
		params.push(`%"${label}"%`);
	}

	query += ' ORDER BY updated_at DESC LIMIT ? OFFSET ?';
	params.push(limit, offset);

	const result = await c.env.db.prepare(query).bind(...params).all<GitHubIssueRow>();

	return c.json({
		issues: result.results ?? [],
		count: result.results?.length ?? 0,
	});
});

api.get('/issues/repositories', async c => {
	const result = await c.env.db.prepare(`
		SELECT DISTINCT repository_full_name, repository_owner, repository_name
		FROM github_issues
		ORDER BY repository_full_name
	`).all<{ repository_full_name: string; repository_owner: string; repository_name: string }>();

	return c.json(result.results ?? []);
});

api.get('/issues/sync-status', async c => {
	const result = await c.env.db.prepare(`
		SELECT * FROM github_sync_status ORDER BY last_synced_at DESC
	`).all<GitHubSyncStatusRow>();

	return c.json(result.results ?? []);
});

export default api;

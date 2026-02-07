import { Hono } from 'hono/tiny';
import type { ExecutionRow } from '../lib/execution';
import type { DashboardEnv } from '../middleware/session';

const executions = new Hono<DashboardEnv>();

executions.get('/', async (c) => {
	const result = await c.env.db.prepare(
		`SELECT * FROM executions ORDER BY created_at DESC LIMIT 50`
	).all<ExecutionRow>();

	return c.json(result.results);
});

export default executions;

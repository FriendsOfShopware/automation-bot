import { Hono } from 'hono';
import { sessionMiddleware, authGuard, type DashboardEnv } from './middleware/session';
import { syncRepos } from './lib/sync-repos';
import { enqueueIssueSyncs, syncRepoIssues, type IssueSyncMessage } from './lib/sync-issues';
import webhook from './routes/webhook';
import api from './routes/api';
import auth from './routes/auth';
import repos from './routes/repos';
import executions from './routes/executions';
import commands from './routes/commands';
import dispatch from './routes/dispatch';
import kanban from './routes/kanban';

const app = new Hono<{ Bindings: Env }>();

// Public routes (no session/auth needed)
app.route('/webhook', webhook);
app.route('/api', api); // token + report endpoints

// Everything below requires session
const dashboard = new Hono<DashboardEnv>();
dashboard.use('*', sessionMiddleware);
dashboard.use('*', authGuard);

// Auth routes (session middleware needed, but auth guard exempts /auth/*)
dashboard.route('/auth', auth);

// Session-protected JSON API routes
dashboard.get('/api/session', async (c) => {
	const data = await c.var.session.get();
	if (!data || !('userId' in data)) {
		return c.json({ error: 'Unauthorized' }, 401);
	}
	return c.json({ userId: data.userId, login: data.login, avatarUrl: data.avatarUrl });
});
dashboard.route('/api/repos', repos);
dashboard.route('/api/executions', executions);
dashboard.route('/api/commands', commands);
dashboard.route('/api/dispatch', dispatch);
dashboard.route('/api/kanban', kanban);
dashboard.post('/api/sync', async (c) => {
	await syncRepos(c.env);
	await enqueueIssueSyncs(c.env);
	return c.json({ ok: true });
});

app.route('/', dashboard);

export default {
	fetch: app.fetch,
	async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
		await syncRepos(env);
		ctx.waitUntil(enqueueIssueSyncs(env));
	},
	async queue(batch: MessageBatch<IssueSyncMessage>, env: Env): Promise<void> {
		for (const msg of batch.messages) {
			try {
				await syncRepoIssues(env, msg.body.repoId, msg.body.fullName);
				msg.ack();
			} catch {
				msg.retry();
			}
		}
	},
};

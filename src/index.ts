import { Hono } from "hono/tiny";
import webhook from "./routes/webhook";
import api from "./routes/api";
import { handleScheduled, handleQueueMessage } from "./issues/scheduled";
import type { RepoSyncMessage } from "./issues/types";

const app = new Hono<{ Bindings: Env }>();

app.route('/webhook', webhook);
app.route('/api', api);

export default {
	fetch: app.fetch,

	// Scheduled handler: runs hourly to enqueue all repos
	async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
		ctx.waitUntil(handleScheduled(env));
	},

	// Queue consumer: processes repository sync jobs
	async queue(batch: MessageBatch<RepoSyncMessage>, env: Env): Promise<void> {
		await handleQueueMessage(batch, env);
	},
};

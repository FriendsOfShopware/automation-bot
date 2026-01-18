import { getOctoClient } from '../github';
import { enqueueAllRepos, syncSingleRepository } from './sync';
import type { RepoSyncMessage } from './types';

// Scheduled handler: enqueue all repos for sync
export async function handleScheduled(env: Env): Promise<void> {
	console.log('Starting scheduled GitHub issues sync - enqueueing repositories...');

	const octo = getOctoClient(env);
	const startTime = Date.now();

	try {
		const result = await enqueueAllRepos(octo, env.issuesSyncQueue);
		const duration = Date.now() - startTime;

		console.log(`Enqueued ${result.queued} repositories in ${duration}ms`);
	} catch (error) {
		const duration = Date.now() - startTime;
		console.error(`Failed to enqueue repositories after ${duration}ms:`, error);
		throw error;
	}
}

// Queue consumer: sync a single repository
export async function handleQueueMessage(batch: MessageBatch<RepoSyncMessage>, env: Env): Promise<void> {
	const octo = getOctoClient(env);

	for (const message of batch.messages) {
		try {
			await syncSingleRepository(octo, env.db, message.body.repo);
			message.ack();
		} catch (error) {
			console.error(`Failed to process message for ${message.body.repo.full_name}:`, error);
			message.retry();
		}
	}
}

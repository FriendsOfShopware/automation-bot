import type { RepoSyncMessage } from './issues/types';

// Extend the Cloudflare Env interface with additional bindings
declare global {
	interface Env {
		// Queue for issues sync (added via wrangler.toml)
		issuesSyncQueue: Queue<RepoSyncMessage>;
	}
}

export {};

import { getOctoClient } from './github';

export interface IssueSyncMessage {
	repoId: number;
	fullName: string;
}

export async function enqueueIssueSyncs(env: Env): Promise<void> {
	const result = await env.db.prepare('SELECT id, full_name FROM github_repositories WHERE archived = 0').all<{
		id: number;
		full_name: string;
	}>();

	const messages = result.results.map((r) => ({
		body: { repoId: r.id, fullName: r.full_name } satisfies IssueSyncMessage,
	}));

	// sendBatch accepts max 100 messages at a time
	for (let i = 0; i < messages.length; i += 100) {
		await env.ISSUE_SYNC_QUEUE.sendBatch(messages.slice(i, i + 100));
	}
}

export async function syncRepoIssues(env: Env, repoId: number, fullName: string): Promise<void> {
	const octo = getOctoClient(env);
	const [owner, repo] = fullName.split('/');

	const allIssues: any[] = [];
	let page = 1;

	while (true) {
		const resp = await octo.request('GET /repos/{owner}/{repo}/issues', {
			owner,
			repo,
			state: 'open',
			per_page: 100,
			page,
		});

		allIssues.push(...resp.data);

		if (resp.data.length < 100) {
			break;
		}

		page++;
	}

	if (allIssues.length === 0) {
		await env.db.prepare('DELETE FROM github_issues WHERE repo_id = ?').bind(repoId).run();
		return;
	}

	// Delete all existing rows for this repo, then re-insert current open issues
	await env.db.prepare('DELETE FROM github_issues WHERE repo_id = ?').bind(repoId).run();

	const batchSize = 50;
	for (let i = 0; i < allIssues.length; i += batchSize) {
		const batch = allIssues.slice(i, i + batchSize);
		const stmt = env.db.prepare(
			`INSERT INTO github_issues (id, repo_id, number, title, state, is_pull_request, author_login, author_avatar_url, labels, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
		);

		await env.db.batch(
			batch.map((item: any) =>
				stmt.bind(
					item.id,
					repoId,
					item.number,
					item.title,
					item.state,
					item.pull_request ? 1 : 0,
					item.user?.login ?? 'ghost',
					item.user?.avatar_url ?? null,
					JSON.stringify((item.labels ?? []).map((l: any) => ({ name: l.name, color: l.color }))),
					item.created_at,
					item.updated_at
				)
			)
		);
	}
}

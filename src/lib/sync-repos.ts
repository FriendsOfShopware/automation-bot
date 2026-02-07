import { getOctoClient } from './github';

export async function syncRepos(env: Env) {
	const octo = getOctoClient(env);

	const allRepos: any[] = [];
	let page = 1;

	while (true) {
		const resp = await octo.request('GET /installation/repositories', {
			per_page: 100,
			page,
		});

		allRepos.push(...resp.data.repositories);

		if (allRepos.length >= resp.data.total_count) {
			break;
		}

		page++;
	}

	// Delete all repos and re-insert to avoid D1 variable limits on NOT IN clauses
	await env.db.prepare('DELETE FROM github_repositories').run();

	const batchSize = 50;
	for (let i = 0; i < allRepos.length; i += batchSize) {
		const batch = allRepos.slice(i, i + batchSize);
		const stmt = env.db.prepare(
			'INSERT INTO github_repositories (id, full_name, name, default_branch, topics, archived) VALUES (?, ?, ?, ?, ?, ?)'
		);

		await env.db.batch(batch.map((r) => stmt.bind(r.id, r.full_name, r.name, r.default_branch, JSON.stringify(r.topics ?? []), r.archived ? 1 : 0)));
	}
}

export interface IssuePayload {
	id: number;
	number: number;
	title: string;
	state: string;
	user: { login: string; avatar_url: string } | null;
	labels: { name: string; color: string }[];
	created_at: string;
	updated_at: string;
}

export async function upsertIssue(db: D1Database, repoId: number, item: IssuePayload, isPullRequest: boolean): Promise<void> {
	await db
		.prepare(
			`INSERT OR REPLACE INTO github_issues (id, repo_id, number, title, state, is_pull_request, author_login, author_avatar_url, labels, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
		)
		.bind(
			item.id,
			repoId,
			item.number,
			item.title,
			item.state,
			isPullRequest ? 1 : 0,
			item.user?.login ?? 'ghost',
			item.user?.avatar_url ?? null,
			JSON.stringify(item.labels.map((l) => ({ name: l.name, color: l.color }))),
			item.created_at,
			item.updated_at
		)
		.run();
}

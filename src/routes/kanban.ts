import { Hono } from 'hono/tiny';
import type { DashboardEnv } from '../middleware/session';

const kanban = new Hono<DashboardEnv>();

kanban.get('/repos', async (c) => {
	const data = await c.var.session.get();
	const viewerLogin = data && 'login' in data ? String(data.login) : '';

	const repos = await c.env.db
		.prepare(
			`SELECT
				r.id,
				r.full_name,
				r.name,
				COUNT(i.id) AS open_count,
				MAX(i.updated_at) AS last_updated_at,
				SUM(CASE WHEN i.author_login = ? THEN 1 ELSE 0 END) AS mine_count
			FROM github_repositories r
			INNER JOIN github_issues i ON i.repo_id = r.id
				AND i.state = 'open'
				AND i.author_login NOT IN ('renovate', 'renovate[bot]')
			GROUP BY r.id, r.full_name, r.name
			ORDER BY open_count DESC, last_updated_at DESC, r.full_name ASC`
		)
		.bind(viewerLogin)
		.all<{
			id: number;
			full_name: string;
			name: string;
			open_count: number;
			last_updated_at: string | null;
			mine_count: number;
		}>();

	return c.json(repos.results.map((repo) => ({
		id: repo.id,
		full_name: repo.full_name,
		name: repo.name,
		openCount: Number(repo.open_count || 0),
		lastUpdatedAt: repo.last_updated_at,
		mineCount: Number(repo.mine_count || 0),
	})));
});

kanban.get('/', async (c) => {
	const repoIdsRaw = c.req.query('repoIds')?.trim() ?? '';
	const repoIds = repoIdsRaw
		.split(',')
		.map((v) => Number(v.trim()))
		.filter((v) => Number.isInteger(v) && v > 0);

	const hasRepoFilter = repoIds.length > 0;
	const placeholders = repoIds.map(() => '?').join(', ');
	const repoFilter = hasRepoFilter ? ` AND r.id IN (${placeholders})` : '';

	const repos = await c.env.db
		.prepare(
			`SELECT DISTINCT r.id, r.full_name, r.name
			FROM github_repositories r
			INNER JOIN github_issues i ON i.repo_id = r.id
				AND i.state = 'open'
				AND i.author_login NOT IN ('renovate', 'renovate[bot]')
			WHERE 1=1 ${repoFilter}
			ORDER BY r.full_name`
		)
		.bind(...repoIds)
		.all<{ id: number; full_name: string; name: string }>();

	if (repos.results.length === 0) {
		return c.json([]);
	}

	const issueFilter = hasRepoFilter ? ` AND i.repo_id IN (${placeholders})` : '';
	const issues = await c.env.db
		.prepare(
			`SELECT i.id, i.repo_id, i.number, i.title, i.is_pull_request, i.author_login, i.author_avatar_url, i.labels, i.created_at, i.updated_at
			FROM github_issues i
			INNER JOIN github_repositories r ON r.id = i.repo_id
			WHERE i.state = 'open'
				AND i.author_login NOT IN ('renovate', 'renovate[bot]')
				${issueFilter}
			ORDER BY i.created_at DESC`
		)
		.bind(...repoIds)
		.all<{
			id: number;
			repo_id: number;
			number: number;
			title: string;
			is_pull_request: number;
			author_login: string;
			author_avatar_url: string | null;
			labels: string;
			created_at: string;
			updated_at: string;
		}>();

	const issuesByRepo = new Map<number, any[]>();
	for (const issue of issues.results) {
		const list = issuesByRepo.get(issue.repo_id) ?? [];
		list.push({
			id: issue.id,
			number: issue.number,
			title: issue.title,
			isPullRequest: issue.is_pull_request === 1,
			authorLogin: issue.author_login,
			authorAvatarUrl: issue.author_avatar_url,
			labels: JSON.parse(issue.labels),
			createdAt: issue.created_at,
			updatedAt: issue.updated_at,
		});
		issuesByRepo.set(issue.repo_id, list);
	}

	const columns = repos.results.map((r) => ({
		repo: { id: r.id, full_name: r.full_name, name: r.name },
		items: issuesByRepo.get(r.id) ?? [],
	}));

	return c.json(columns);
});

export default kanban;

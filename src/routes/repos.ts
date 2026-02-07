import { Hono } from 'hono/tiny';
import { getOctoClient } from '../lib/github';
import type { DashboardEnv } from '../middleware/session';

const repos = new Hono<DashboardEnv>();

repos.get('/', async (c) => {
	const rows = await c.env.db
		.prepare(`SELECT full_name, name, default_branch FROM github_repositories WHERE archived = 0 AND topics LIKE '%"shopware6-plugin"%' ORDER BY full_name`)
		.all();

	return c.json(rows.results);
});

repos.get('/:owner/:repo/pulls', async (c) => {
	const { owner, repo } = c.req.param();
	const octo = getOctoClient(c.env);

	const resp = await octo.request('GET /repos/{owner}/{repo}/pulls', {
		owner,
		repo,
		state: 'open',
		per_page: 50,
	});

	const pulls = resp.data.map((p: any) => ({
		number: p.number,
		title: p.title,
	}));

	return c.json(pulls);
});

repos.get('/:owner/:repo/branches', async (c) => {
	const { owner, repo } = c.req.param();
	const octo = getOctoClient(c.env);

	const resp = await octo.request('GET /repos/{owner}/{repo}/branches', {
		owner,
		repo,
		per_page: 100,
	});

	const repoResp = await octo.request('GET /repos/{owner}/{repo}', {
		owner,
		repo,
	});

	const defaultBranch = repoResp.data.default_branch;

	const branches = resp.data
		.map((b: any) => ({ name: b.name }))
		.sort((a: any, b: any) => {
			if (a.name === defaultBranch) return -1;
			if (b.name === defaultBranch) return 1;
			return a.name.localeCompare(b.name);
		});

	return c.json(branches);
});

export default repos;

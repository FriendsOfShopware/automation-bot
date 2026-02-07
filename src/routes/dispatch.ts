import { Hono } from 'hono/tiny';
import { getOctoClient } from '../lib/github';
import { dispatchCommand } from '../lib/dispatch';
import type { DashboardEnv } from '../middleware/session';

const dispatch = new Hono<DashboardEnv>();

dispatch.post('/', async (c) => {
	const body = await c.req.json<{
		command: string;
		repo: string;
		mode?: string;
		pr?: number;
		ref?: string;
		args?: Record<string, string>;
	}>();

	const { command: commandName, repo: repoFullName, mode = 'pr', args = {} } = body;

	if (!commandName || !repoFullName) {
		return c.json({ success: false, error: 'Missing required fields.' }, 400);
	}

	const [owner, repo] = repoFullName.split('/');

	try {
		const octo = getOctoClient(c.env);
		const session = await c.var.session.get();
		const triggeredBy = session && 'login' in session ? String(session.login) : 'unknown';

		if (mode === 'ref') {
			const ref = (body.ref || '').trim();
			if (!ref) {
				return c.json({ success: false, error: 'Missing ref/branch name.' }, 400);
			}

			const repoData = await octo.request('GET /repos/{owner}/{repo}', { owner, repo });

			const refData = await octo.request('GET /repos/{owner}/{repo}/git/ref/{ref}', {
				owner,
				repo,
				ref: `heads/${ref}`,
			});

			await dispatchCommand({
				env: c.env,
				commandName,
				pr: {
					repositoryId: repoData.data.id,
					headOwner: owner,
					headRepo: repo,
					headBranch: ref,
					headSha: refData.data.object.sha,
					baseOwner: owner,
					baseRepo: repo,
				},
				prNumber: null,
				args,
				triggeredBy,
				triggerSource: 'dashboard',
			});

			return c.json({ success: true, message: `Command "${commandName}" dispatched for ${repoFullName}@${ref}.` });
		}

		// PR mode
		const prNumber = body.pr;
		if (!prNumber) {
			return c.json({ success: false, error: 'Missing pull request.' }, 400);
		}

		const pr = await octo.request('GET /repos/{owner}/{repo}/pulls/{pull_number}', {
			owner,
			repo,
			pull_number: prNumber,
		});

		await dispatchCommand({
			env: c.env,
			commandName,
			pr: {
				repositoryId: pr.data.base.repo!!.id,
				headOwner: pr.data.head.repo!!.owner.login,
				headRepo: pr.data.head.repo!!.name,
				headBranch: pr.data.head.ref,
				headSha: pr.data.head.sha,
				baseOwner: pr.data.base.repo!!.owner.login,
				baseRepo: pr.data.base.repo!!.name,
			},
			prNumber,
			args,
			triggeredBy,
			triggerSource: 'dashboard',
		});

		return c.json({ success: true, message: `Command "${commandName}" dispatched for ${repoFullName}#${prNumber}.` });
	} catch (err: any) {
		return c.json({ success: false, error: err.message || 'Failed to dispatch command.' }, 500);
	}
});

export default dispatch;

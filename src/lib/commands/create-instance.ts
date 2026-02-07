import type { Command, PostExecutionContext, PostExecutionResult } from "./index";

interface CreateInstancePayload {
	previewUrl: string;
}

const DOCKER_TAGS_CACHE_TTL = 3600; // 1 hour

async function fetchDockerTags(kv: KVNamespace, registry: string, repo: string, filter: RegExp): Promise<string[]> {
	const cacheKey = `cache:docker-tags:${registry}/${repo}`;
	const cached = await kv.get(cacheKey);
	if (cached) {
		return JSON.parse(cached);
	}

	const tokenResp = await fetch(`https://${registry}/token?service=${registry}&scope=repository:${repo}:pull`);
	const { token } = await tokenResp.json<{ token: string }>();

	const tagsResp = await fetch(`https://${registry}/v2/${repo}/tags/list`, {
		headers: { Authorization: `Bearer ${token}` },
	});
	const { tags } = await tagsResp.json<{ tags: string[] }>();

	const versions: string[] = [];
	for (const tag of tags) {
		const match = tag.match(filter);
		if (match) {
			versions.push(match[1]);
		}
	}

	const result = versions.sort((a, b) => b.localeCompare(a, undefined, { numeric: true })).slice(0, 10);
	await kv.put(cacheKey, JSON.stringify(result), { expirationTtl: DOCKER_TAGS_CACHE_TTL });

	return result;
}

export const createInstance: Command<CreateInstancePayload> = {
	name: "create-instance",
	workflowPath: ".github/workflows/instance.yml",
	arguments: [
		{
			name: 'shopware-version',
			label: 'Shopware Version',
			options: (kv) => fetchDockerTags(kv, 'ghcr.io', 'friendsofshopware/shopware-demo-environment', /^(\d+\.\d+\.\d+)$/),
		},
		{
			name: 'php-version',
			label: 'PHP Version',
			options: async (_kv) => ['8.4', '8.3', '8.2'],
		},
	],

	async postExecution(ctx: PostExecutionContext<CreateInstancePayload>): Promise<PostExecutionResult> {
		if (ctx.execution.prNumber) {
			await ctx.octo.request('POST /repos/{owner}/{repo}/issues/{issue_number}/comments', {
				owner: ctx.execution.baseOwner,
				repo: ctx.execution.baseRepo,
				issue_number: ctx.execution.prNumber,
				body: `Hey :wave:,

I have created for you a Shopware installation with the current changes made here.

You can access the Shop here: ${ctx.payload.previewUrl}

The URL is only for FriendsOfShopware members.`,
			});
		}

		await ctx.octo.request('POST /repos/{owner}/{repo}/statuses/{sha}', {
			owner: ctx.execution.baseOwner,
			repo: ctx.execution.baseRepo,
			sha: ctx.execution.headSha,
			state: 'success',
			target_url: ctx.payload.previewUrl,
			description: 'Shopware instance is ready',
			context: 'Shopware Preview',
		});

		return { status: 'completed' };
	},
};

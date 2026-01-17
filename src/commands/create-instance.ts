import type { Command, PostExecutionContext, PostExecutionResult } from "./index";

interface CreateInstancePayload {
	previewUrl: string;
}

export const createInstance: Command<CreateInstancePayload> = {
	name: "create-instance",
	workflowPath: ".github/workflows/instance.yml",

	async postExecution(ctx: PostExecutionContext<CreateInstancePayload>): Promise<PostExecutionResult> {
		await ctx.octo.request('POST /repos/{owner}/{repo}/issues/{issue_number}/comments', {
			owner: ctx.execution.baseOwner,
			repo: ctx.execution.baseRepo,
			issue_number: ctx.execution.prNumber,
			body: `Hey :wave:,

I have created for you a Shopware installation with the current changes made here.

You can access the Shop here: ${ctx.payload.previewUrl}

The URL is only for FriendsOfShopware members.`,
		});

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

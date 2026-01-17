import type { Command, PostExecutionContext, PostExecutionResult } from "./index";

interface FixCsPayload {
	changes: boolean;
}

export const fixCs: Command<FixCsPayload> = {
	name: "fix-cs",
	workflowPath: ".github/workflows/csfixer.yml",

	async postExecution(ctx: PostExecutionContext<FixCsPayload>): Promise<PostExecutionResult> {
		if (ctx.payload.changes) {
			await ctx.octo.request('POST /repos/{owner}/{repo}/issues/{issue_number}/comments', {
				owner: ctx.execution.baseOwner,
				repo: ctx.execution.baseRepo,
				issue_number: ctx.execution.prNumber,
				body: 'Code style has been fixed and pushed to the branch.',
			});
		} else {
			await ctx.octo.request('POST /repos/{owner}/{repo}/issues/{issue_number}/comments', {
				owner: ctx.execution.baseOwner,
				repo: ctx.execution.baseRepo,
				issue_number: ctx.execution.prNumber,
				body: 'No code style changes needed - the code already follows the style guidelines.',
			});
		}

		return { status: 'completed' };
	},
};

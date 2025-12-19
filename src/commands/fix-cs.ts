import type { Command, CommandContext } from "./index";

export const fixCs: Command = {
	name: "fix-cs",
	workflowPath: ".github/workflows/csfixer.yml",
	getInputs(ctx: CommandContext): Record<string, string> {
		return {
			owner: ctx.pr.headOwner,
			repo: ctx.pr.headRepo,
			branch: ctx.pr.headBranch,
			baseRepo: `${ctx.pr.baseOwner}/${ctx.pr.baseRepo}`,
			prNumber: String(ctx.pr.prNumber),
		};
	},
};

import type { Command, CommandContext } from "./index";

export const createInstance: Command = {
	name: "create-instance",
	workflowPath: ".github/workflows/instance.yml",
	getInputs(ctx: CommandContext): Record<string, string> {
		const inputs: Record<string, string> = {
			owner: ctx.pr.headOwner,
			repo: ctx.pr.headRepo,
			branch: ctx.pr.headBranch,
			sha: ctx.pr.headSha,
			baseRepo: `${ctx.pr.baseOwner}/${ctx.pr.baseRepo}`,
			prNumber: String(ctx.pr.prNumber),
		};

		if (ctx.args.length > 0) {
			inputs["shopware-version"] = ctx.args[0];
		}

		return inputs;
	},
};

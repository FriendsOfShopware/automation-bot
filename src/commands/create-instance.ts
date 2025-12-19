import type { Command, CommandContext } from "./index";

export const createInstance: Command = {
	name: "create-instance",
	workflowPath: ".github/workflows/instance.yml",
	getInputs(ctx: CommandContext): Record<string, string | number> {
		const inputs: Record<string, string | number> = {
			owner: ctx.pr.headOwner,
			repo: ctx.pr.headRepo,
			branch: ctx.pr.headBranch,
			baseRepo: `${ctx.pr.baseOwner}/${ctx.pr.baseRepo}`,
			prNumber: ctx.pr.prNumber,
		};

		if (ctx.args.length > 0) {
			inputs["shopware-version"] = ctx.args[0];
		}

		return inputs;
	},
};

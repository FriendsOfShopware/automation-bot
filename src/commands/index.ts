import { Octokit } from "@octokit/core";
import { fixCs } from "./fix-cs";
import { createInstance } from "./create-instance";

export interface PullRequestData {
	headOwner: string;
	headRepo: string;
	headBranch: string;
	headSha: string;
	baseOwner: string;
	baseRepo: string;
	prNumber: number;
}

export interface CommandContext {
	octo: Octokit;
	env: Env;
	pr: PullRequestData;
	args: string[];
}

export interface Command {
	name: string;
	workflowPath: string;
	getInputs(ctx: CommandContext): Record<string, string>;
}

const commands: Command[] = [
	fixCs,
	createInstance,
];

export const commandRegistry = new Map<string, Command>(
	commands.map(cmd => [cmd.name, cmd])
);

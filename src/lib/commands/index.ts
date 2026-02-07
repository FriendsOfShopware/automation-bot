import { Octokit } from "@octokit/core";
import { fixCs } from "./fix-cs";
import { createInstance } from "./create-instance";

export interface ExecutionContext {
	id: string;
	command: string;
	headOwner: string;
	headRepo: string;
	headBranch: string;
	headSha: string;
	baseOwner: string;
	baseRepo: string;
	prNumber: number | null;
	args: Record<string, string>;
}

export interface PostExecutionContext<TPayload> {
	octo: Octokit;
	execution: ExecutionContext;
	payload: TPayload;
}

export interface PostExecutionResult {
	status: 'completed' | 'failed';
}

export interface CommandArgument {
	name: string;
	label: string;
	options: (kv: KVNamespace) => Promise<string[]>;
}

export interface ResolvedCommandArgument {
	name: string;
	label: string;
	options: string[];
}

export interface Command<TPayload = unknown> {
	name: string;
	workflowPath: string;
	arguments?: CommandArgument[];
	postExecution(ctx: PostExecutionContext<TPayload>): Promise<PostExecutionResult>;
}

export interface CommandInfo {
	name: string;
	arguments: ResolvedCommandArgument[];
}

export async function getCommandInfos(kv: KVNamespace): Promise<CommandInfo[]> {
	return Promise.all(commands.map(async cmd => ({
		name: cmd.name,
		arguments: await Promise.all((cmd.arguments ?? []).map(async arg => ({
			name: arg.name,
			label: arg.label,
			options: await arg.options(kv),
		}))),
	})));
}

const commands: Command<any>[] = [
	createInstance,
	fixCs,
];

export const commandRegistry = new Map<string, Command<any>>(
	commands.map(cmd => [cmd.name, cmd])
);

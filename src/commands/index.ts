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
	prNumber: number;
	args: string[];
}

export interface PostExecutionContext<TPayload> {
	octo: Octokit;
	execution: ExecutionContext;
	payload: TPayload;
}

export interface PostExecutionResult {
	status: 'completed' | 'failed';
}

export interface Command<TPayload = unknown> {
	name: string;
	workflowPath: string;
	postExecution(ctx: PostExecutionContext<TPayload>): Promise<PostExecutionResult>;
}

const commands: Command<any>[] = [
	fixCs,
	createInstance,
];

export const commandRegistry = new Map<string, Command<any>>(
	commands.map(cmd => [cmd.name, cmd])
);

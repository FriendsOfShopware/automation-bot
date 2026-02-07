import { ExecutionContext } from "./commands";

export interface ExecutionRow {
	id: string;
	command: string;
	status: string;
	repository_id: number;
	head_owner: string;
	head_repo: string;
	head_branch: string;
	head_sha: string;
	base_owner: string;
	base_repo: string;
	pr_number: number | null;
	args: string | null;
	triggered_by: string;
	trigger_source: string;
	result: string | null;
	created_at: string;
	completed_at: string | null;
}

export function rowToExecutionContext(row: ExecutionRow): ExecutionContext {
	return {
		id: row.id,
		command: row.command,
		headOwner: row.head_owner,
		headRepo: row.head_repo,
		headBranch: row.head_branch,
		headSha: row.head_sha,
		baseOwner: row.base_owner,
		baseRepo: row.base_repo,
		prNumber: row.pr_number,
		args: row.args ? JSON.parse(row.args) : {},
	};
}

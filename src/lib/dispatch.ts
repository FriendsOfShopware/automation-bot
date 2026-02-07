import { getOctoClient } from "./github";
import { commandRegistry } from "./commands";

interface DispatchParams {
	env: Env;
	commandName: string;
	pr: {
		repositoryId: number;
		headOwner: string;
		headRepo: string;
		headBranch: string;
		headSha: string;
		baseOwner: string;
		baseRepo: string;
	};
	prNumber: number | null;
	args: Record<string, string>;
	triggeredBy?: string;
	triggerSource?: 'dashboard' | 'webhook' | 'api' | 'unknown';
}

export async function dispatchCommand(params: DispatchParams): Promise<string> {
	const { env, commandName, pr, prNumber, args, triggeredBy = 'unknown', triggerSource = 'unknown' } = params;

	const command = commandRegistry.get(commandName);
	if (!command) {
		throw new Error(`Unknown command: ${commandName}`);
	}

	const octo = getOctoClient(env);

	const workflows = await octo.request('GET /repos/{owner}/{repo}/actions/workflows', {
		owner: 'FriendsOfShopware',
		repo: 'automation-bot',
	});

	const workflowId = workflows.data.workflows.find(w => w.path === command.workflowPath)?.id;
	if (!workflowId) {
		throw new Error(`Workflow not found for command: ${commandName}`);
	}

	const uuid = crypto.randomUUID();

	await env.kv.put(uuid, JSON.stringify({
		repository_id: pr.repositoryId,
	}), { expirationTtl: 10 * 60 });

	await env.db.prepare(`
		INSERT INTO executions (id, command, status, repository_id, head_owner, head_repo, head_branch, head_sha, base_owner, base_repo, pr_number, args, triggered_by, trigger_source)
		VALUES (?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`).bind(
		uuid,
		commandName,
		pr.repositoryId,
		pr.headOwner,
		pr.headRepo,
		pr.headBranch,
		pr.headSha,
		pr.baseOwner,
		pr.baseRepo,
		prNumber,
		Object.keys(args).length > 0 ? JSON.stringify(args) : null,
		triggeredBy,
		triggerSource,
	).run();

	await octo.request('POST /repos/{owner}/{repo}/actions/workflows/{workflow_id}/dispatches', {
		owner: 'FriendsOfShopware',
		repo: 'automation-bot',
		workflow_id: workflowId,
		ref: 'main',
		inputs: {
			id: uuid,
		},
	});

	return uuid;
}

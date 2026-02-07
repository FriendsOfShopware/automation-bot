export interface Session {
	userId: number;
	login: string;
	avatarUrl: string;
}

export interface CommandArgument {
	name: string;
	label: string;
	options: string[];
}

export interface CommandInfo {
	name: string;
	arguments: CommandArgument[];
}

export interface Repo {
	full_name: string;
	name: string;
	default_branch: string;
}

export interface Pull {
	number: number;
	title: string;
}

export interface Branch {
	name: string;
}

export interface Execution {
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

export interface DispatchPayload {
	command: string;
	repo: string;
	mode: 'pr' | 'ref';
	pr?: number;
	ref?: string;
	args?: Record<string, string>;
}

export interface DispatchResult {
	success: boolean;
	message?: string;
	error?: string;
}

async function fetchJSON<T>(url: string, opts?: RequestInit): Promise<T> {
	const resp = await fetch(url, opts);
	if (resp.status === 401) {
		const path = window.location.pathname;
		if (path !== '/login' && !path.startsWith('/auth/')) {
			window.location.href = '/login';
		}
		throw new Error('Unauthorized');
	}
	return resp.json();
}

export async function getSession(): Promise<Session> {
	return fetchJSON('/api/session');
}

export async function getCommands(): Promise<CommandInfo[]> {
	return fetchJSON('/api/commands');
}

export async function getRepos(): Promise<Repo[]> {
	return fetchJSON('/api/repos');
}

export async function getPulls(owner: string, repo: string): Promise<Pull[]> {
	return fetchJSON(`/api/repos/${owner}/${repo}/pulls`);
}

export async function getBranches(owner: string, repo: string): Promise<Branch[]> {
	return fetchJSON(`/api/repos/${owner}/${repo}/branches`);
}

export async function getExecutions(): Promise<Execution[]> {
	return fetchJSON('/api/executions');
}

export interface KanbanLabel {
	name: string;
	color: string;
}

export interface KanbanItem {
	id: number;
	number: number;
	title: string;
	isPullRequest: boolean;
	authorLogin: string;
	authorAvatarUrl: string | null;
	labels: KanbanLabel[];
	createdAt: string;
	updatedAt: string;
}

export interface KanbanColumn {
	repo: { id: number; full_name: string; name: string };
	items: KanbanItem[];
}

export interface KanbanRepoMeta {
	id: number;
	full_name: string;
	name: string;
	openCount: number;
	lastUpdatedAt: string | null;
	mineCount: number;
}

export async function getKanbanRepos(): Promise<KanbanRepoMeta[]> {
	return fetchJSON('/api/kanban/repos');
}

export async function getKanban(repoIds?: number[]): Promise<KanbanColumn[]> {
	const params = new URLSearchParams();
	if (repoIds && repoIds.length) {
		params.set('repoIds', repoIds.join(','));
	}
	const qs = params.toString();
	return fetchJSON(`/api/kanban${qs ? `?${qs}` : ''}`);
}

export async function triggerSync(): Promise<void> {
	await fetchJSON('/api/sync', { method: 'POST' });
}

export async function dispatch(payload: DispatchPayload): Promise<DispatchResult> {
	return fetchJSON('/api/dispatch', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(payload),
	});
}

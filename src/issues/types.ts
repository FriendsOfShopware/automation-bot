// Types for GitHub issues sync

export interface GitHubIssueRow {
	id: number;
	node_id: string;
	number: number;
	title: string;
	body: string | null;
	state: string;
	state_reason: string | null;
	locked: number;
	comments_count: number;
	created_at: string;
	updated_at: string;
	closed_at: string | null;
	author_login: string | null;
	author_avatar_url: string | null;
	author_association: string | null;
	repository_id: number;
	repository_owner: string;
	repository_name: string;
	repository_full_name: string;
	labels: string | null; // JSON array of label names
	assignees: string | null; // JSON array of assignee logins
	milestone_id: number | null;
	milestone_title: string | null;
	is_pull_request: number;
	html_url: string;
	reactions_total: number;
	synced_at: string;
}

export interface GitHubSyncStatusRow {
	repository_full_name: string;
	last_synced_at: string;
	issues_count: number;
	open_issues_count: number;
	error: string | null;
}

export interface GitHubIssueFromAPI {
	id: number;
	node_id: string;
	number: number;
	title: string;
	body: string | null;
	state: string;
	state_reason?: string | null;
	locked: boolean;
	comments: number;
	created_at: string;
	updated_at: string;
	closed_at: string | null;
	user: {
		login: string;
		avatar_url: string;
	} | null;
	author_association: string;
	labels: Array<{ name: string }>;
	assignees: Array<{ login: string }>;
	milestone: {
		id: number;
		title: string;
	} | null;
	pull_request?: unknown;
	html_url: string;
	reactions?: {
		total_count: number;
	};
	repository?: {
		id: number;
		owner: { login: string };
		name: string;
		full_name: string;
	};
}

export interface GitHubRepository {
	id: number;
	name: string;
	full_name: string;
	owner: {
		login: string;
	};
	open_issues_count: number;
	archived: boolean;
	disabled: boolean;
}

// Queue message for repository sync
export interface RepoSyncMessage {
	repo: GitHubRepository;
}

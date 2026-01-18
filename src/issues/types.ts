// Types for GitHub issues sync
// Note: Database row types are now provided by Drizzle schema (see src/db/schema.ts)

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

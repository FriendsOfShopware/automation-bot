-- Migration: Create github_issues table
-- Description: Store GitHub issues from FriendsOfShopware repositories for dashboard

CREATE TABLE github_issues (
	id INTEGER PRIMARY KEY,
	node_id TEXT NOT NULL UNIQUE,
	number INTEGER NOT NULL,
	title TEXT NOT NULL,
	body TEXT,
	state TEXT NOT NULL,
	state_reason TEXT,
	locked INTEGER NOT NULL DEFAULT 0,
	comments_count INTEGER NOT NULL DEFAULT 0,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL,
	closed_at TEXT,
	author_login TEXT,
	author_avatar_url TEXT,
	author_association TEXT,
	repository_id INTEGER NOT NULL,
	repository_owner TEXT NOT NULL,
	repository_name TEXT NOT NULL,
	repository_full_name TEXT NOT NULL,
	labels TEXT,
	assignees TEXT,
	milestone_id INTEGER,
	milestone_title TEXT,
	is_pull_request INTEGER NOT NULL DEFAULT 0,
	html_url TEXT NOT NULL,
	reactions_total INTEGER NOT NULL DEFAULT 0,
	synced_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_github_issues_repository ON github_issues(repository_full_name);
CREATE INDEX idx_github_issues_state ON github_issues(state);
CREATE INDEX idx_github_issues_created_at ON github_issues(created_at);
CREATE INDEX idx_github_issues_updated_at ON github_issues(updated_at);
CREATE INDEX idx_github_issues_author ON github_issues(author_login);
CREATE INDEX idx_github_issues_repo_state ON github_issues(repository_full_name, state);

-- Table to track sync status per repository
CREATE TABLE github_sync_status (
	repository_full_name TEXT PRIMARY KEY,
	last_synced_at TEXT NOT NULL,
	issues_count INTEGER NOT NULL DEFAULT 0,
	open_issues_count INTEGER NOT NULL DEFAULT 0,
	error TEXT
);

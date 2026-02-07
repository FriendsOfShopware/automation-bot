CREATE TABLE github_issues (
    id INTEGER PRIMARY KEY,
    repo_id INTEGER NOT NULL,
    number INTEGER NOT NULL,
    title TEXT NOT NULL,
    state TEXT NOT NULL DEFAULT 'open',
    is_pull_request INTEGER NOT NULL DEFAULT 0,
    author_login TEXT NOT NULL,
    author_avatar_url TEXT,
    labels TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(repo_id, number)
);

CREATE INDEX idx_github_issues_repo_state ON github_issues(repo_id, state);

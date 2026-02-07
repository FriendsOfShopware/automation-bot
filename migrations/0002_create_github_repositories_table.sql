CREATE TABLE github_repositories (
	id INTEGER PRIMARY KEY,
	full_name TEXT NOT NULL UNIQUE,
	name TEXT NOT NULL,
	default_branch TEXT NOT NULL,
	topics TEXT NOT NULL DEFAULT '[]',
	archived INTEGER NOT NULL DEFAULT 0
);

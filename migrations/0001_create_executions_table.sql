-- Migration: Create executions table
-- Description: Store workflow execution context and results

CREATE TABLE executions (
	id TEXT PRIMARY KEY,
	command TEXT NOT NULL,
	status TEXT DEFAULT 'pending',
	repository_id INTEGER NOT NULL,
	head_owner TEXT NOT NULL,
	head_repo TEXT NOT NULL,
	head_branch TEXT NOT NULL,
	head_sha TEXT NOT NULL,
	base_owner TEXT NOT NULL,
	base_repo TEXT NOT NULL,
	pr_number INTEGER,
	args TEXT,
	result TEXT,
	created_at TEXT DEFAULT CURRENT_TIMESTAMP,
	completed_at TEXT
);

CREATE INDEX idx_executions_status ON executions(status);
CREATE INDEX idx_executions_repository_id ON executions(repository_id);
CREATE INDEX idx_executions_created_at ON executions(created_at);

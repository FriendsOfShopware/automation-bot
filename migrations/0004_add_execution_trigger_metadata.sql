ALTER TABLE executions ADD COLUMN triggered_by TEXT NOT NULL DEFAULT 'unknown';
ALTER TABLE executions ADD COLUMN trigger_source TEXT NOT NULL DEFAULT 'unknown';

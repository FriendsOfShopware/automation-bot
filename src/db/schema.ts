import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// Executions table - stores workflow execution context and results
export const executions = sqliteTable('executions', {
	id: text('id').primaryKey(),
	command: text('command').notNull(),
	status: text('status').default('pending'),
	repositoryId: integer('repository_id').notNull(),
	headOwner: text('head_owner').notNull(),
	headRepo: text('head_repo').notNull(),
	headBranch: text('head_branch').notNull(),
	headSha: text('head_sha').notNull(),
	baseOwner: text('base_owner').notNull(),
	baseRepo: text('base_repo').notNull(),
	prNumber: integer('pr_number'),
	args: text('args'),
	result: text('result'),
	createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
	completedAt: text('completed_at'),
}, (table) => [
	index('idx_executions_status').on(table.status),
	index('idx_executions_repository_id').on(table.repositoryId),
	index('idx_executions_created_at').on(table.createdAt),
]);

// GitHub issues table - stores issues from FriendsOfShopware repositories
export const githubIssues = sqliteTable('github_issues', {
	id: integer('id').primaryKey(),
	nodeId: text('node_id').notNull().unique(),
	number: integer('number').notNull(),
	title: text('title').notNull(),
	body: text('body'),
	state: text('state').notNull(),
	stateReason: text('state_reason'),
	locked: integer('locked', { mode: 'boolean' }).notNull().default(false),
	commentsCount: integer('comments_count').notNull().default(0),
	createdAt: text('created_at').notNull(),
	updatedAt: text('updated_at').notNull(),
	closedAt: text('closed_at'),
	authorLogin: text('author_login'),
	authorAvatarUrl: text('author_avatar_url'),
	authorAssociation: text('author_association'),
	repositoryId: integer('repository_id').notNull(),
	repositoryOwner: text('repository_owner').notNull(),
	repositoryName: text('repository_name').notNull(),
	repositoryFullName: text('repository_full_name').notNull(),
	labels: text('labels'), // JSON array of label names
	assignees: text('assignees'), // JSON array of assignee logins
	milestoneId: integer('milestone_id'),
	milestoneTitle: text('milestone_title'),
	isPullRequest: integer('is_pull_request', { mode: 'boolean' }).notNull().default(false),
	htmlUrl: text('html_url').notNull(),
	reactionsTotal: integer('reactions_total').notNull().default(0),
	syncedAt: text('synced_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
	index('idx_github_issues_repository').on(table.repositoryFullName),
	index('idx_github_issues_state').on(table.state),
	index('idx_github_issues_created_at').on(table.createdAt),
	index('idx_github_issues_updated_at').on(table.updatedAt),
	index('idx_github_issues_author').on(table.authorLogin),
	index('idx_github_issues_repo_state').on(table.repositoryFullName, table.state),
]);

// GitHub sync status table - tracks sync status per repository
export const githubSyncStatus = sqliteTable('github_sync_status', {
	repositoryFullName: text('repository_full_name').primaryKey(),
	lastSyncedAt: text('last_synced_at').notNull(),
	issuesCount: integer('issues_count').notNull().default(0),
	openIssuesCount: integer('open_issues_count').notNull().default(0),
	error: text('error'),
});

// Type exports for use in other files
export type Execution = typeof executions.$inferSelect;
export type NewExecution = typeof executions.$inferInsert;
export type GitHubIssue = typeof githubIssues.$inferSelect;
export type NewGitHubIssue = typeof githubIssues.$inferInsert;
export type GitHubSyncStatus = typeof githubSyncStatus.$inferSelect;
export type NewGitHubSyncStatus = typeof githubSyncStatus.$inferInsert;

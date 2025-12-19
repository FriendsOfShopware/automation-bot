# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

FriendsOfShopware Automation Bot - A Cloudflare Workers application that orchestrates GitHub Actions workflows for Shopware plugin development. It listens to GitHub webhook events (PR issue comments) and dispatches workflows based on bot commands.

## Development Commands

```bash
npm run dev          # Start local development server with Wrangler
npm test             # Run tests with Vitest
npm run deploy       # Deploy to Cloudflare Workers
npm run cf-typegen   # Generate Cloudflare Worker environment types
```

## Architecture

### Main Entry Point

`/src/index.ts` - Single file Hono web application with three endpoints:

1. **POST /webhook** - GitHub webhook receiver
   - Validates HMAC signature, processes `issue_comment.created` events
   - Filters by author association (collaborators/members/owners only)
   - Commands: `@frosh-automation fix-cs` or `@frosh-automation create-instance`
   - Stores execution context in KV (10 min TTL), dispatches GitHub workflow

2. **POST /api/token/generate/:id** - Token generation for workflows
   - Validates GitHub Actions OIDC token
   - Returns scoped GitHub app access token (contents:write for specific repo)

3. **POST /api/token/delete/:id** - Token cleanup
   - Cleans up tokens and KV storage after workflow completion

### Custom GitHub Action

`/actions/fetch-token/` - Node.js action used by dispatched workflows:
- `main.ts`: Exchanges OIDC token for GitHub app token via the API
- `post.ts`: Cleanup script to revoke token

### Dispatched Workflows

- `.github/workflows/csfixer.yml` - Runs PHP-CS-Fixer on PRs
- `.github/workflows/instance.yml` - Creates ephemeral Shopware dev instances

## Environment Configuration

Requires these secrets (configured via Wrangler):
- `APP_ID`, `PRIVATE_KEY`, `INSTALLATION_ID`, `WEBHOOK_SECRET` - GitHub App credentials
- Cloudflare KV namespace binding for temporary state storage

## Code Style

- Tabs for indentation, single quotes, 140 char print width (see `.prettierrc`)
- TypeScript strict mode, ES2021 target

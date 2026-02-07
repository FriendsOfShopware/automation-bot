# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

FriendsOfShopware Automation Bot - A Cloudflare Workers application that orchestrates GitHub Actions workflows for Shopware plugin development. It listens to GitHub webhook events (PR issue comments) and dispatches workflows based on bot commands. Includes a Vue 3 SPA dashboard for manual command dispatch.

## Development Commands

```bash
npm run dev          # Start Wrangler dev server (backend)
npm run dev:frontend # Start Vite dev server (frontend, proxies API to :8787)
npm run build        # Build frontend (Vite) then backend (Hono/CF Workers)
npm run deploy       # Build + deploy to Cloudflare Workers
npm run cf-typegen   # Generate Cloudflare Worker environment types
```

## Architecture

### Backend (`src/`)

**Entry point:** `src/index.ts` — Hono app with route registration.

**Public routes (no auth):**
- `POST /webhook` — GitHub webhook receiver
- `POST /api/token/generate/:id` — OIDC token exchange for workflows
- `POST /api/token/delete/:id` — Token cleanup
- `POST /api/report/:id` — Execution report from workflows

**Auth routes (session middleware, no auth guard):**
- `GET /auth/login` — GitHub OAuth redirect
- `GET /auth/callback` — OAuth callback
- `GET /auth/logout` — Session destroy

**Protected API routes (session + auth guard):**
- `GET /api/session` — Current user info
- `GET /api/commands` — Available commands
- `GET /api/repos` — Repository list (KV-cached)
- `GET /api/repos/:owner/:repo/pulls` — Open PRs
- `GET /api/repos/:owner/:repo/branches` — Branches
- `GET /api/executions` — Recent executions
- `POST /api/dispatch` — Dispatch a command (JSON body)

**Lib files:** `src/lib/` — GitHub client, dispatch logic, commands, execution helpers, OIDC auth.

### Frontend (`frontend/`)

Vue 3 SPA with Vue Router, built with Vite. Uses Tailwind CSS + DaisyUI for styling, vue-select for searchable dropdowns.

- `frontend/src/pages/Login.vue` — Login page
- `frontend/src/pages/Dashboard.vue` — Dispatch form + execution table with 5s polling
- `frontend/src/components/` — Navbar, DispatchForm, ExecutionTable
- `frontend/src/api.ts` — Typed fetch wrappers for all API endpoints

### Custom GitHub Action

`/actions/fetch-token/` — Node.js action used by dispatched workflows.

### Dispatched Workflows

- `.github/workflows/csfixer.yml` — Runs PHP-CS-Fixer on PRs
- `.github/workflows/instance.yml` — Creates ephemeral Shopware dev instances

## Environment Configuration

Requires these secrets (configured via Wrangler):
- `GITHUB_APP_ID`, `GITHUB_PRIVATE_KEY`, `GITHUB_INSTALLATION_ID`, `GITHUB_WEBHOOK_SECRET` — GitHub App credentials
- `GITHUB_OAUTH_CLIENT_ID`, `GITHUB_OAUTH_CLIENT_SECRET` — GitHub OAuth App
- `AUTH_SECRET` — Session encryption key
- Cloudflare KV namespace binding (`kv`) and D1 database binding (`db`)

## Code Style

- Tabs for indentation, single quotes, 140 char print width (see `.prettierrc`)
- TypeScript strict mode, ES2021 target

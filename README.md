# FriendsOfShopware Automation Bot

A Cloudflare Workers application that orchestrates GitHub Actions workflows for Shopware plugin development via PR comments.

## Usage

Comment on a pull request with one of the following commands:

### `@frosh-automation fix-cs`

Runs PHP-CS-Fixer on the pull request branch and commits any fixes.

### `@frosh-automation create-instance [shopware-version]`

Creates an ephemeral Shopware instance with the plugin from the PR installed.

| Parameter | Description | Default |
|-----------|-------------|---------|
| `shopware-version` | Shopware version to use (e.g., `6.6.8`, `6.5.0`) | `6.6.8` |

**Examples:**
```
@frosh-automation create-instance
@frosh-automation create-instance 6.5.0
```

## Development

```bash
npm install
npm run dev      # Start local dev server
npm test         # Run tests
npm run deploy   # Deploy to Cloudflare Workers
```

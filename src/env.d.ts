// Secrets not in wrangler.jsonc but required at runtime
declare namespace Cloudflare {
	interface Env {
		GITHUB_APP_ID: string;
		GITHUB_PRIVATE_KEY: string;
		GITHUB_INSTALLATION_ID: string;
		GITHUB_WEBHOOK_SECRET: string;
		GITHUB_OAUTH_CLIENT_ID: string;
		GITHUB_OAUTH_CLIENT_SECRET: string;
		AUTH_SECRET: string;
	}
}

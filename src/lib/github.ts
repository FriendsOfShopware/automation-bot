import { createAppAuth } from "@octokit/auth-app";
import { Octokit } from "@octokit/core";

export function getOctoClient(env: Env) {
	return new Octokit({
		authStrategy: createAppAuth,
		auth: {
			appId: env.GITHUB_APP_ID,
			privateKey: env.GITHUB_PRIVATE_KEY,
			installationId: env.GITHUB_INSTALLATION_ID,
		},
	})
}

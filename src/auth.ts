import { parseJwt, getKey } from "@cfworker/jwt";

export async function validateOidcToken(authHeader: string | undefined): Promise<{ valid: boolean; error?: string }> {
	if (!authHeader) {
		return { valid: false, error: 'Authorization header is missing' };
	}

	const check = await parseJwt({
		jwt: authHeader,
		audience: 'github-bot.fos.gg',
		issuer: 'https://token.actions.githubusercontent.com',
		resolveKey: async (key) => await getKey(key)
	});

	if (!check.valid) {
		return { valid: false, error: 'Invalid token' };
	}

	const payload = check.payload as unknown as { actor: string };

	if (payload.actor !== 'frosh-automation[bot]') {
		return { valid: false, error: 'Invalid actor' };
	}

	return { valid: true };
}

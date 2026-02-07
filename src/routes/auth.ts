import { Hono } from 'hono/tiny';
import { setCookie, getCookie, deleteCookie } from 'hono/cookie';
import type { DashboardEnv } from '../middleware/session';

const auth = new Hono<DashboardEnv>();

auth.get('/login', (c) => {
	const state = crypto.randomUUID();
	setCookie(c, '__oauth_state', state, { path: '/', httpOnly: true, secure: true, sameSite: 'Lax', maxAge: 600 });
	const params = new URLSearchParams({
		client_id: c.env.GITHUB_OAUTH_CLIENT_ID,
		redirect_uri: `https://dash.fos.gg/auth/callback`,
		scope: 'read:org',
		state,
	});
	return c.redirect(`https://github.com/login/oauth/authorize?${params}`);
});

auth.get('/callback', async (c) => {
	const code = c.req.query('code');
	const state = c.req.query('state');
	const expectedState = getCookie(c, '__oauth_state');

	if (!code || !state || state !== expectedState) {
		return c.json({ error: 'Invalid OAuth state. Please try again.' }, 400);
	}

	deleteCookie(c, '__oauth_state', { path: '/' });

	// Exchange code for access token
	const tokenResp = await fetch('https://github.com/login/oauth/access_token', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
		body: JSON.stringify({
			client_id: c.env.GITHUB_OAUTH_CLIENT_ID,
			client_secret: c.env.GITHUB_OAUTH_CLIENT_SECRET,
			code,
		}),
	});

	const tokenData = await tokenResp.json<{ access_token?: string; error?: string }>();
	if (!tokenData.access_token) {
		return c.json({ error: 'Failed to obtain access token.' }, 400);
	}

	const accessToken = tokenData.access_token;

	// Fetch user info
	const userResp = await fetch('https://api.github.com/user', {
		headers: { 'Authorization': `Bearer ${accessToken}`, 'User-Agent': 'frosh-automation-dashboard' },
	});
	const user = await userResp.json<{ id: number; login: string; avatar_url: string }>();

	// Check org membership
	const orgResp = await fetch(`https://api.github.com/orgs/FriendsOfShopware/members/${user.login}`, {
		headers: { 'Authorization': `Bearer ${accessToken}`, 'User-Agent': 'frosh-automation-dashboard' },
	});

	if (orgResp.status !== 204) {
		return c.json({ error: 'You must be a member of the FriendsOfShopware organization.' }, 403);
	}

	await c.var.session.update(() => ({
		userId: user.id,
		login: user.login,
		avatarUrl: user.avatar_url,
	}));

	return c.redirect('/');
});

auth.get('/logout', (c) => {
	c.var.session.delete();
	return c.redirect('/login');
});

export default auth;

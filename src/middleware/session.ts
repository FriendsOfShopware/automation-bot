import { useSession, type SessionEnv } from '@hono/session';
import { createMiddleware } from 'hono/factory';

export type UserSession = {
	userId: number;
	login: string;
	avatarUrl: string;
	[key: string]: unknown;
};

export type DashboardEnv = SessionEnv<UserSession> & {
	Bindings: Env;
};

export const sessionMiddleware = useSession<UserSession>({
	duration: { absolute: 86400 },
});

export const authGuard = createMiddleware<DashboardEnv>(async (c, next) => {
	if (c.req.path.startsWith('/auth/')) {
		return next();
	}

	const data = await c.var.session.get();
	if (!data || !('userId' in data)) {
		if (c.req.path.startsWith('/api/')) {
			return c.json({ error: 'Unauthorized' }, 401);
		}
		return c.redirect('/auth/login');
	}

	c.set('sessionData' as never, data as never);
	return next();
});

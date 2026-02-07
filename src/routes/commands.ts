import { Hono } from 'hono/tiny';
import { getCommandInfos } from '../lib/commands';
import type { DashboardEnv } from '../middleware/session';

const commands = new Hono<DashboardEnv>();

commands.get('/', async (c) => {
	return c.json(await getCommandInfos(c.env.kv));
});

export default commands;

import build from '@hono/vite-build/cloudflare-workers';
import { defineConfig } from 'vite';

export default defineConfig({
	ssr: {
		external: ['fast-content-type-parse'],
	},
	plugins: [
		build({
			entry: './src/index.ts',
		}),
	],
});

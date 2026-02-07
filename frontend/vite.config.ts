import vue from '@vitejs/plugin-vue';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	root: __dirname,
	build: {
		outDir: '../dist/frontend',
		emptyOutDir: true,
	},
	plugins: [vue(), tailwindcss()],
	server: {
		proxy: {
			'/api': 'http://localhost:8787',
			'/auth': 'http://localhost:8787',
			'/webhook': 'http://localhost:8787',
		},
	},
});

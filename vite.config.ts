import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [react()],
	resolve: {
		alias: {
			'@db': path.resolve(import.meta.dirname, 'db'),
			'@': path.resolve(import.meta.dirname, 'client', 'src'),
			'@shared': path.resolve(import.meta.dirname, 'shared'),
			'@assets': path.resolve(import.meta.dirname, 'attached_assets'),
		},
	},
	server: {
		proxy: {
			'/api': 'http://localhost:5000',
		},
	},
	root: path.resolve(import.meta.dirname, 'client'),
	build: {
		outDir: path.resolve(import.meta.dirname, 'dist/public'),
		emptyOutDir: true,
	},
	// Expose environment variables starting with VITE_
	define: {
		'import.meta.env.VITE_TINYMCE_API_KEY': JSON.stringify(
			process.env.VITE_TINYMCE_API_KEY
		),
	},
});

import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

// Get root directory for cross-platform compatibility
const rootDir = process.cwd();

export default defineConfig({
	plugins: [react()],
	resolve: {
		alias: {
			'@db': path.resolve(rootDir, 'db'),
			'@': path.resolve(rootDir, 'client', 'src'),
			'@shared': path.resolve(rootDir, 'shared'),
			'@assets': path.resolve(rootDir, 'attached_assets'),
		},
	},
	server: {
		proxy: {
			'/api': 'http://localhost:5000',
		},
	},
	root: path.resolve(rootDir, 'client'),
	build: {
		outDir: path.resolve(rootDir, 'dist/public'),
		emptyOutDir: true,
	},
	// Expose environment variables starting with VITE_
	define: {
		'import.meta.env.VITE_TINYMCE_API_KEY': JSON.stringify(
			process.env.VITE_TINYMCE_API_KEY
		),
	},
});

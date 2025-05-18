import express, { NextFunction, type Request, Response } from 'express';
import path from 'path';
import { connectDB } from '../db/mongodb';
import { registerRoutes } from './routes';
import { log, serveStatic, setupVite } from './vite';

// Set MongoDB URI yang Anda berikan
process.env.MONGODB_URI =
	'mongodb+srv://recipesDB:4434@recipesdb.pjmdt.mongodb.net/?retryWrites=true&w=majority&appName=recipesDB';

// Karena kita menggunakan MongoDB, pastikan DISABLE_MONGODB dinonaktifkan
process.env.DISABLE_MONGODB = 'false';

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Tambahkan middleware static agar file upload bisa diakses publik
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));
app.use(
	'/attached_assets',
	express.static(path.join(process.cwd(), 'attached_assets'))
);

app.use((req, res, next) => {
	const start = Date.now();
	const path = req.path;
	let capturedJsonResponse: Record<string, any> | undefined = undefined;

	const originalResJson = res.json;
	res.json = function (bodyJson, ...args) {
		capturedJsonResponse = bodyJson;
		return originalResJson.apply(res, [bodyJson, ...args]);
	};

	res.on('finish', () => {
		const duration = Date.now() - start;
		if (path.startsWith('/api')) {
			let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
			if (capturedJsonResponse) {
				logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
			}

			if (logLine.length > 80) {
				logLine = logLine.slice(0, 79) + '…';
			}

			log(logLine);
		}
	});

	next();
});

(async () => {
	// Connect to MongoDB
	try {
		await connectDB();
		// Nota: connectDB sekarang mengembalikan false jika gagal, tapi tidak melempar error
		// karena kita mau fallback ke PostgreSQL
	} catch (error) {
		console.error('Error saat inisialisasi database:', error);
		process.exit(1);
	}

	const server = await registerRoutes(app);

	app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
		const status = err.status || err.statusCode || 500;
		const message = err.message || 'Internal Server Error';

		res.status(status).json({ message });
		throw err;
	});

	// importantly only setup vite in development and after
	// setting up all the other routes so the catch-all route
	// doesn't interfere with the other routes
	if (app.get('env') === 'development') {
		await setupVite(app, server);
	} else {
		serveStatic(app);
	}

	// ALWAYS serve the app on port 5000
	// this serves both the API and the client.
	// It is the only port that is not firewalled.
	const port = 5000;
	server.listen(
		{
			port,
			host: '0.0.0.0',
			reusePort: true,
		},
		() => {
			log(`serving on port ${port}`);
		}
	);
})();

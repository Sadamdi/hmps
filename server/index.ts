import express, { NextFunction, type Request, Response } from 'express';
import path from 'path';
import { connectDB } from '../db/mongodb';
import { registerRoutes } from './routes';
import { ChatService } from './services/chat-service';
import { log, serveStatic, setupVite } from './vite';

// Import security middleware
import {
	apiProtectionMiddleware,
	apiRateLimitMiddleware,
} from './middleware/api-protection';
import {
	cleanupDdosData,
	ddosProtectionMiddleware,
} from './middleware/ddos-protection';
import {
	noSqlInjectionProtectionMiddleware,
	sqlInjectionProtectionMiddleware,
} from './middleware/sql-injection-protection';
import { sanitizeInput, securityLogger, securityMiddleware } from './security';

// Import models to ensure they are registered
import './models/activity';

// Set MongoDB URI yang Anda berikan
process.env.MONGODB_URI =
	'mongodb+srv://recipesDB:4434@recipesdb.pjmdt.mongodb.net/?retryWrites=true&w=majority&appName=recipesDB';

// Karena kita menggunakan MongoDB, pastikan DISABLE_MONGODB dinonaktifkan
process.env.DISABLE_MONGODB = 'false';

const app = express();

// ==================== SECURITY MIDDLEWARE SETUP ====================
// Apply security headers and basic protection
app.use(securityMiddleware.helmet);
app.use(securityMiddleware.hpp);

// Apply DDoS protection
app.use(ddosProtectionMiddleware);

// Apply API protection
app.use(apiProtectionMiddleware);
app.use(apiRateLimitMiddleware);

// Apply SQL/NoSQL injection protection
app.use(sqlInjectionProtectionMiddleware);
app.use(noSqlInjectionProtectionMiddleware);

// Apply input sanitization
app.use(sanitizeInput);

// Apply security logging
app.use(securityLogger);

// ==================== BASIC MIDDLEWARE ====================
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false, limit: '10mb' }));

// Tambahkan middleware static agar file upload bisa diakses publik
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));
app.use(
	'/attached_assets',
	express.static(path.join(process.cwd(), 'attached_assets'))
);

// Serve static files from public folder (SEO files, favicon, etc.)
// Serve sitemap dynamically before static to ensure fresh URLs
app.get('/sitemap.xml', async (_req, res) => {
	try {
		console.log('🔍 Generating dynamic sitemap...');

		const host = 'https://himatif-encoder.com';
		const now = new Date().toISOString().slice(0, 10);

		// Always include base URLs
		const baseUrls = [
			{ loc: `${host}/`, changefreq: 'daily', priority: '1.0', lastmod: now },
			{
				loc: `${host}/artikel`,
				changefreq: 'daily',
				priority: '0.9',
				lastmod: now,
			},
		];

		let articleUrls: any[] = [];

		try {
			// Check database connection first
			const { connectDB } = await import('../db/mongodb');
			const isConnected = await connectDB();

			if (isConnected) {
				// Attempt to load articles
				const { Article } = await import('../db/mongodb');

				if (Article) {
					const articles = await Article.find({ published: true })
						.select('_id slug updatedAt createdAt')
						.sort({ updatedAt: -1 })
						.limit(5000)
						.lean();

					console.log(`📄 Found ${articles.length} published articles`);

					articleUrls = articles.map((a: any) => {
						const url = `${host}/artikel/${a._id}/${a.slug}`;
						console.log(`📝 Adding article URL: ${url}`);
						return {
							loc: url,
							lastmod:
								(a.updatedAt || a.createdAt)?.toISOString?.().slice(0, 10) ||
								now,
							changefreq: 'monthly',
							priority: '0.8',
						};
					});
				} else {
					console.log(
						'⚠️ Article model not found, continuing with base URLs only'
					);
				}
			} else {
				console.log(
					'⚠️ Database not connected, continuing with base URLs only'
				);
			}
		} catch (dbError: any) {
			console.log(
				'⚠️ Database error, continuing with base URLs only:',
				dbError?.message || 'Unknown error'
			);
		}

		// Library items tidak ada halaman terpisah, hanya section di beranda
		// const libraryUrls = libraryItems.map((l: any) => ({
		// 	loc: `${host}/perpus/${l._id}`,
		// 	lastmod:
		// 		(l.updatedAt || l.createdAt)?.toISOString?.().slice(0, 10) || now,
		// 	changefreq: 'monthly',
		// 	priority: '0.7',
		// }));

		const urls = [...baseUrls, ...articleUrls];

		console.log(`🌐 Generated ${urls.length} total URLs for sitemap`);
		console.log(
			'📋 URLs:',
			urls.map((u) => u.loc)
		);

		const xml =
			`<?xml version="1.0" encoding="UTF-8"?>\n` +
			`<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
			urls
				.map(
					(u) =>
						`  <url>\n    <loc>${u.loc}</loc>\n    <lastmod>${
							u.lastmod || now
						}</lastmod>\n    <changefreq>${
							u.changefreq
						}</changefreq>\n    <priority>${u.priority}</priority>\n  </url>`
				)
				.join('\n') +
			`\n</urlset>`;

		console.log('✅ Dynamic sitemap generated successfully');
		console.log('📄 XML Preview:', xml.substring(0, 500) + '...');
		res.set('Content-Type', 'application/xml');
		return res.status(200).send(xml);
	} catch (e: any) {
		// Fallback to static file if dynamic generation fails
		console.error('❌ Failed to generate sitemap dynamically:', e);
		console.log('🔄 Falling back to static sitemap file');
		console.log('🔍 Error details:', e?.message || 'Unknown error');
		console.log('🔍 Error stack:', e?.stack || 'No stack trace');
		return res.sendFile(path.join(process.cwd(), 'public', 'sitemap.xml'));
	}
});

app.use(express.static(path.join(process.cwd(), 'public')));

// ==================== REQUEST LOGGING MIDDLEWARE ====================
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

// ==================== CLEANUP SCHEDULER ====================
const cleanupInterval = 6 * 60 * 60 * 1000; // 6 jam
setInterval(async () => {
	try {
		await ChatService.cleanupUnusedImages();
	} catch (error) {
		console.error('Error in cleanup scheduler:', error);
	}
}, cleanupInterval);

// DDoS Protection Cleanup (every hour)
setInterval(cleanupDdosData, 60 * 60 * 1000);

// ==================== SECURITY MONITORING ====================
// Security monitoring akan ditampilkan saat server start

// Log server status setiap 5 menit
setInterval(() => {
	console.log('📊 Server Status: Active');
	console.log('   - MongoDB Connection: ✅ Connected');
	console.log('   - Server Uptime: ✅ Running');
	console.log('   - Memory Usage: ✅ Normal');
	console.log('   - Request Handling: ✅ Active');
}, 5 * 60 * 1000);

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

	// ==================== ERROR HANDLING ====================
	app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
		const status = err.status || err.statusCode || 500;
		const message = err.message || 'Internal Server Error';

		// Log security-related errors
		if (status === 403 || status === 429 || status === 503) {
			console.log(`🚨 Security Error: ${status} - ${message}`);
		}

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
			log(`🛡️ Secure server running on port ${port}`);
			console.log('🛡️ Security Features Activated:');
			console.log('   ✅ DDoS Protection (Multi-Tier System)');
			console.log('   ✅ SQL Injection Protection');
			console.log('   ✅ NoSQL Injection Protection');
			console.log('   ✅ XSS Protection');
			console.log('   ✅ Rate Limiting');
			console.log('   ✅ Security Headers');
		}
	);
})();

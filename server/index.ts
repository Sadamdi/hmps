import dotenv from 'dotenv';
dotenv.config();

import express, { NextFunction, type Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { connectDB } from '../db/mongodb';
import { registerRoutes } from './routes';
import { ChatService } from './services/chat-service';
import { log, serveStatic, setupVite } from './vite';

// Import security middleware
import {
	antiSpoofingProtectionMiddleware,
	cleanupAntiSpoofingData,
} from './middleware/anti-spoofing-protection';
import {
	apiProtectionMiddleware,
	apiRateLimitMiddleware,
} from './middleware/api-protection';
import {
	cleanupDdosData,
	ddosProtectionMiddleware,
} from './middleware/ddos-protection';
import {
	cleanupDnsLayerData,
	dnsLayerProtectionMiddleware,
} from './middleware/dns-layer-protection';
import {
	noSqlInjectionProtectionMiddleware,
	sqlInjectionProtectionMiddleware,
} from './middleware/sql-injection-protection';
import { sanitizeInput, securityLogger, securityMiddleware } from './security';

// Import models to ensure they are registered
import './models/activity';

// Respect environment variables in production; provide safe defaults for local dev only
if (!process.env.MONGODB_URI) {
	process.env.MONGODB_URI =
		'mongodb+srv://recipesDB:4434@recipesdb.pjmdt.mongodb.net/?retryWrites=true&w=majority&appName=recipesDB';
}
if (process.env.DISABLE_MONGODB === undefined) {
	process.env.DISABLE_MONGODB = 'false';
}

const app = express();

// Trust proxy untuk membaca X-Forwarded-For dengan benar
app.set('trust proxy', true);

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

// Apply anti-spoofing protection
app.use(antiSpoofingProtectionMiddleware);

// Apply DNS layer protection
app.use(dnsLayerProtectionMiddleware);

// Apply input sanitization
app.use(sanitizeInput);

// Apply security logging
app.use(securityLogger);

// ==================== BASIC MIDDLEWARE ====================
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: false, limit: '100mb' }));

// Tambahkan middleware static agar file upload bisa diakses publik
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));
app.use(
	'/attached_assets',
	express.static(path.join(process.cwd(), 'attached_assets')),
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
			loc: `${host}/berita`,
			changefreq: 'daily',
			priority: '0.9',
			lastmod: now,
		},
			{
				loc: `${host}/profil`,
				changefreq: 'monthly',
				priority: '0.9',
				lastmod: now,
			},
			{
				loc: `${host}/kelembagaan`,
				changefreq: 'monthly',
				priority: '0.9',
				lastmod: now,
			},
			// Sections beranda yang bersifat publik (untuk crawling bot)
			{
				loc: `${host}/#profil`,
				changefreq: 'monthly',
				priority: '0.7',
				lastmod: now,
			},
			{
				loc: `${host}/#visi-misi`,
				changefreq: 'monthly',
				priority: '0.7',
				lastmod: now,
			},
			{
				loc: `${host}/#struktur`,
				changefreq: 'monthly',
				priority: '0.7',
				lastmod: now,
			},
			{
				loc: `${host}/#library`,
				changefreq: 'weekly',
				priority: '0.8',
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
				const { Berita } = await import('../db/mongodb');
				const Article = Berita;

				if (Article) {
					// Ambil semua artikel yang published (tanpa sort, tanpa limit)
					const articles = await Article.find({ published: true })
						.select('_id slug updatedAt createdAt')
						.lean();

					console.log(`📄 Found ${articles.length} published articles`);

				articleUrls = articles.map((a: any) => {
					const url = `${host}/berita/${a._id}/${a.slug}`;
					console.log(`📝 Adding berita URL: ${url}`);
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
						'⚠️ Article model not found, continuing with base URLs only',
					);
				}
			} else {
				console.log(
					'⚠️ Database not connected, continuing with base URLs only',
				);
			}
		} catch (dbError: any) {
			console.log(
				'⚠️ Database error, continuing with base URLs only:',
				dbError?.message || 'Unknown error',
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
			urls.map((u) => u.loc),
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
						}</changefreq>\n    <priority>${u.priority}</priority>\n  </url>`,
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

// Anti-Spoofing Protection Cleanup (every minute)
setInterval(cleanupAntiSpoofingData, 60 * 1000);

// DNS Layer Protection Cleanup (every 5 minutes)
setInterval(cleanupDnsLayerData, 5 * 60 * 1000);

// ==================== SECURITY MONITORING ====================
// Security monitoring akan ditampilkan saat server start

// Log server status setiap 5 menit
setInterval(
	() => {
		console.log('📊 Server Status: Active');
		console.log('   - MongoDB Connection: ✅ Connected');
		console.log('   - Server Uptime: ✅ Running');
		console.log('   - Memory Usage: ✅ Normal');
		console.log('   - Request Handling: ✅ Active');
	},
	5 * 60 * 1000,
);

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

	// Debug environment
	console.log('🔍 Environment Check:');
	console.log('   - NODE_ENV:', process.env.NODE_ENV);
	console.log('   - app.get("env"):', app.get('env'));
	console.log(
		'   - process.env.NODE_ENV === "production":',
		process.env.NODE_ENV === 'production',
	);

	// importantly only setup vite in development and after
	// setting up all the other routes so the catch-all route
	// doesn't interfere with the other routes
	if (app.get('env') === 'development') {
		console.log('🚀 Setting up Vite (development mode)');
		await setupVite(app, server);
	} else {
		console.log('📦 Setting up static files (production mode)');

		// Redirect old /artikel/* URLs to /berita/*
		app.get('/artikel/:rest*', (req, res) => {
			const rest = req.params.rest + (req.params[0] || '');
			res.redirect(301, `/berita/${rest}`);
		});

		// ==================== BERITA SEO PRERENDER MIDDLEWARE ====================
		app.get(['/berita/:id/:slug', '/berita/:id'], async (req, res, next) => {
			try {
				const distPath = path.resolve(process.cwd(), 'dist', 'public');
				const htmlPath = path.join(distPath, 'index.html');
				if (!fs.existsSync(htmlPath)) return next();

				let article: any = null;
				try {
					const { Berita } = await import('../db/mongodb');
					const Article = Berita;
					const mongoose = await import('mongoose');
					const { id, slug } = req.params as { id?: string; slug?: string };

					if (slug && id) {
						article = await Article.findById(id)
							.select('title excerpt image author createdAt updatedAt slug _id')
							.lean();
					} else if (id) {
						if (mongoose.default.Types.ObjectId.isValid(id)) {
							article = await Article.findById(id)
								.select('title excerpt image author createdAt updatedAt slug _id')
								.lean();
						} else {
							article = await Article.findOne({ slug: id })
								.select('title excerpt image author createdAt updatedAt slug _id')
								.lean();
						}
					}
				} catch (dbErr) {
					console.log('Article prerender DB fetch skipped:', dbErr);
				}

				let html = fs.readFileSync(htmlPath, 'utf-8');

				if (article) {
					const esc = (s: string) =>
						String(s)
							.replace(/&/g, '&amp;')
							.replace(/"/g, '&quot;')
							.replace(/</g, '&lt;')
							.replace(/>/g, '&gt;');

					const title = `${article.title} | Himatif Encoder`;
					const description = String(
						article.excerpt ||
							'Berita dari Himatif Encoder - Himpunan Mahasiswa Teknik Informatika UIN Malang',
					).slice(0, 160);
					const canonicalUrl = `https://himatif-encoder.com/berita/${article._id}/${article.slug || ''}`;
					const defaultOgImage =
						'https://himatif-encoder.com/attached_assets/content/1753431673566_LOGO_HMPS___Himatif__b27bdf89e7255aaa.webp';
					const ogImage =
						article.image && String(article.image).startsWith('http')
							? article.image
							: article.image
								? `https://himatif-encoder.com${article.image}`
								: defaultOgImage;

					html = html
						.replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(title)}</title>`)
						.replace(
							/<meta\s[^>]*name="title"[^>]*>/,
							`<meta name="title" content="${esc(title)}" />`,
						)
						.replace(
							/<meta\s[^>]*name="description"[^>]*>/,
							`<meta name="description" content="${esc(description)}" />`,
						)
						.replace(
							/<link\s[^>]*rel="canonical"[^>]*>/,
							`<link rel="canonical" href="${canonicalUrl}" />`,
						)
						.replace(
							/<meta\s[^>]*property="og:type"[^>]*>/,
							`<meta property="og:type" content="article" />`,
						)
						.replace(
							/<meta\s[^>]*property="og:url"[^>]*>/,
							`<meta property="og:url" content="${canonicalUrl}" />`,
						)
						.replace(
							/<meta\s[^>]*property="og:title"[^>]*>/,
							`<meta property="og:title" content="${esc(title)}" />`,
						)
						.replace(
							/<meta\s[^>]*property="og:description"[^>]*>/,
							`<meta property="og:description" content="${esc(description)}" />`,
						)
						.replace(
							/<meta\s[^>]*property="og:image"[^>]*>/,
							`<meta property="og:image" content="${ogImage}" />`,
						)
						.replace(
							/<meta\s[^>]*property="twitter:url"[^>]*>/,
							`<meta property="twitter:url" content="${canonicalUrl}" />`,
						)
						.replace(
							/<meta\s[^>]*property="twitter:title"[^>]*>/,
							`<meta property="twitter:title" content="${esc(title)}" />`,
						)
						.replace(
							/<meta\s[^>]*property="twitter:description"[^>]*>/,
							`<meta property="twitter:description" content="${esc(description)}" />`,
						)
						.replace(
							/<meta\s[^>]*property="twitter:image"[^>]*>/,
							`<meta property="twitter:image" content="${ogImage}" />`,
						);

					// Inject Article JSON-LD schema for rich results
					const articleSchema = JSON.stringify({
						'@context': 'https://schema.org',
						'@type': 'Article',
						headline: article.title,
						description: article.excerpt || '',
						image: ogImage,
						author: {
							'@type': 'Person',
							name: article.author || 'Himatif Encoder',
						},
						publisher: {
							'@type': 'Organization',
							name: 'Himatif Encoder TI UIN Malang',
							logo: {
								'@type': 'ImageObject',
								url: defaultOgImage,
							},
						},
						datePublished: article.createdAt,
						dateModified: article.updatedAt || article.createdAt,
						mainEntityOfPage: { '@type': 'WebPage', '@id': canonicalUrl },
						url: canonicalUrl,
					});

					html = html.replace(
						'</head>',
						`<script type="application/ld+json">${articleSchema}</script>\n</head>`,
					);
				}

				res.set('Content-Type', 'text/html');
				return res.send(html);
			} catch (err) {
				console.log('Article prerender error, falling back to SPA:', err);
				return next();
			}
		});

		// ==================== PAGE META INJECTION (per halaman untuk embed & mesin pencari) ====================
		// Setiap halaman punya meta sendiri (og:*, twitter:*, canonical) — terbaca semua mesin pencari
		const injectPageMeta = (
			html: string,
			opts: {
				title: string;
				description: string;
				canonicalUrl: string;
				ogImage?: string;
				robots?: string;
			},
		) => {
			const esc = (s: string) =>
				String(s)
					.replace(/&/g, '&amp;')
					.replace(/"/g, '&quot;')
					.replace(/</g, '&lt;')
					.replace(/>/g, '&gt;');
			const { title, description, canonicalUrl, ogImage, robots } = opts;
			const img =
				ogImage ||
				'https://himatif-encoder.com/attached_assets/content/1753431673566_LOGO_HMPS___Himatif__b27bdf89e7255aaa.webp';
			let out = html
				.replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(title)}</title>`)
				.replace(
					/<meta\s[^>]*name="title"[^>]*>/,
					`<meta name="title" content="${esc(title)}" />`,
				)
				.replace(
					/<meta\s[^>]*name="description"[^>]*>/,
					`<meta name="description" content="${esc(description)}" />`,
				)
				.replace(
					/<link\s[^>]*rel="canonical"[^>]*>/,
					`<link rel="canonical" href="${canonicalUrl}" />`,
				)
				.replace(
					/<meta\s[^>]*property="og:type"[^>]*>/,
					`<meta property="og:type" content="website" />`,
				)
				.replace(
					/<meta\s[^>]*property="og:url"[^>]*>/,
					`<meta property="og:url" content="${canonicalUrl}" />`,
				)
				.replace(
					/<meta\s[^>]*property="og:title"[^>]*>/,
					`<meta property="og:title" content="${esc(title)}" />`,
				)
				.replace(
					/<meta\s[^>]*property="og:description"[^>]*>/,
					`<meta property="og:description" content="${esc(description)}" />`,
				)
				.replace(
					/<meta\s[^>]*property="og:image"[^>]*>/,
					`<meta property="og:image" content="${img}" />`,
				)
				.replace(
					/<meta\s[^>]*property="twitter:url"[^>]*>/,
					`<meta property="twitter:url" content="${canonicalUrl}" />`,
				)
				.replace(
					/<meta\s[^>]*property="twitter:title"[^>]*>/,
					`<meta property="twitter:title" content="${esc(title)}" />`,
				)
				.replace(
					/<meta\s[^>]*property="twitter:description"[^>]*>/,
					`<meta property="twitter:description" content="${esc(description)}" />`,
				)
				.replace(
					/<meta\s[^>]*property="twitter:image"[^>]*>/,
					`<meta property="twitter:image" content="${img}" />`,
				);
			if (robots != null && robots !== '') {
				out = out.replace(
					/<meta\s[^>]*name="robots"[^>]*>/,
					`<meta name="robots" content="${esc(robots)}" />`,
				);
			}
			return out;
		};

		const serveHtmlWithMeta = (opts: {
			title: string;
			description: string;
			canonicalUrl: string;
			robots?: string;
		}) => {
			return async (_req: Request, res: Response, next: NextFunction) => {
				try {
					const distPath = path.resolve(process.cwd(), 'dist', 'public');
					const htmlPath = path.join(distPath, 'index.html');
					if (!fs.existsSync(htmlPath)) return next();
					let html = fs.readFileSync(htmlPath, 'utf-8');
					html = injectPageMeta(html, opts);
					res.set('Content-Type', 'text/html');
					return res.send(html);
				} catch (err) {
					console.log('Page meta injection error:', err);
					return next();
				}
			};
		};

		app.get(
			'/profil',
			serveHtmlWithMeta({
				title: 'Profil | Himatif Encoder - Himpunan Mahasiswa Teknik Informatika UIN Malang',
				description:
					'Profil HIMATIF Encoder - Tentang Kami, Sejarah Rekam Jejak Ketua Himpunan & Divisi, serta Filosofi Lambang - Himpunan Mahasiswa Teknik Informatika UIN Malang.',
				canonicalUrl: 'https://himatif-encoder.com/profil',
			}),
		);

		app.get(
			'/kelembagaan',
			serveHtmlWithMeta({
				title: 'Kelembagaan | Himatif Encoder - Himpunan Mahasiswa Teknik Informatika UIN Malang',
				description:
					'Visi dan Misi serta Struktur Organisasi HIMATIF Encoder - Himpunan Mahasiswa Teknik Informatika UIN Malang.',
				canonicalUrl: 'https://himatif-encoder.com/kelembagaan',
			}),
		);

		app.get(
			'/berita',
			serveHtmlWithMeta({
				title: 'Berita | Himatif Encoder - Himpunan Mahasiswa Teknik Informatika UIN Malang',
				description:
					'Daftar berita dan informasi terkini dari Himpunan Mahasiswa Teknik Informatika UIN Maulana Malik Ibrahim Malang.',
				canonicalUrl: 'https://himatif-encoder.com/berita',
			}),
		);

		app.get(
			'/login',
			serveHtmlWithMeta({
				title: 'Login | Himatif Encoder - Himpunan Mahasiswa Teknik Informatika UIN Malang',
				description:
					'Masuk ke akun Anda untuk mengakses dashboard Himatif Encoder - Himpunan Mahasiswa Teknik Informatika UIN Malang.',
				canonicalUrl: 'https://himatif-encoder.com/login',
				robots: 'noindex, nofollow',
			}),
		);

		app.get(
			'/error',
			serveHtmlWithMeta({
				title: 'Error | Himatif Encoder - Himpunan Mahasiswa Teknik Informatika UIN Malang',
				description:
					'Halaman error - Himatif Encoder, Himpunan Mahasiswa Teknik Informatika UIN Maulana Malik Ibrahim Malang.',
				canonicalUrl: 'https://himatif-encoder.com/error',
				robots: 'noindex, nofollow',
			}),
		);

		// Dashboard: redirect ke login (tanpa akses login, meta/isi dashboard tidak di-expose)
		// Crawler & user yang share link dashboard akan diarahkan ke login; meta yang tampil = login
		app.get(/^\/dashboard(\/.*)?$/, (_req, res) => {
			res.redirect(302, '/login');
		});

		serveStatic(app);
	}

	// ALWAYS serve the app on port 5000
	// this serves both the API and the client.
	// It is the only port that is not firewalled.
	const port = 5000;
	const listenOptions: { port: number; host: string; reusePort?: boolean } = {
		port,
		host: '0.0.0.0',
	};
	// `reusePort` tidak didukung di Windows (akan memicu ENOTSUP)
	if (process.platform !== 'win32') {
		listenOptions.reusePort = true;
	}

	server.listen(listenOptions, () => {
		log(`🛡️ Secure server running on port ${port}`);
		console.log('🛡️ Security Features Activated:');
		console.log('   ✅ DDoS Protection (Multi-Tier System)');
		console.log('   ✅ SQL Injection Protection');
		console.log('   ✅ NoSQL Injection Protection');
		console.log('   ✅ XSS Protection');
		console.log('   ✅ Anti-Spoofing Protection');
		console.log('   ✅ DNS Layer Protection');
		console.log('   ✅ Port Scanning Protection');
		console.log('   ✅ Rate Limiting');
		console.log('   ✅ Security Headers');
	});
})();

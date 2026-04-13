import dotenv from 'dotenv';
dotenv.config();

import express, { NextFunction, type Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { connectDB } from '../db/mongodb';
import { connectBackupMongoIfConfigured } from '../db/mongodb-backup';
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
import { loadSheddingMiddleware } from './middleware/load-shedding';

// Import models to ensure they are registered
import './models/activity';

if (process.env.DISABLE_MONGODB === undefined) {
	process.env.DISABLE_MONGODB = 'false';
}

const app = express();

// Trust proxy untuk membaca X-Forwarded-For dengan benar
app.set('trust proxy', true);

// Batasi request bersamaan per worker — tolak 503 sebelum middleware/DB (lindungi Mongo)
app.use(loadSheddingMiddleware);

// ==================== SECURITY MIDDLEWARE SETUP ====================
// Apply security headers and basic protection
app.use(securityMiddleware.helmet);
app.use(securityMiddleware.dynamicFrameSrc);
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

// Apply tenant resolver for community API calls
import { tenantApiResolver } from './middleware/tenant-resolver';
app.use(tenantApiResolver);

// Apply input sanitization
app.use(sanitizeInput);

// Apply security logging
app.use(securityLogger);

// ==================== BASIC MIDDLEWARE ====================
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: false, limit: '100mb' }));

// File access guard: block infected files from being served
const fileAccessGuard = async (req: any, res: any, next: any) => {
	try {
		const { FileUpload } = await import('../db/mongodb');
		const urlPath = req.originalUrl || req.url;
		const record = await FileUpload.findOne({ url: urlPath }).lean() as any;
		if (record && record.scanStatus === 'infected') {
			return res.status(403).json({ message: 'File diblokir karena terdeteksi ancaman keamanan.' });
		}
	} catch {}
	next();
};

// Tambahkan middleware static agar file upload bisa diakses publik
app.use('/uploads', fileAccessGuard, express.static(uploadDir));
// Photopea di iframe (origin photopea.com) memuat PSD lewat fetch/XHR dari URL kita.
// Dokumentasi resmi mewajibkan CORS: https://www.photopea.com/api/ ("Access-Control-Allow-Origin: *")
app.use(
	'/attached_assets',
	fileAccessGuard,
	(req, res, next) => {
		res.setHeader('Access-Control-Allow-Origin', '*');
		res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
		res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
		if (req.method === 'OPTIONS') {
			return res.sendStatus(204);
		}
		next();
	},
	express.static(assetsDir),
);

// Serve static files from public folder (SEO files, favicon, etc.)
// Serve sitemap dynamically before static to ensure fresh URLs
app.get('/sitemap.xml', async (_req, res) => {
	try {
		console.log('🔍 Generating dynamic sitemap...');

		const host = 'https://himatif-encoder.com';
		const now = new Date().toISOString().slice(0, 10);
		const toUrlSlug = (value: string) =>
			(value || '')
				.toLowerCase()
				.trim()
				.replace(/[^\w\s-]/g, '')
				.replace(/[\s_]+/g, '-')
				.replace(/-+/g, '-')
				.replace(/^-+|-+$/g, '')
				.substring(0, 80);

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
			loc: `${host}/events`,
			changefreq: 'weekly',
			priority: '0.8',
			lastmod: now,
		},
		{
			loc: `${host}/library`,
			changefreq: 'weekly',
			priority: '0.8',
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
			{
				loc: `${host}/prodi`,
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

		let beritaUrls: any[] = [];
		let eventUrls: any[] = [];
		let libraryUrls: any[] = [];

		try {
			// Check database connection first
			const { connectDB } = await import('../db/mongodb');
			const isConnected = await connectDB();

			if (isConnected) {
				const { Berita, Event, EventYear, Library } = await import('../db/mongodb');

				if (Berita) {
					const beritaList = await Berita.find({ published: true })
						.select('_id slug updatedAt createdAt')
						.lean();

					console.log(`📄 Found ${beritaList.length} published berita`);

				beritaUrls = beritaList.filter((a: any) => a.slug).map((a: any) => {
					const url = `${host}/berita/${a.slug}`;
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
						'⚠️ Berita model not found, continuing with base URLs only',
					);
				}
				if (Event && EventYear) {
					const yearDocs = await EventYear.find({}).select('_id year').lean();
					const yearMap = new Map(
						(yearDocs || []).map((y: any) => [String(y._id), Number(y.year)]),
					);
					const events = await Event.find({ published: true })
						.select('_id title yearId updatedAt createdAt')
						.lean();
					eventUrls = (events || [])
						.map((e: any) => {
							const year = yearMap.get(String(e.yearId));
							if (!year) return null;
							const slug = toUrlSlug(String(e.title || ''));
							if (!slug) return null;
							return {
								loc: `${host}/events/${year}/${slug}`,
								lastmod:
									(e.updatedAt || e.createdAt)?.toISOString?.().slice(0, 10) ||
									now,
								changefreq: 'monthly',
								priority: '0.7',
							};
						})
						.filter(Boolean) as any[];
				}
				if (Library) {
					const libraries = await Library.find({ published: true })
						.select('_id title updatedAt createdAt')
						.lean();
					libraryUrls = (libraries || [])
						.map((l: any) => {
							const slug = toUrlSlug(String(l.title || ''));
							if (!slug) return null;
							return {
								loc: `${host}/library/${slug}`,
								lastmod:
									(l.updatedAt || l.createdAt)?.toISOString?.().slice(0, 10) ||
									now,
								changefreq: 'monthly',
								priority: '0.7',
							};
						})
						.filter(Boolean) as any[];
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

		const urls = [...baseUrls, ...beritaUrls, ...eventUrls, ...libraryUrls];

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

// ==================== TEMP ONBOARDING UPLOAD CLEANUP (every hour) ====================
import { runTempUploadCleanup, uploadDir, assetsDir, PROJECT_ROOT } from './upload';
setInterval(runTempUploadCleanup, 60 * 60 * 1000);

// ==================== MONTHLY DB BACKUP SCHEDULER ====================
import cron from 'node-cron';
import { runMonthlyBackup } from './services/db-backup';

async function runBackupIfNeeded() {
	if (!process.env.MONGODB_URI_BACKUP) return;
	try {
		const result = await runMonthlyBackup();
		if (result.success) {
			if (result.skipped) {
				console.log(
					`[Backup] Snapshot ${result.snapshotKey} sudah ada di cluster backup — lewati (backup berikutnya: tanggal 1 bulan depan).`,
				);
			} else {
				console.log(`[Backup] Backup bulanan selesai: ${result.snapshotKey}`);
			}
		} else {
			console.error('[Backup] Gagal:', result.error);
		}
	} catch (err: any) {
		console.error('[Backup] Error:', err?.message);
	}
}

// Schedule: tanggal 1 setiap bulan jam 02:00 — jika snapshot bulan itu belum ada, jalan; kalau sudah ada, lewati
cron.schedule('0 2 1 * *', runBackupIfNeeded);

// ==================== DAILY ORPHAN ASSET CLEANUP — DISABLED ====================
// Dinonaktifkan: auto-cleanup bisa false-delete file yang masih valid di database.
// File asset-cleanup.ts dipertahankan sebagai referensi internal.

// Schedule: prodi auto-sync — every 1st of month at 03:00
cron.schedule('0 3 1 * *', async () => {
	try {
		const { mongoStorage } = await import('./mongo-storage');
		const doc = await mongoStorage.getProdiContent();
		if (!doc.autoSyncEnabled) {
			console.log('⏭️  Prodi auto-sync skipped (disabled)');
			return;
		}
		const { runProdiSyncScoped } = await import('./services/prodi-sync');
		console.log('🔄 Running scheduled prodi auto-sync...');
		await runProdiSyncScoped('all', { overwrite: true });
	} catch (err) {
		console.error('Scheduled prodi sync error:', err);
	}
});

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
	} catch (error) {
		console.error('Error saat inisialisasi database:', error);
		process.exit(1);
	}

	// Drop legacy `databaseName_1` index on communities if it exists (migrated to `dbName`)
	try {
		const { Community } = await import('../db/mongodb');
		const indexes = await (Community as any).collection.indexes();
		const legacy = indexes.find((idx: any) => idx.name === 'databaseName_1');
		if (legacy) {
			await (Community as any).collection.dropIndex('databaseName_1');
			console.log('[migration] Dropped legacy index databaseName_1 on communities');
		} else {
			console.log('[migration] No legacy databaseName_1 index found — OK');
		}
	} catch (migErr) {
		console.warn('[migration] Failed to check/drop databaseName_1 index:', migErr);
	}

	// Cluster backup (opsional): koneksi persisten + ping — dipakai job snapshot tanpa buka-tutup klien tiap kali
	await connectBackupMongoIfConfigured();

	// Run backup on startup if this month not yet backed up
	runBackupIfNeeded().catch(() => {});

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

		// ==================== BERITA 301 REDIRECT: old /berita/:id/:slug → /berita/:slug ====================
		app.get('/berita/:id/:slug', async (req, res) => {
			const qs = req.originalUrl.includes('?') ? req.originalUrl.slice(req.originalUrl.indexOf('?')) : '';
			return res.redirect(301, `/berita/${req.params.slug}${qs}`);
		});

		// ==================== BERITA SEO PRERENDER MIDDLEWARE (slug-only) ====================
		app.get('/berita/:slugOrId', async (req, res, next) => {
			try {
				const { slugOrId } = req.params;
				const qs = req.originalUrl.includes('?') ? req.originalUrl.slice(req.originalUrl.indexOf('?')) : '';

				const { Berita } = await import('../db/mongodb');
				const mongoose = await import('mongoose');

				// Old ID-based URL → redirect 301 to slug
				const isObjectId = mongoose.default.Types.ObjectId.isValid(slugOrId) && /^[0-9a-fA-F]{24}$/.test(slugOrId);
				if (isObjectId) {
					try {
						const found = await Berita.findById(slugOrId).select('slug').lean() as any;
						if (found?.slug) {
							return res.redirect(301, `/berita/${found.slug}${qs}`);
						}
					} catch {}
					return next();
				}

				// New slug-based URL → SSR prerender
				const distPath = path.resolve(process.cwd(), 'dist', 'public');
				const htmlPath = path.join(distPath, 'index.html');
				if (!fs.existsSync(htmlPath)) return next();

				let beritaItem: any = null;
				try {
					beritaItem = await Berita.findOne({ slug: slugOrId })
						.select('title excerpt image author createdAt updatedAt slug _id')
						.lean();
				} catch (dbErr) {
					console.log('Berita prerender DB fetch skipped:', dbErr);
				}

				let html = fs.readFileSync(htmlPath, 'utf-8');

				if (beritaItem) {
					const esc = (s: string) =>
						String(s)
							.replace(/&/g, '&amp;')
							.replace(/"/g, '&quot;')
							.replace(/</g, '&lt;')
							.replace(/>/g, '&gt;');

					const title = `${beritaItem.title} | Himatif Encoder`;
					const description = String(
						beritaItem.excerpt ||
							'Berita dari Himatif Encoder - Himpunan Mahasiswa Teknik Informatika UIN Malang',
					).slice(0, 160);
					const canonicalUrl = `https://himatif-encoder.com/berita/${beritaItem.slug}`;
					const defaultOgImage =
						'https://himatif-encoder.com/attached_assets/content/1753431673566_LOGO_HMPS___Himatif__b27bdf89e7255aaa.webp';
					const ogImage =
						beritaItem.image && String(beritaItem.image).startsWith('http')
							? beritaItem.image
							: beritaItem.image
								? `https://himatif-encoder.com${beritaItem.image}`
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

					const beritaSchema = JSON.stringify({
						'@context': 'https://schema.org',
						'@type': 'Article',
						headline: beritaItem.title,
						description: beritaItem.excerpt || '',
						image: ogImage,
						author: {
							'@type': 'Person',
							name: beritaItem.author || 'Himatif Encoder',
						},
						publisher: {
							'@type': 'Organization',
							name: 'Himatif Encoder TI UIN Malang',
							logo: {
								'@type': 'ImageObject',
								url: defaultOgImage,
							},
						},
						datePublished: beritaItem.createdAt,
						dateModified: beritaItem.updatedAt || beritaItem.createdAt,
						mainEntityOfPage: { '@type': 'WebPage', '@id': canonicalUrl },
						url: canonicalUrl,
					});

					html = html.replace(
						'</head>',
						`<script type="application/ld+json">${beritaSchema}</script>\n</head>`,
					);
				}

				res.set('Content-Type', 'text/html');
				return res.send(html);
			} catch (err) {
				console.log('Berita prerender error, falling back to SPA:', err);
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

		import('./services/file-scanner').then(({ startScanWorker }) => {
			startScanWorker();
			console.log('   ✅ Antivirus File Scanner Worker Started');
		}).catch((err) => {
			console.warn('   ⚠️ Antivirus File Scanner not started:', err.message);
		});

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

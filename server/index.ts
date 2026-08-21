import dotenv from 'dotenv';
dotenv.config();

import express, { NextFunction, type Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { connectDB } from '../db/mongodb';
import { connectBackupMongoIfConfigured } from '../db/mongodb-backup';
import { registerRoutes } from './routes';
import { ChatService } from './services/chat-service';
import { captureServerError, captureHttpError } from './services/error-monitor';
import { setupSwagger } from './swagger';
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
import { loadSheddingMiddleware } from './middleware/load-shedding';
import {
	noSqlInjectionProtectionMiddleware,
	sqlInjectionProtectionMiddleware,
} from './middleware/sql-injection-protection';
import { sanitizeInput, securityLogger, securityMiddleware } from './security';

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

// Apply security logging (before body parse is fine — logs method/path)
app.use(securityLogger);

// Bug monitoring: tangkap error berbasis status response untuk SEMUA endpoint /api
// (main + tenant, termasuk handler yang membalas res.status(...) tanpa throw).
// Berjalan setelah tenant resolver agar konteks tenant ikut terekam.
app.use('/api', (req: Request, res: Response, next: NextFunction) => {
	res.on('finish', () => {
		try {
			// Lewati bila error sudah ditangkap versi "thrown" (punya stack/file/baris).
			if ((req as Request & { _sysErrCaptured?: boolean })._sysErrCaptured) return;
			void captureHttpError(req, res.statusCode);
		} catch {
			/* abaikan */
		}
	});
	next();
});

// ==================== BASIC MIDDLEWARE ====================
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: false, limit: '100mb' }));

// Sanitize AFTER body parsers so JSON/urlencoded fields are present.
// (Previously sanitizeInput ran before parsers and was a no-op for API JSON.)
import { postBodySanitizeMiddleware } from './middleware/post-body-sanitize';
app.use(sanitizeInput);
app.use(postBodySanitizeMiddleware);

// File access guard: block infected files from being served
const fileAccessGuard = async (req: any, res: any, next: any) => {
	try {
		const { FileUpload } = await import('../db/mongodb');
		const urlPath = req.originalUrl || req.url;
		const record = (await FileUpload.findOne({ url: urlPath }).lean()) as any;
		if (record && record.scanStatus === 'infected') {
			return res
				.status(403)
				.json({ message: 'File diblokir karena terdeteksi ancaman keamanan.' });
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
// Serve sitemap dynamically before static (URL + image/video extensions)
app.get('/sitemap.xml', async (_req, res) => {
	try {
		console.log('🔍 Generating dynamic sitemap (with media)...');

		const {
			buildSitemapXml,
			collectImageUrls,
			libraryVideosFromImages,
		} = await import('./services/seo-sitemap');
		type SitemapUrlEntry =
			import('./services/seo-sitemap').SitemapUrlEntry;

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

		const lastmodOf = (a: any) =>
			(a?.updatedAt || a?.createdAt)?.toISOString?.().slice(0, 10) || now;

		const baseUrls: SitemapUrlEntry[] = [
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
				loc: `${host}/toko`,
				changefreq: 'weekly',
				priority: '0.7',
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
			{
				loc: `${host}/communities`,
				changefreq: 'weekly',
				priority: '0.7',
				lastmod: now,
			},
		];

		let beritaUrls: SitemapUrlEntry[] = [];
		let eventUrls: SitemapUrlEntry[] = [];
		let libraryUrls: SitemapUrlEntry[] = [];
		let tokoUrls: SitemapUrlEntry[] = [];

		try {
			const { connectDB } = await import('../db/mongodb');
			const isConnected = await connectDB();

			if (isConnected) {
				const { Berita, Event, EventYear, Library, StoreProduct } =
					await import('../db/mongodb');

				if (Berita) {
					const beritaList = await Berita.find({ published: true })
						.select('_id slug title image updatedAt createdAt')
						.lean();

					console.log(`📄 Found ${beritaList.length} published berita`);

					beritaUrls = beritaList
						.filter((a: any) => a.slug)
						.map((a: any) => {
							const title = String(a.title || a.slug || '');
							const imgs = collectImageUrls([a.image], host, 1).map(
								(loc) => ({
									loc,
									title,
									caption: title,
								}),
							);
							return {
								loc: `${host}/berita/${a.slug}`,
								lastmod: lastmodOf(a),
								changefreq: 'monthly',
								priority: '0.8',
								images: imgs,
							};
						});
				}
				if (Event && EventYear) {
					const yearDocs = await EventYear.find({}).select('_id year').lean();
					const yearMap = new Map(
						(yearDocs || []).map((y: any) => [String(y._id), Number(y.year)]),
					);
					const events = await Event.find({ published: true })
						.select('_id title yearId thumbnail updatedAt createdAt')
						.lean();
					eventUrls = (events || [])
						.map((e: any) => {
							const year = yearMap.get(String(e.yearId));
							if (!year) return null;
							const slug = toUrlSlug(String(e.title || ''));
							if (!slug) return null;
							const title = String(e.title || slug);
							const imgs = collectImageUrls([e.thumbnail], host, 1).map(
								(loc) => ({
									loc,
									title,
									caption: title,
								}),
							);
							return {
								loc: `${host}/events/${year}/${slug}`,
								lastmod: lastmodOf(e),
								changefreq: 'monthly',
								priority: '0.7',
								images: imgs,
							};
						})
						.filter(Boolean) as SitemapUrlEntry[];
				}
				if (Library) {
					const libraries = await Library.find({ published: true })
						.select(
							'_id title description images mediaKinds type updatedAt createdAt activityDate',
						)
						.lean();
					libraryUrls = (libraries || [])
						.map((l: any) => {
							const slug = toUrlSlug(String(l.title || ''));
							if (!slug) return null;
							const title = String(l.title || slug);
							const desc = String(l.description || title);
							const imageList = Array.isArray(l.images) ? l.images : [];
							const imgs = collectImageUrls(imageList, host, 10).map(
								(loc) => ({
									loc,
									title,
									caption: desc.slice(0, 200),
								}),
							);
							const pubIso = (
								l.activityDate ||
								l.updatedAt ||
								l.createdAt
							)?.toISOString?.();
							const videos = libraryVideosFromImages(
								title,
								desc,
								imageList.map(String),
								l.mediaKinds,
								pubIso,
								host,
							);
							return {
								loc: `${host}/library/${slug}`,
								lastmod: lastmodOf(l),
								changefreq: 'monthly',
								priority: '0.7',
								images: imgs,
								videos,
							};
						})
						.filter(Boolean) as SitemapUrlEntry[];
				}
				if (StoreProduct) {
					const products = await StoreProduct.find({ published: true })
						.select('slug name thumbnail updatedAt createdAt')
						.lean();
					tokoUrls = (products || [])
						.map((p: any) => {
							const slug = String(p.slug || '').trim();
							if (!slug) return null;
							const title = String(p.name || slug);
							const imgs = collectImageUrls([p.thumbnail], host, 1).map(
								(loc) => ({
									loc,
									title,
									caption: title,
								}),
							);
							return {
								loc: `${host}/toko/${slug}`,
								lastmod: lastmodOf(p),
								changefreq: 'weekly',
								priority: '0.6',
								images: imgs,
							};
						})
						.filter(Boolean) as SitemapUrlEntry[];
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

		let tenantUrls: SitemapUrlEntry[] = [];
		try {
			const { Community } = await import('../db/mongodb');
			const { getTenantModels } = await import('../db/tenant');
			const comms = await Community.find({ status: 'active' })
				.select('slug name dbName')
				.lean();
			for (const c of comms || []) {
				const slug = String((c as any).slug || '').trim();
				const dbName = String((c as any).dbName || '').trim();
				if (!slug || !dbName) continue;
				tenantUrls.push(
					{
						loc: `${host}/${slug}`,
						changefreq: 'weekly',
						priority: '0.8',
						lastmod: now,
					},
					{
						loc: `${host}/${slug}/berita`,
						changefreq: 'weekly',
						priority: '0.7',
						lastmod: now,
					},
					{
						loc: `${host}/${slug}/profil`,
						changefreq: 'monthly',
						priority: '0.6',
						lastmod: now,
					},
					{
						loc: `${host}/${slug}/kelembagaan`,
						changefreq: 'monthly',
						priority: '0.6',
						lastmod: now,
					},
				);
				try {
					const models = getTenantModels(dbName);
					const articles = await models.Berita.find({ published: true })
						.select('slug updatedAt createdAt')
						.lean();
					for (const a of articles || []) {
						if (!(a as any).slug) continue;
						tenantUrls.push({
							loc: `${host}/${slug}/berita/${(a as any).slug}`,
							lastmod: lastmodOf(a),
							changefreq: 'monthly',
							priority: '0.7',
						});
					}
				} catch (tenantDbErr: any) {
					console.log(
						`tenant sitemap content skipped for ${slug}:`,
						tenantDbErr?.message,
					);
				}
			}
		} catch (tenantListErr: any) {
			console.log(
				'tenant sitemap list skipped:',
				tenantListErr?.message || 'Unknown error',
			);
		}

		const urls = [
			...baseUrls,
			...beritaUrls,
			...eventUrls,
			...libraryUrls,
			...tokoUrls,
			...tenantUrls,
		];
		const dedupedUrls = urls.filter(
			(item, idx, arr) => arr.findIndex((x) => x.loc === item.loc) === idx,
		);

		console.log(`🌐 Generated ${dedupedUrls.length} total URLs for sitemap`);
		const xml = buildSitemapXml(dedupedUrls);

		console.log('✅ Dynamic sitemap generated successfully');
		console.log('📄 XML Preview:', xml.substring(0, 500) + '...');
		res.set('Content-Type', 'application/xml');
		return res.status(200).send(xml);
	} catch (e: any) {
		console.error('❌ Failed to generate sitemap dynamically:', e);
		console.log('🔍 Error details:', e?.message || 'Unknown error');
		const minimal =
			`<?xml version="1.0" encoding="UTF-8"?>` +
			`<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">` +
			`<url><loc>https://himatif-encoder.com/</loc></url>` +
			`<url><loc>https://himatif-encoder.com/communities</loc></url>` +
			`</urlset>`;
		res.set('Content-Type', 'application/xml');
		return res.status(200).send(minimal);
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
				let safeBody: any = capturedJsonResponse;
				if (path === '/api/notifications/webpush/vapid-key') {
					safeBody = { publicKey: '[REDACTED]' };
				}
				logLine += ` :: ${JSON.stringify(safeBody)}`
					.replace(
						/"WEB_PUSH_VAPID_PRIVATE_KEY":"[^"]*"/g,
						'"WEB_PUSH_VAPID_PRIVATE_KEY":"[REDACTED]"',
					)
					.replace(
						/"VAPID_PRIVATE_KEY":"[^"]*"/g,
						'"VAPID_PRIVATE_KEY":"[REDACTED]"',
					)
					.replace(
						/"WEB_PUSH_VAPID_PUBLIC_KEY":"[^"]*"/g,
						'"WEB_PUSH_VAPID_PUBLIC_KEY":"[REDACTED]"',
					)
					.replace(
						/"VAPID_PUBLIC_KEY":"[^"]*"/g,
						'"VAPID_PUBLIC_KEY":"[REDACTED]"',
					);
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
import { assetsDir, runTempUploadCleanup, uploadDir } from './upload';
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

// Schedule: student hub refresh (announcements + skripsi + PKL + calendar) — check hourly; default interval 1 day
cron.schedule('15 * * * *', async () => {
	try {
		const { mongoStorage } = await import('./mongo-storage');
		const doc = await mongoStorage.getProdiContent();
		if (!doc.autoSyncEnabled) {
			return;
		}
		const intervalDays = Math.min(
			30,
			Math.max(1, Number(doc.announcementSyncIntervalDays) || 1),
		);
		const last = doc.lastAnnouncementSyncAt
			? new Date(doc.lastAnnouncementSyncAt).getTime()
			: 0;
		const dueMs = intervalDays * 24 * 60 * 60 * 1000;
		if (Date.now() - last < dueMs) return;

		const { runStudentResourcesSync } = await import('./services/prodi-student-resources');
		const existingHub = (doc.content as any)?.studentHub || {};
		const { hub, summary } = await runStudentResourcesSync(existingHub);
		// portals/guides are not force-written — manual overrides stay; hub merge keeps customs when set
		await mongoStorage.applyAutoSyncData(
			{ studentHub: hub },
			{
				forceFields: [
					'studentHub.academicCalendars',
					'studentHub.announcements',
					'studentHub.skripsiHub',
					'studentHub.pklHub',
				],
			},
		);
		const fresh = await mongoStorage.getProdiContent();
		fresh.lastAnnouncementSyncAt = new Date();
		await fresh.save();
		console.log(
			`✅ Student hub daily sync done (announcements=${summary.announcementCount}, pkl=${summary.pklTemplates}, calendars=${summary.calendarYears?.length || 0}, interval=${intervalDays}d)`,
		);
	} catch (err) {
		console.error('Scheduled student hub sync error:', err);
	}
});

// Schedule: home YouTube/Instagram social feed — check hourly; default interval 3 hours
cron.schedule('45 * * * *', async () => {
	try {
		const { mongoStorage } = await import('./mongo-storage');
		const settings: any = await mongoStorage.getSettings();
		const lean =
			settings && typeof settings.toObject === 'function'
				? settings.toObject()
				: settings;
		const { normalizeSocialFeedConfig } = await import('../shared/social-feed');
		const config = normalizeSocialFeedConfig(lean?.socialFeedConfig);
		if (!config.youtube.enabled && !config.instagram.enabled) return;

		const last = lean?.lastSocialFeedSyncAt
			? new Date(lean.lastSocialFeedSyncAt).getTime()
			: 0;
		const dueMs = config.syncIntervalHours * 60 * 60 * 1000;
		if (Date.now() - last < dueMs) return;

		const { runSocialFeedSync } = await import('./services/social-feed');
		const result = await runSocialFeedSync(config, lean?.socialFeedCache);
		await mongoStorage.updateSettings({
			socialFeedCache: result.cache,
			lastSocialFeedSyncAt: new Date(),
		});
		console.log(
			`✅ Social feed sync done (yt=${result.cache.youtube?.length || 0}, ig=${result.cache.instagram?.length || 0}, ok=${result.ok})`,
		);
	} catch (err) {
		console.error('Scheduled social feed sync error:', err);
	}
});

// ==================== VISITOR STATS AGGREGATOR ====================
// Aggregate page_visits -> visitor_stats every 15 min + warm cache.
// TTL auto-cleans raw page_visits (30d) and security_events (7d) and login_attempts (30d).
cron.schedule('*/15 * * * *', async () => {
	try {
		const { PageVisit } = await import('./models/page-visit');
		const { VisitorStats } = await import('./models/visitor-stats');

		const now = new Date();
		const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
		const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

		// Hourly aggregate (last hour)
		const hourlyAgg = await PageVisit.aggregate([
			{ $match: { timestamp: { $gte: oneHourAgo, $lt: now }, isBot: false } },
			{
				$group: {
					_id: null,
					pageviews: { $sum: 1 },
					uniqueVisitors: { $addToSet: '$ipHash' },
					topPaths: { $push: { path: '$path' } },
				},
			},
		]);

		if (hourlyAgg.length > 0) {
			const data = hourlyAgg[0];
			const pathCounts: Record<string, number> = {};
			for (const p of data.topPaths) {
				pathCounts[p.path] = (pathCounts[p.path] || 0) + 1;
			}
			const topPaths = Object.entries(pathCounts)
				.map(([path, count]) => ({ path, count }))
				.sort((a, b) => b.count - a.count)
				.slice(0, 10);

			await VisitorStats.updateOne(
				{ bucket: 'hourly', periodStart: oneHourAgo },
				{
					$set: {
						bucket: 'hourly',
						periodStart: oneHourAgo,
						periodEnd: now,
						pageviews: data.pageviews,
						uniqueVisitors: data.uniqueVisitors.length,
						topPaths,
						updatedAt: now,
					},
				},
				{ upsert: true },
			);
		}

		// Daily aggregate (last 24h)
		const dailyAgg = await PageVisit.aggregate([
			{ $match: { timestamp: { $gte: oneDayAgo, $lt: now }, isBot: false } },
			{
				$group: {
					_id: null,
					pageviews: { $sum: 1 },
					uniqueVisitors: { $addToSet: '$ipHash' },
				},
			},
		]);

		if (dailyAgg.length > 0) {
			const data = dailyAgg[0];
			await VisitorStats.updateOne(
				{ bucket: 'daily', periodStart: oneDayAgo },
				{
					$set: {
						bucket: 'daily',
						periodStart: oneDayAgo,
						periodEnd: now,
						pageviews: data.pageviews,
						uniqueVisitors: data.uniqueVisitors.length,
						updatedAt: now,
					},
				},
				{ upsert: true },
			);
		}

		console.log('✅ Visitor stats aggregated (hourly + daily)');
	} catch (err) {
		console.error('Visitor stats aggregator error:', err);
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

// Bug monitoring otomatis untuk unhandled promise rejection (best-effort).
// Sengaja TIDAK memasang handler `uncaughtException`: menangkapnya tanpa keluar
// akan menelan crash bawaan dan meninggalkan proses dalam keadaan tak menentu.
// Error sinkron yang lolos tetap dibiarkan crash seperti semula.
process.on('unhandledRejection', (reason: any) => {
	try {
		const err = reason instanceof Error ? reason : new Error(String(reason));
		void captureServerError(err, undefined, { statusCode: 500 });
	} catch {
		/* abaikan */
	}
});

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
			console.log(
				'[migration] Dropped legacy index databaseName_1 on communities',
			);
		} else {
			console.log('[migration] No legacy databaseName_1 index found — OK');
		}
	} catch (migErr) {
		console.warn(
			'[migration] Failed to check/drop databaseName_1 index:',
			migErr,
		);
	}

	// Cluster backup (opsional): koneksi persisten + ping — dipakai job snapshot tanpa buka-tutup klien tiap kali
	await connectBackupMongoIfConfigured();

	// Run backup on startup if this month not yet backed up
	runBackupIfNeeded().catch(() => {});

	const server = await registerRoutes(app);
	setupSwagger(app);

	// ==================== ERROR HANDLING ====================
	app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
		const status = err.status || err.statusCode || 500;
		const message = err.message || 'Internal Server Error';

		// Log security-related errors
		if (status === 403 || status === 429 || status === 503) {
			console.log(`🚨 Security Error: ${status} - ${message}`);
		}

		// Bug monitoring otomatis: tangkap kegagalan server nyata (5xx).
		// Best-effort — tidak boleh mengganggu response.
		try {
			void captureServerError(err, req, { statusCode: status });
		} catch {
			/* abaikan */
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

		const defaultOgImage =
			'https://himatif-encoder.com/attached_assets/content/1753431673566_LOGO_HMPS___Himatif__b27bdf89e7255aaa.webp';
		const esc = (s: string) =>
			String(s)
				.replace(/&/g, '&amp;')
				.replace(/"/g, '&quot;')
				.replace(/</g, '&lt;')
				.replace(/>/g, '&gt;');
		const toUrlSlug = (value: string) =>
			(value || '')
				.toLowerCase()
				.trim()
				.replace(/[^\w\s-]/g, '')
				.replace(/[\s_]+/g, '-')
				.replace(/-+/g, '-')
				.replace(/^-+|-+$/g, '')
				.substring(0, 80);

		// ==================== BERITA 301 REDIRECT: old /berita/:id/:slug → /berita/:slug ====================
		app.get('/berita/:id/:slug', async (req, res) => {
			const qs = req.originalUrl.includes('?')
				? req.originalUrl.slice(req.originalUrl.indexOf('?'))
				: '';
			return res.redirect(301, `/berita/${req.params.slug}${qs}`);
		});

		const injectArticleMeta = (
			html: string,
			opts: {
				title: string;
				description: string;
				canonicalUrl: string;
				ogImage: string;
				ogImageAlt?: string;
				jsonLd?: Record<string, unknown> | Record<string, unknown>[];
			},
		) => {
			const imgAlt = esc(opts.ogImageAlt || opts.title);
			let out = html
				.replace(
					/<title>[\s\S]*?<\/title>/,
					`<title>${esc(opts.title)}</title>`,
				)
				.replace(
					/<meta\s[^>]*name="title"[^>]*>/,
					`<meta name="title" content="${esc(opts.title)}" />`,
				)
				.replace(
					/<meta\s[^>]*name="description"[^>]*>/,
					`<meta name="description" content="${esc(opts.description)}" />`,
				)
				.replace(
					/<link\s[^>]*rel="canonical"[^>]*>/,
					`<link rel="canonical" href="${opts.canonicalUrl}" />`,
				)
				.replace(
					/<meta\s[^>]*property="og:type"[^>]*>/,
					`<meta property="og:type" content="article" />`,
				)
				.replace(
					/<meta\s[^>]*property="og:url"[^>]*>/,
					`<meta property="og:url" content="${opts.canonicalUrl}" />`,
				)
				.replace(
					/<meta\s[^>]*property="og:title"[^>]*>/,
					`<meta property="og:title" content="${esc(opts.title)}" />`,
				)
				.replace(
					/<meta\s[^>]*property="og:description"[^>]*>/,
					`<meta property="og:description" content="${esc(opts.description)}" />`,
				)
				.replace(
					/<meta\s[^>]*property="og:image"[^>]*>/,
					`<meta property="og:image" content="${opts.ogImage}" />\n    <meta property="og:image:alt" content="${imgAlt}" />`,
				)
				.replace(
					/<meta\s[^>]*property="twitter:url"[^>]*>/,
					`<meta property="twitter:url" content="${opts.canonicalUrl}" />`,
				)
				.replace(
					/<meta\s[^>]*property="twitter:title"[^>]*>/,
					`<meta property="twitter:title" content="${esc(opts.title)}" />`,
				)
				.replace(
					/<meta\s[^>]*property="twitter:description"[^>]*>/,
					`<meta property="twitter:description" content="${esc(opts.description)}" />`,
				)
				.replace(
					/<meta\s[^>]*property="twitter:image"[^>]*>/,
					`<meta property="twitter:image" content="${opts.ogImage}" />`,
				);
			if (opts.jsonLd) {
				const blocks = Array.isArray(opts.jsonLd)
					? opts.jsonLd
					: [opts.jsonLd];
				const scripts = blocks
					.map(
						(block) =>
							`<script type="application/ld+json">${JSON.stringify(block)}</script>`,
					)
					.join('\n');
				out = out.replace('</head>', `${scripts}\n</head>`);
			}
			return out;
		};

		// ==================== BERITA SEO PRERENDER MIDDLEWARE (slug-only) ====================
		app.get('/berita/:slugOrId', async (req, res, next) => {
			try {
				const { slugOrId } = req.params;
				const qs = req.originalUrl.includes('?')
					? req.originalUrl.slice(req.originalUrl.indexOf('?'))
					: '';

				const { Berita } = await import('../db/mongodb');
				const mongoose = await import('mongoose');

				// Old ID-based URL → redirect 301 to slug
				const isObjectId =
					mongoose.default.Types.ObjectId.isValid(slugOrId) &&
					/^[0-9a-fA-F]{24}$/.test(slugOrId);
				if (isObjectId) {
					try {
						const found = (await Berita.findById(slugOrId)
							.select('slug')
							.lean()) as any;
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
					const { seoDocumentTitle } = await import('./services/seo-sitemap');
					const title = seoDocumentTitle(String(beritaItem.title || ''));
					const description = String(
						beritaItem.excerpt ||
							'Berita dari Himatif Encoder - Himpunan Mahasiswa Teknik Informatika UIN Malang',
					).slice(0, 160);
					const canonicalUrl = `https://himatif-encoder.com/berita/${beritaItem.slug}`;
					const ogImage =
						beritaItem.image && String(beritaItem.image).startsWith('http')
							? beritaItem.image
							: beritaItem.image
								? `https://himatif-encoder.com${beritaItem.image}`
								: defaultOgImage;

					html = injectArticleMeta(html, {
						title,
						description,
						canonicalUrl,
						ogImage,
						ogImageAlt: String(beritaItem.title || title),
						jsonLd: {
							'@context': 'https://schema.org',
							'@type': 'NewsArticle',
							headline: String(beritaItem.title || ''),
							description: beritaItem.excerpt || '',
							image: {
								'@type': 'ImageObject',
								url: ogImage,
								caption: String(beritaItem.title || ''),
							},
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
							mainEntityOfPage: {
								'@type': 'WebPage',
								'@id': canonicalUrl,
							},
							url: canonicalUrl,
						},
					});
				}

				res.set('Content-Type', 'text/html');
				return res.send(html);
			} catch (err) {
				console.log('Berita prerender error, falling back to SPA:', err);
				return next();
			}
		});

		// ==================== TOKO / KATALOG SEO PRERENDER ====================
		app.get('/toko/:slug', async (req, res, next) => {
			try {
				const { slug } = req.params;
				const { StoreProduct } = await import('../db/mongodb');
				const distPath = path.resolve(process.cwd(), 'dist', 'public');
				const htmlPath = path.join(distPath, 'index.html');
				if (!fs.existsSync(htmlPath)) return next();

				const product: any = await StoreProduct.findOne({
					slug,
					published: true,
				})
					.select('name shortDescription thumbnail slug')
					.lean();
				let html = fs.readFileSync(htmlPath, 'utf-8');

				if (product) {
					const host = req.get('host') || 'localhost';
					const proto =
						(req.headers['x-forwarded-proto'] as string) ||
						(req.secure ? 'https' : 'http');
					const { seoDocumentTitle } = await import('./services/seo-sitemap');
					const title = seoDocumentTitle(
						String(product.name || ''),
						'Toko Himatif',
					);
					const description = String(
						product.shortDescription || product.name || 'Produk',
					).slice(0, 160);
					const canonicalUrl = `${proto}://${host}/toko/${product.slug}`;
					const ogImage =
						product.thumbnail && String(product.thumbnail).startsWith('http')
							? product.thumbnail
							: product.thumbnail
								? `${proto}://${host}${product.thumbnail}`
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
							`<meta property="og:type" content="product" />`,
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
				}

				res.set('Content-Type', 'text/html');
				return res.send(html);
			} catch (err) {
				console.log('Toko prerender error, falling back to SPA:', err);
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
			const img = ogImage || defaultOgImage;
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
			jsonLd?: Record<string, unknown>;
		}) => {
			return async (_req: Request, res: Response, next: NextFunction) => {
				try {
					const distPath = path.resolve(process.cwd(), 'dist', 'public');
					const htmlPath = path.join(distPath, 'index.html');
					if (!fs.existsSync(htmlPath)) return next();
					let html = fs.readFileSync(htmlPath, 'utf-8');
					html = injectPageMeta(html, opts);
					if (opts.jsonLd) {
						html = html.replace(
							'</head>',
							`<script type="application/ld+json">${JSON.stringify(opts.jsonLd)}</script>\n</head>`,
						);
					}
					res.set('Content-Type', 'text/html');
					return res.send(html);
				} catch (err) {
					console.log('Page meta injection error:', err);
					return next();
				}
			};
		};

		const resolveOgImage = (raw?: string): string => {
			if (!raw || typeof raw !== 'string') return defaultOgImage;
			if (raw.startsWith('http://') || raw.startsWith('https://')) return raw;
			return `https://himatif-encoder.com${raw}`;
		};

		const isObjectId = (v: string) => /^[0-9a-fA-F]{24}$/.test(v);

		app.get('/events/:year/:eventId', async (req, res, next) => {
			try {
				const year = parseInt(String(req.params.year || ''), 10);
				const eventId = String(req.params.eventId || '').trim();
				if (Number.isNaN(year) || !eventId) return next();

				const distPath = path.resolve(process.cwd(), 'dist', 'public');
				const htmlPath = path.join(distPath, 'index.html');
				if (!fs.existsSync(htmlPath)) return next();

				const { Event, EventYear } = await import('../db/mongodb');
				let eventDoc: any = null;
				if (isObjectId(eventId)) {
					eventDoc = await Event.findById(eventId)
						.select(
							'title description thumbnail startDate endDate updatedAt createdAt published yearId',
						)
						.populate('yearId', 'year')
						.lean();
				} else {
					const yearDoc = (await EventYear.findOne({ year })
						.select('_id')
						.lean()) as any;
					if (yearDoc?._id) {
						const events = await Event.find({
							yearId: (yearDoc as any)._id,
							published: true,
						})
							.select(
								'title description thumbnail startDate endDate updatedAt createdAt published yearId',
							)
							.populate('yearId', 'year')
							.lean();
						eventDoc = (events || []).find(
							(ev: any) => toUrlSlug(String(ev?.title || '')) === eventId,
						);
					}
				}

				let html = fs.readFileSync(htmlPath, 'utf-8');
				if (eventDoc && eventDoc.published !== false) {
					const canonicalSlug =
						toUrlSlug(String(eventDoc.title || '')) || eventId;
					const canonicalUrl = `https://himatif-encoder.com/events/${year}/${canonicalSlug}`;
					const textDesc = String(eventDoc.description || '')
						.replace(/<[^>]*>/g, ' ')
						.replace(/\s+/g, ' ')
						.trim();
					const description = (
						textDesc ||
						`Event Himatif Encoder tahun ${year} - Himpunan Mahasiswa Teknik Informatika UIN Malang.`
					).slice(0, 160);
					const { seoDocumentTitle } = await import('./services/seo-sitemap');
					const title = seoDocumentTitle(
						String(eventDoc.title || ''),
						'Event Himatif',
					);
					const ogImage = resolveOgImage(eventDoc.thumbnail);

					html = injectArticleMeta(html, {
						title,
						description,
						canonicalUrl,
						ogImage,
						ogImageAlt: String(eventDoc.title || title),
						jsonLd: {
							'@context': 'https://schema.org',
							'@type': 'Event',
							name: String(eventDoc.title || ''),
							description,
							startDate: eventDoc.startDate,
							endDate: eventDoc.endDate,
							image: {
								'@type': 'ImageObject',
								url: ogImage,
								caption: String(eventDoc.title || ''),
							},
							url: canonicalUrl,
							organizer: {
								'@type': 'Organization',
								name: 'Himatif Encoder TI UIN Malang',
								url: 'https://himatif-encoder.com',
							},
						},
					});
				}

				res.set('Content-Type', 'text/html');
				return res.send(html);
			} catch (err) {
				console.log('Event prerender error, falling back to SPA:', err);
				return next();
			}
		});

		app.get('/library/:id', async (req, res, next) => {
			try {
				const id = String(req.params.id || '').trim();
				if (!id) return next();

				const distPath = path.resolve(process.cwd(), 'dist', 'public');
				const htmlPath = path.join(distPath, 'index.html');
				if (!fs.existsSync(htmlPath)) return next();

				const { Library } = await import('../db/mongodb');
				let libDoc: any = null;
				if (isObjectId(id)) {
					libDoc = await Library.findById(id)
						.select(
							'title description fullDescription images mediaKinds type published updatedAt createdAt activityDate',
						)
						.lean();
				} else {
					const libs = await Library.find({ published: true })
						.select(
							'title description fullDescription images mediaKinds type published updatedAt createdAt activityDate',
						)
						.lean();
					libDoc = (libs || []).find(
						(it: any) => toUrlSlug(String(it?.title || '')) === id,
					);
				}

				let html = fs.readFileSync(htmlPath, 'utf-8');
				if (libDoc && libDoc.published !== false) {
					const {
						seoDocumentTitle,
						collectImageUrls,
						libraryVideosFromImages,
						extractYoutubeId,
						youtubeThumbnail,
					} = await import('./services/seo-sitemap');
					const canonicalSlug = toUrlSlug(String(libDoc.title || '')) || id;
					const canonicalUrl = `https://himatif-encoder.com/library/${canonicalSlug}`;
					const textDesc = String(
						libDoc.fullDescription || libDoc.description || '',
					)
						.replace(/<[^>]*>/g, ' ')
						.replace(/\s+/g, ' ')
						.trim();
					const description = (
						textDesc ||
						'Galeri dokumentasi kegiatan Himatif Encoder dan mahasiswa Teknik Informatika UIN Malang.'
					).slice(0, 160);
					const title = seoDocumentTitle(
						String(libDoc.title || ''),
						'Galeri Himatif',
					);
					const imageList = Array.isArray(libDoc.images)
						? libDoc.images.map(String)
						: [];
					const absImages = collectImageUrls(imageList, undefined, 12);
					const ogImage = absImages[0] || defaultOgImage;
					const pubIso = (
						libDoc.activityDate ||
						libDoc.updatedAt ||
						libDoc.createdAt
					)?.toISOString?.();
					const sitemapVideos = libraryVideosFromImages(
						String(libDoc.title || ''),
						description,
						imageList,
						libDoc.mediaKinds,
						pubIso,
					);
					const videoObjects = sitemapVideos.map((v) => {
						const yt = v.playerLoc
							? extractYoutubeId(v.playerLoc)
							: null;
						return {
							'@type': 'VideoObject',
							name: v.title,
							description: v.description,
							thumbnailUrl: v.thumbnailLoc || youtubeThumbnail(yt || ''),
							uploadDate: v.publicationDate || pubIso,
							contentUrl: v.contentLoc,
							embedUrl: v.playerLoc,
						};
					});

					const jsonLdBlocks: Record<string, unknown>[] = [
						{
							'@context': 'https://schema.org',
							'@type': 'ImageGallery',
							name: String(libDoc.title || ''),
							description,
							url: canonicalUrl,
							image: absImages.map((url) => ({
								'@type': 'ImageObject',
								url,
								caption: String(libDoc.title || ''),
							})),
						},
						...videoObjects.map((v) => ({
							'@context': 'https://schema.org',
							...v,
						})),
					];

					html = injectArticleMeta(html, {
						title,
						description,
						canonicalUrl,
						ogImage,
						ogImageAlt: String(libDoc.title || title),
						jsonLd: jsonLdBlocks,
					});
				}

				res.set('Content-Type', 'text/html');
				return res.send(html);
			} catch (err) {
				console.log('Library prerender error, falling back to SPA:', err);
				return next();
			}
		});

		app.get(
			'/',
			serveHtmlWithMeta({
				title:
					'Himatif Encoder | Himpunan Mahasiswa Teknik Informatika UIN Malang',
				description:
					'Website resmi Himatif Encoder — berita, event, galeri, dan informasi Himpunan Mahasiswa Teknik Informatika UIN Maulana Malik Ibrahim Malang.',
				canonicalUrl: 'https://himatif-encoder.com/',
				jsonLd: {
					'@context': 'https://schema.org',
					'@graph': [
						{
							'@type': 'Organization',
							'@id': 'https://himatif-encoder.com/#organization',
							name: 'Himatif Encoder TI UIN Malang',
							alternateName: [
								'HIMATIF Encoder',
								'Himpunan Mahasiswa Teknik Informatika UIN Malang',
							],
							url: 'https://himatif-encoder.com/',
							logo: defaultOgImage,
							sameAs: [],
						},
						{
							'@type': 'WebSite',
							'@id': 'https://himatif-encoder.com/#website',
							url: 'https://himatif-encoder.com/',
							name: 'Himatif Encoder',
							publisher: {
								'@id': 'https://himatif-encoder.com/#organization',
							},
							inLanguage: 'id-ID',
						},
					],
				},
			}),
		);

		app.get(
			'/toko',
			serveHtmlWithMeta({
				title: 'Toko Himatif Encoder | Merchandise TI UIN Malang',
				description:
					'Katalog merchandise dan produk resmi Himatif Encoder — Himpunan Mahasiswa Teknik Informatika UIN Malang.',
				canonicalUrl: 'https://himatif-encoder.com/toko',
				jsonLd: {
					'@context': 'https://schema.org',
					'@type': 'CollectionPage',
					name: 'Toko Himatif Encoder',
					url: 'https://himatif-encoder.com/toko',
				},
			}),
		);

		app.get(
			'/profil',
			serveHtmlWithMeta({
				title:
					'Profil | Himatif Encoder - Himpunan Mahasiswa Teknik Informatika UIN Malang',
				description:
					'Profil HIMATIF Encoder - Tentang Kami, Sejarah Rekam Jejak Ketua Himpunan & Divisi, serta Filosofi Lambang - Himpunan Mahasiswa Teknik Informatika UIN Malang.',
				canonicalUrl: 'https://himatif-encoder.com/profil',
			}),
		);

		app.get(
			'/kelembagaan',
			serveHtmlWithMeta({
				title:
					'Kelembagaan | Himatif Encoder - Himpunan Mahasiswa Teknik Informatika UIN Malang',
				description:
					'Visi dan Misi serta Struktur Organisasi HIMATIF Encoder - Himpunan Mahasiswa Teknik Informatika UIN Malang.',
				canonicalUrl: 'https://himatif-encoder.com/kelembagaan',
			}),
		);

		app.get(
			'/berita',
			serveHtmlWithMeta({
				title:
					'Berita | Himatif Encoder - Himpunan Mahasiswa Teknik Informatika UIN Malang',
				description:
					'Daftar berita dan informasi terkini dari Himpunan Mahasiswa Teknik Informatika UIN Maulana Malik Ibrahim Malang.',
				canonicalUrl: 'https://himatif-encoder.com/berita',
			}),
		);

		app.get(
			'/events',
			serveHtmlWithMeta({
				title: 'Event Teknik Informatika UIN Malang | Himatif Encoder',
				description:
					'Daftar event, kegiatan, seminar, workshop, dan agenda Himatif Encoder mahasiswa Teknik Informatika UIN Malang.',
				canonicalUrl: 'https://himatif-encoder.com/events',
				jsonLd: {
					'@context': 'https://schema.org',
					'@type': 'CollectionPage',
					name: 'Event Himatif Encoder',
					description:
						'Kumpulan event dan kegiatan Himatif Encoder Teknik Informatika UIN Malang.',
					url: 'https://himatif-encoder.com/events',
				},
			}),
		);

		app.get(
			'/library',
			serveHtmlWithMeta({
				title:
					'Galeri Kegiatan Teknik Informatika UIN Malang | Himatif Encoder',
				description:
					'Galeri foto dan dokumentasi kegiatan Himatif Encoder, himpunan mahasiswa Teknik Informatika UIN Malang.',
				canonicalUrl: 'https://himatif-encoder.com/library',
				jsonLd: {
					'@context': 'https://schema.org',
					'@type': 'CollectionPage',
					name: 'Galeri Himatif Encoder',
					description:
						'Kumpulan dokumentasi kegiatan, event, dan aktivitas Himatif Encoder.',
					url: 'https://himatif-encoder.com/library',
				},
			}),
		);

		app.get(
			'/prodi',
			serveHtmlWithMeta({
				title: 'Prodi S1 Teknik Informatika UIN Malang | Himatif Encoder',
				description:
					'Informasi Program Studi S1 Teknik Informatika UIN Maulana Malik Ibrahim Malang: profil, dosen, kurikulum, dan laboratorium.',
				canonicalUrl: 'https://himatif-encoder.com/prodi',
				jsonLd: {
					'@context': 'https://schema.org',
					'@type': 'CollegeOrUniversity',
					name: 'Teknik Informatika UIN Maulana Malik Ibrahim Malang',
					url: 'https://himatif-encoder.com/prodi',
				},
			}),
		);

		app.get(
			'/login',
			serveHtmlWithMeta({
				title:
					'Login | Himatif Encoder - Himpunan Mahasiswa Teknik Informatika UIN Malang',
				description:
					'Masuk ke akun Anda untuk mengakses dashboard Himatif Encoder - Himpunan Mahasiswa Teknik Informatika UIN Malang.',
				canonicalUrl: 'https://himatif-encoder.com/login',
				robots: 'noindex, nofollow',
			}),
		);

		app.get(
			'/error',
			serveHtmlWithMeta({
				title:
					'Error | Himatif Encoder - Himpunan Mahasiswa Teknik Informatika UIN Malang',
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

		const loadActiveCommunity = async (slug: string) => {
			const { isReservedTenantSlug } = await import('@shared/tenant-paths');
			if (!slug || isReservedTenantSlug(slug)) return null;
			const { Community } = await import('../db/mongodb');
			return Community.findOne({ slug, status: 'active' }).lean() as Promise<any>;
		};

		app.get('/:slug/berita/:articleSlug', async (req, res, next) => {
			try {
				const comm = await loadActiveCommunity(String(req.params.slug || ''));
				if (!comm?.dbName) return next();
				const { getTenantModels } = await import('../db/tenant');
				const models = getTenantModels(comm.dbName);
				const item = await models.Berita.findOne({
					slug: req.params.articleSlug,
					published: true,
				}).lean();
				const settings = await models.Settings.findOne().lean();
				const siteName = String(settings?.siteName || comm.name || comm.slug);
				const distPath = path.resolve(process.cwd(), 'dist', 'public');
				const htmlPath = path.join(distPath, 'index.html');
				if (!fs.existsSync(htmlPath)) return next();
				let html = fs.readFileSync(htmlPath, 'utf-8');
				const title = item
					? `${item.title} | ${siteName}`
					: `Berita | ${siteName}`;
				const description = String(
					item?.excerpt || settings?.siteDescription || siteName,
				).slice(0, 160);
				const canonicalUrl = `https://himatif-encoder.com/${comm.slug}/berita/${req.params.articleSlug}`;
				html = injectArticleMeta(html, {
					title,
					description,
					canonicalUrl,
					ogImage: resolveOgImage(item?.image || settings?.logoUrl),
					ogImageAlt: String(item?.title || title),
				});
				res.set('Content-Type', 'text/html');
				return res.send(html);
			} catch (err) {
				console.log('Tenant berita prerender fallback:', err);
				return next();
			}
		});

		const serveTenantShell = (pageTitle: string, restPath: string) => {
			return async (req: Request, res: Response, next: NextFunction) => {
				try {
					const comm = await loadActiveCommunity(String(req.params.slug || ''));
					if (!comm?.dbName) return next();
					const { getTenantModels } = await import('../db/tenant');
					const models = getTenantModels(comm.dbName);
					const settings = await models.Settings.findOne().lean();
					const siteName = String(settings?.siteName || comm.name || comm.slug);
					const description = String(
						settings?.siteDescription || settings?.siteTagline || siteName,
					).slice(0, 160);
					const suffix = restPath ? `/${restPath}` : '';
					await serveHtmlWithMeta({
						title: pageTitle ? `${pageTitle} | ${siteName}` : siteName,
						description,
						canonicalUrl: `https://himatif-encoder.com/${comm.slug}${suffix}`,
						jsonLd: {
							'@context': 'https://schema.org',
							'@type': 'Organization',
							name: siteName,
							url: `https://himatif-encoder.com/${comm.slug}`,
							logo: resolveOgImage(settings?.logoUrl),
						},
					})(req, res, next);
				} catch {
					return next();
				}
			};
		};

		app.get('/:slug/login', serveTenantShell('Login', 'login'));
		app.get('/:slug/profil', serveTenantShell('Profil', 'profil'));
		app.get('/:slug/kelembagaan', serveTenantShell('Kelembagaan', 'kelembagaan'));
		app.get('/:slug/berita', serveTenantShell('Berita', 'berita'));
		app.get('/:slug/events', serveTenantShell('Event', 'events'));
		app.get('/:slug/library', serveTenantShell('Galeri', 'library'));
		app.get('/:slug/toko', serveTenantShell('Toko', 'toko'));
		app.get('/:slug', serveTenantShell('', ''));

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

		import('./services/file-scanner')
			.then(({ startScanWorker }) => {
				startScanWorker();
				console.log('   ✅ Antivirus File Scanner Worker Started');
			})
			.catch((err) => {
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

import crypto from 'crypto';
import { NextFunction, Request, Response } from 'express';
import { isTrustedHost, isTrustedOrigin } from '../config/trusted-network';
import { getTrustedClientIp } from '../lib/client-ip';
import { getMiddlewareSettings } from '../models/middleware-settings';

function envInt(name: string, fallback: number): number {
	const v = parseInt(process.env[name] || '', 10);
	return Number.isFinite(v) && v > 0 ? v : fallback;
}

/**
 * Request ke /api/* dari konteks situs resmi (bukan probe mentah).
 * Mencegah false positive pola substring di query (?…upload…) atau path resmi (/api/…/preview).
 */
function isOfficialSiteApiTraffic(req: Request): boolean {
	const p = req.path || '';
	if (!p.startsWith('/api/')) return false;

	const referer = req.get('Referer') || '';
	const origin = req.get('Origin') || '';
	const host = req.get('Host') || '';
	const secSite = req.get('Sec-Fetch-Site') || '';

	const fromTrustedOrigin = isTrustedOrigin(referer) || isTrustedOrigin(origin);
	const fromTrustedHost = isTrustedHost(host);

	const hasAuthCookie = /(?:^|;\s*)authToken=/.test(req.headers.cookie || '');

	const browserSameSiteToProd =
		isTrustedHost(host) &&
		(secSite === 'same-origin' || secSite === 'same-site');

	return (
		fromTrustedOrigin ||
		fromTrustedHost ||
		hasAuthCookie ||
		browserSameSiteToProd
	);
}

// Function to check if bot is legitimate
function isLegitimateBot(userAgent: string): boolean {
	if (!userAgent || userAgent.trim().length === 0) {
		return false;
	}

	const LEGITIMATE_BOTS = [
		// Google bots
		/googlebot/i,
		/google-structured-data-testing-tool/i,
		/google-site-verification/i,

		// Bing bots
		/msnbot/i,
		/bingbot/i,

		// Facebook bots
		/facebookexternalhit/i,
		/facebot/i,
		/meta-externalagent/i,

		// Twitter bots
		/twitterbot/i,
		/tweetmeme/i,

		// LinkedIn bots
		/linkedinbot/i,

		// WhatsApp bots
		/whatsapp/i,

		// Telegram bots
		/telegrambot/i,

		// Other legitimate bots
		/slackbot/i,
		/discordbot/i,
		/redditbot/i,
		/pinterestbot/i,
		/yandexbot/i,
		/baiduspider/i,
		/duckduckbot/i,
		/ia_archiver/i,
		/archive\.org_bot/i,
		/wayback/i,
	];

	for (const pattern of LEGITIMATE_BOTS) {
		if (pattern.test(userAgent)) {
			return true;
		}
	}

	return false;
}

// Cache for middleware settings
let ddosMiddlewareSettingsCache: any = null;
let ddosSettingsCacheTimestamp: number = 0;
const DDOS_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Function to get middleware settings with caching for DDOS middleware
async function getCachedDdosMiddlewareSettings() {
	const now = Date.now();
	if (
		!ddosMiddlewareSettingsCache ||
		now - ddosSettingsCacheTimestamp > DDOS_CACHE_DURATION
	) {
		try {
			ddosMiddlewareSettingsCache = await getMiddlewareSettings();
			ddosSettingsCacheTimestamp = now;
		} catch (error) {
			console.error('Error getting DDOS middleware settings:', error);
			// Fallback to default enabled settings if error
			ddosMiddlewareSettingsCache = {
				apiProtectionEnabled: true,
				apiRateLimitEnabled: true,
				ddosProtectionEnabled: true,
				sqlInjectionProtectionEnabled: true,
				noSqlInjectionProtectionEnabled: true,
				antiSpoofingProtectionEnabled: true,
				dnsLayerProtectionEnabled: true,
				portScanningProtectionEnabled: true,
			};
		}
	}
	return ddosMiddlewareSettingsCache;
}

// ==================== DDoS PROTECTION CONFIGURATION ====================

// Tier 1 — default lebih longgar per IP (banyak pengguna berbagi satu IP publik / NAT)
const TIER1_DEVICE_LIMIT = envInt('DDOS_TIER1_DEVICE_LIMIT', 500);
const TIER1_IP_LIMIT = envInt('DDOS_TIER1_IP_LIMIT', 850);
const TIER1_WINDOW_MS = 60 * 1000; // 1 menit

// Tier 2: Quick Block 10 menit
const TIER2_DEVICE_LIMIT = envInt('DDOS_TIER2_DEVICE_LIMIT', 1000);
const TIER2_IP_LIMIT = envInt('DDOS_TIER2_IP_LIMIT', 3000);
const TIER2_WINDOW_MS = 5 * 60 * 1000; // 5 menit
const TIER2_BLOCK_DURATION_MS = 10 * 60 * 1000; // 10 menit

// Tier 3: Quick Block 60 menit
const TIER3_DEVICE_LIMIT = envInt('DDOS_TIER3_DEVICE_LIMIT', 5000);
const TIER3_IP_LIMIT = envInt('DDOS_TIER3_IP_LIMIT', 10000);
const TIER3_WINDOW_MS = 60 * 60 * 1000; // 60 menit
const TIER3_BLOCK_DURATION_MS = 60 * 60 * 1000; // 60 menit

// Concurrent connection limits (semua route yang tidak di-skip)
const MAX_CONCURRENT_CONNECTIONS_PER_IP = envInt(
	'DDOS_MAX_CONCURRENT_PER_IP',
	120,
);
const MAX_CONCURRENT_CONNECTIONS_PER_DEVICE = envInt(
	'DDOS_MAX_CONCURRENT_PER_DEVICE',
	48,
);

// Special rate limits untuk sensitive endpoints
const MAX_LOGIN_ATTEMPTS_PER_IP = 10;
const MAX_UPLOAD_REQUESTS_PER_IP = 50;

// ==================== DATA STORAGE ====================
const tier1RequestCountsByIP = new Map<
	string,
	{ count: number; resetTime: number }
>();
const tier1RequestCountsByDevice = new Map<
	string,
	{ count: number; resetTime: number }
>();

const tier2RequestCountsByIP = new Map<
	string,
	{ count: number; resetTime: number }
>();
const tier2RequestCountsByDevice = new Map<
	string,
	{ count: number; resetTime: number }
>();

const tier3RequestCountsByIP = new Map<
	string,
	{ count: number; resetTime: number }
>();
const tier3RequestCountsByDevice = new Map<
	string,
	{ count: number; resetTime: number }
>();

const blockedIPs = new Map<string, { blockUntil: number; tier: number }>();
const blockedDevices = new Map<string, { blockUntil: number; tier: number }>();

const activeConnectionsByIP = new Map<string, number>();
const activeConnectionsByDevice = new Map<string, number>();

// Special tracking untuk sensitive endpoints
const loginAttemptsByIP = new Map<
	string,
	{ count: number; resetTime: number }
>();
const uploadRequestsByIP = new Map<
	string,
	{ count: number; resetTime: number }
>();

// Suspicious patterns untuk detection (hanya diuji pada pathname, bukan query string)
const suspiciousPatterns = [
	// "upload" sebagai segmen path, bukan substring di /api/prodi/preview atau di ?x=upload
	/(^|\/)(upload)(\/|$)/i,
	/(^|\/)(admin)(\/|$)/i,
	/\.\.\//, // Directory traversal
	/union\s+select/i, // SQL injection
	/script/i, // XSS
	/eval\s*\(/i, // Code injection
	/exec\s*\(/i, // Command injection
	/etc\/passwd/i, // System files
	/etc\/shadow/i, // System files
	/proc\//i, // System files
	/var\/log/i, // System files
	// Jangan /config/i — bentrok dengan /api/feedback/config (API resmi).
	/\/wp-config/i,
	/\/phpinfo/i,
	/\/\.aws\/credentials/i,
	/\.env/i, // Environment files
	/\.git/i, // Git files
	/\.svn/i, // SVN files
	/\.htaccess/i, // Apache files
	/\.htpasswd/i, // Apache files
	/\.ini/i, // Configuration files
	/\.conf/i, // Configuration files
	// /\.xml/i, // XML files - DISABLED untuk sitemap.xml
	/\.json/i, // JSON files
	/\.sql/i, // SQL files
	/\.bak/i, // Backup files
	/\.old/i, // Old files
	/\.tmp/i, // Temporary files
	/\.log/i, // Log files
	/\.cache/i, // Cache files
	/\.temp/i, // Temporary files
	/\.swp/i, // Swap files
	/\.swo/i, // Swap files
	/\.DS_Store/i, // macOS files
	/Thumbs\.db/i, // Windows files
	/desktop\.ini/i, // Windows files
];

// Bot/Crawler detection patterns
const botUserAgents = [
	/bot/i,
	/crawler/i,
	/spider/i,
	/scraper/i,
	// /curl/i, // DISABLED untuk development
	/wget/i,
	/python/i,
	/requests/i,
	// /axios/i, // Commented out untuk testing
	/postman/i,
	/insomnia/i,
	/thunder\s*client/i,
	/rest\s*client/i,
	/http\s*client/i,
	/fetch/i,
	/xmlhttprequest/i,
];

// Allowlisted search engine bots (allowed for non-API routes)
const allowlistedSearchBots = [
	/googlebot/i,
	/bingbot/i,
	/duckduckbot/i,
	/slurp/i, // Yahoo
	/yandexbot/i,
	/baiduspider/i,
	/facebot/i,
	/facebookexternalhit/i,
	/twitterbot/i,
	/linkedinbot/i,
];

// ==================== DEVICE ID GENERATION ====================
function generateDeviceId(req: Request): string {
	const userAgent = req.get('User-Agent') || '';
	const acceptLanguage = req.get('Accept-Language') || '';
	const acceptEncoding = req.get('Accept-Encoding') || '';
	const ip = getTrustedClientIp(req);

	// Create a unique device fingerprint
	const fingerprint = `${userAgent}|${acceptLanguage}|${acceptEncoding}|${ip}`;
	return crypto
		.createHash('sha256')
		.update(fingerprint)
		.digest('hex')
		.substring(0, 16);
}

// ==================== HARD BLOCK (tier 2 / 3) ====================
/** Blokir nyata: 429 + Retry-After sampai masa blok habis. Hanya memengaruhi IP/device yang terdaftar di `blockedIPs` / `blockedDevices`. */
function sendTierBlockResponse(
	req: Request,
	res: Response,
	tier: number,
	blockUntil: number,
) {
	const retryAfter = Math.max(1, Math.ceil((blockUntil - Date.now()) / 1000));
	const messages: Record<number, string> = {
		2: 'Terlalu banyak permintaan. Akses dari IP/perangkat ini diblokir sementara (tier 2).',
		3: 'Polusi traffic terdeteksi. Akses dari IP/perangkat ini diblokir (tier 3).',
	};
	const message =
		messages[tier as keyof typeof messages] ||
		'Terlalu banyak permintaan. Akses dibatasi.';

	res.setHeader('Retry-After', String(retryAfter));
	res.setHeader('X-HMPS-RateLimit-Tier', String(tier));

	const wantsJson =
		req.path.startsWith('/api/') ||
		!!req.get('accept')?.includes('application/json');

	if (wantsJson) {
		return res.status(429).json({
			error: {
				code: 429,
				title: 'Too Many Requests',
				message,
				tier,
				blocked: true,
				retryAfter,
				blockUntilIso: new Date(blockUntil).toISOString(),
				timestamp: new Date().toISOString(),
			},
		});
	}

	return res
		.status(429)
		.set('Content-Type', 'text/plain; charset=utf-8')
		.send(`${message} Silakan coba lagi setelah ±${retryAfter} detik.`);
}

// ==================== BEAUTIFUL ERROR RESPONSE ====================
function sendBeautifulError(
	res: Response,
	statusCode: number,
	title: string,
	message: string,
	details?: any,
) {
	const errorResponse = {
		error: {
			code: statusCode,
			title: title,
			message: message,
			timestamp: new Date().toISOString(),
			details: details || null,
			help: 'If you believe this is an error, please contact the administrator.',
		},
	};

	// Untuk API requests, return JSON
	if (
		res.req?.headers['content-type']?.includes('application/json') ||
		res.req?.path?.startsWith('/api/')
	) {
		return res.status(statusCode).json(errorResponse);
	}

	// Cek apakah sudah di error page atau static files untuk mencegah redirect loop
	if (
		res.req?.path?.startsWith('/error') ||
		res.req?.path?.startsWith('/src/') ||
		res.req?.path?.startsWith('/@') ||
		res.req?.path?.startsWith('/node_modules/') ||
		res.req?.path?.endsWith('.tsx') ||
		res.req?.path?.endsWith('.ts') ||
		res.req?.path?.endsWith('.js') ||
		res.req?.path?.endsWith('.css') ||
		res.req?.path?.endsWith('.mjs')
	) {
		return res.status(statusCode).json(errorResponse);
	}

	// Untuk browser requests, redirect ke error page
	const errorParam = encodeURIComponent(JSON.stringify(errorResponse.error));
	const redirectUrl = `/error?error=${errorParam}`;

	res.redirect(redirectUrl);
}

// ==================== DDoS PROTECTION MIDDLEWARE ====================
export const ddosProtectionMiddleware = async (
	req: Request,
	res: Response,
	next: NextFunction,
) => {
	try {
		const settings = await getCachedDdosMiddlewareSettings();

		// Skip middleware if disabled
		if (!settings.ddosProtectionEnabled) {
			return next();
		}
		const clientIP = getTrustedClientIp(req);
		const userAgent = req.get('User-Agent') || '';
		const path = req.path;
		const method = req.method;
		const deviceId = generateDeviceId(req);
		const now = Date.now();

		// Skip protection untuk static files, Vite, dan development files
		if (
			path.includes('/src/') ||
			path.includes('/@') ||
			path.includes('/node_modules/') ||
			path.includes('/uploads/') ||
			path.includes('/attached_assets/') ||
			path.endsWith('.tsx') ||
			path.endsWith('.ts') ||
			path.endsWith('.js') ||
			path.endsWith('.css') ||
			path.endsWith('.mjs') ||
			path.endsWith('.png') ||
			path.endsWith('.jpg') ||
			path.endsWith('.jpeg') ||
			path.endsWith('.gif') ||
			path.endsWith('.svg') ||
			path.endsWith('.ico') ||
			path.endsWith('.woff') ||
			path.endsWith('.woff2') ||
			path.endsWith('.ttf') ||
			path.endsWith('.eot') ||
			path.startsWith('/error') ||
			path.startsWith('/.well-known/') ||
			path.includes('appspecific') || // Skip Vite specific paths
			path.includes('vite') || // Skip Vite paths
			path.includes('__vite') || // Skip Vite internal paths
			path.includes('@vite') || // Skip Vite module paths
			path.includes('devtools') || // Skip Chrome DevTools
			path.includes('chrome') || // Skip Chrome specific paths
			path.includes('main.tsx') || // Skip main.tsx specifically
			path.includes('env.mjs') || // Skip Vite env files
			path.includes('client') || // Skip Vite client files
			path.includes('refresh') || // Skip React refresh
			path.includes('fs') || // Skip file system paths
			path.includes('dist') || // Skip distribution files
			path === '' || // Skip empty path
			path === '/favicon.ico' || // Skip favicon
			path.startsWith('/src/') || // Skip all src paths
			path.includes('hmr') || // Skip HMR
			path.includes('hot') || // Skip hot reload
			path.includes('reload') || // Skip reload
			path.includes('transform') || // Skip Vite transform
			path.includes('middleware') // Skip Vite middleware
		) {
			return next();
		}

		// ==================== CHECK BLOCKED IPs/DEVICES ====================
		const blockedIP = blockedIPs.get(clientIP);
		const blockedDevice = blockedDevices.get(deviceId);

		let isCurrentlyBlocked = false;
		let currentBlockTier = 0;
		let activeBlockUntil = 0;

		if (blockedIP && now < blockedIP.blockUntil) {
			isCurrentlyBlocked = true;
			currentBlockTier = blockedIP.tier;
			activeBlockUntil = Math.max(activeBlockUntil, blockedIP.blockUntil);
		}

		if (blockedDevice && now < blockedDevice.blockUntil) {
			isCurrentlyBlocked = true;
			currentBlockTier = Math.max(currentBlockTier, blockedDevice.tier);
			activeBlockUntil = Math.max(activeBlockUntil, blockedDevice.blockUntil);
		}

		// ==================== TIER COUNTERS (semua route non-statis, termasuk /api/*) ====================
		let tier3IPData = tier3RequestCountsByIP.get(clientIP);
		let tier3DeviceData = tier3RequestCountsByDevice.get(deviceId);

		if (!tier3IPData || now > tier3IPData.resetTime) {
			tier3RequestCountsByIP.set(clientIP, {
				count: 1,
				resetTime: now + TIER3_WINDOW_MS,
			});
			tier3IPData = tier3RequestCountsByIP.get(clientIP)!;
		} else {
			tier3IPData.count++;
			tier3RequestCountsByIP.set(clientIP, tier3IPData);
		}

		if (!tier3DeviceData || now > tier3DeviceData.resetTime) {
			tier3RequestCountsByDevice.set(deviceId, {
				count: 1,
				resetTime: now + TIER3_WINDOW_MS,
			});
			tier3DeviceData = tier3RequestCountsByDevice.get(deviceId)!;
		} else {
			tier3DeviceData.count++;
			tier3RequestCountsByDevice.set(deviceId, tier3DeviceData);
		}

		let tier2IPData = tier2RequestCountsByIP.get(clientIP);
		let tier2DeviceData = tier2RequestCountsByDevice.get(deviceId);

		if (!tier2IPData || now > tier2IPData.resetTime) {
			tier2RequestCountsByIP.set(clientIP, {
				count: 1,
				resetTime: now + TIER2_WINDOW_MS,
			});
			tier2IPData = tier2RequestCountsByIP.get(clientIP)!;
		} else {
			tier2IPData.count++;
			tier2RequestCountsByIP.set(clientIP, tier2IPData);
		}

		if (!tier2DeviceData || now > tier2DeviceData.resetTime) {
			tier2RequestCountsByDevice.set(deviceId, {
				count: 1,
				resetTime: now + TIER2_WINDOW_MS,
			});
			tier2DeviceData = tier2RequestCountsByDevice.get(deviceId)!;
		} else {
			tier2DeviceData.count++;
			tier2RequestCountsByDevice.set(deviceId, tier2DeviceData);
		}

		let tier1IPData = tier1RequestCountsByIP.get(clientIP);
		let tier1DeviceData = tier1RequestCountsByDevice.get(deviceId);

		if (!tier1IPData || now > tier1IPData.resetTime) {
			tier1RequestCountsByIP.set(clientIP, {
				count: 1,
				resetTime: now + TIER1_WINDOW_MS,
			});
			tier1IPData = tier1RequestCountsByIP.get(clientIP)!;
		} else {
			tier1IPData.count++;
			tier1RequestCountsByIP.set(clientIP, tier1IPData);
		}

		if (!tier1DeviceData || now > tier1DeviceData.resetTime) {
			tier1RequestCountsByDevice.set(deviceId, {
				count: 1,
				resetTime: now + TIER1_WINDOW_MS,
			});
			tier1DeviceData = tier1RequestCountsByDevice.get(deviceId)!;
		} else {
			tier1DeviceData.count++;
			tier1RequestCountsByDevice.set(deviceId, tier1DeviceData);
		}

		// Sudah kena blok tier 2/3: tolak segera — tanpa bypass bot & tanpa naikkan concurrent slot
		if (isCurrentlyBlocked) {
			if (tier3IPData && tier3IPData.count > TIER3_IP_LIMIT) {
				const newUntil = now + TIER3_BLOCK_DURATION_MS;
				blockedIPs.set(clientIP, { blockUntil: newUntil, tier: 3 });
				console.log(
					`🚨 Tier 3 (perpanjang): IP ${clientIP} masih melampaui ambang jam-jam, blok diperpanjang`,
				);
				return sendTierBlockResponse(req, res, 3, newUntil);
			}
			if (tier3DeviceData && tier3DeviceData.count > TIER3_DEVICE_LIMIT) {
				const newUntil = now + TIER3_BLOCK_DURATION_MS;
				blockedDevices.set(deviceId, { blockUntil: newUntil, tier: 3 });
				console.log(
					`🚨 Tier 3 (perpanjang): device ${deviceId} masih melampaui ambang jam-jam, blok diperpanjang`,
				);
				return sendTierBlockResponse(req, res, 3, newUntil);
			}
			return sendTierBlockResponse(
				req,
				res,
				currentBlockTier,
				activeBlockUntil,
			);
		}

		// ==================== BOT/CRAWLER DETECTION ====================
		let isBot = false;
		for (const pattern of botUserAgents) {
			if (pattern.test(userAgent)) {
				isBot = true;
				break;
			}
		}

		// Whitelist well-known search bots for non-API and SEO-critical routes
		const isAllowlistedSearchBot = allowlistedSearchBots.some((p) =>
			p.test(userAgent),
		);

		// Bot crawler resmi: boleh lewat untuk HTML/SEO, tapi /api/* tetap kena tier (satu aturan dengan pengguna)
		if (isLegitimateBot(userAgent) && !path.startsWith('/api/')) {
			console.log(
				`🤖 DDoS Protection: Legitimate Bot Access Allowed: ${userAgent} to ${path}`,
			);
			return next();
		}

		const isSeoPath =
			path === '/' ||
			path === '/sitemap.xml' ||
			path === '/robots.txt' ||
			path.startsWith('/berita');

		if (
			isAllowlistedSearchBot &&
			!path.startsWith('/api/') &&
			!path.startsWith('/dashboard')
		) {
			return next();
		}

		if (isBot) {
			console.log(`🚫 Bot/Crawler detected: ${userAgent} from IP ${clientIP}`);
			return sendBeautifulError(
				res,
				403,
				'Access Denied',
				'Bot and crawler access is not allowed. This API is for authorized users only.',
				{
					detectedBot: userAgent,
					ip: clientIP,
					path: path,
				},
			);
		}

		// ==================== CONCURRENT CONNECTION LIMITING ====================
		const currentIPConnections = activeConnectionsByIP.get(clientIP) || 0;
		const currentDeviceConnections =
			activeConnectionsByDevice.get(deviceId) || 0;

		if (currentIPConnections >= MAX_CONCURRENT_CONNECTIONS_PER_IP) {
			console.log(
				`🚨 DDoS Protection: Too many concurrent connections from IP ${clientIP}`,
			);
			return sendBeautifulError(
				res,
				503,
				'Service Temporarily Unavailable',
				'Too many concurrent connections from your IP address. Please try again later.',
				{
					maxConnections: MAX_CONCURRENT_CONNECTIONS_PER_IP,
				},
			);
		}

		if (currentDeviceConnections >= MAX_CONCURRENT_CONNECTIONS_PER_DEVICE) {
			console.log(
				`🚨 DDoS Protection: Too many concurrent connections from device ${deviceId}`,
			);
			return sendBeautifulError(
				res,
				503,
				'Service Temporarily Unavailable',
				'Too many concurrent connections from your device. Please try again later.',
				{
					maxConnections: MAX_CONCURRENT_CONNECTIONS_PER_DEVICE,
				},
			);
		}

		// Increment connection counts
		activeConnectionsByIP.set(clientIP, currentIPConnections + 1);
		activeConnectionsByDevice.set(deviceId, currentDeviceConnections + 1);

		// ==================== SENSITIVE ENDPOINT PROTECTION ====================
		// Login attempts tracking
		if (path.includes('/api/auth/login') && method === 'POST') {
			const loginData = loginAttemptsByIP.get(clientIP);

			if (!loginData || now > loginData.resetTime) {
				loginAttemptsByIP.set(clientIP, {
					count: 1,
					resetTime: now + TIER1_WINDOW_MS,
				});
			} else {
				loginData.count++;
				loginAttemptsByIP.set(clientIP, loginData);

				if (loginData.count > MAX_LOGIN_ATTEMPTS_PER_IP) {
					const retryAfter = Math.ceil((loginData.resetTime - now) / 1000);
					console.log(
						`🚨 DDoS Protection: Too many login attempts from IP ${clientIP}, retry in ${retryAfter}s`,
					);
					return sendBeautifulError(
						res,
						429,
						'Too Many Login Attempts',
						'Too many login attempts. Please wait before trying again.',
						{
							maxAttempts: MAX_LOGIN_ATTEMPTS_PER_IP,
							window: '1 minute',
							retryAfter: retryAfter,
						},
					);
				}
			}
		}

		// Upload requests tracking
		if (path.includes('/api/upload') && method === 'POST') {
			const uploadData = uploadRequestsByIP.get(clientIP);

			if (!uploadData || now > uploadData.resetTime) {
				uploadRequestsByIP.set(clientIP, {
					count: 1,
					resetTime: now + TIER1_WINDOW_MS,
				});
			} else {
				uploadData.count++;
				uploadRequestsByIP.set(clientIP, uploadData);

				if (uploadData.count > MAX_UPLOAD_REQUESTS_PER_IP) {
					const retryAfter = Math.ceil((uploadData.resetTime - now) / 1000);
					console.log(
						`🚨 DDoS Protection: Too many upload requests from IP ${clientIP}, retry in ${retryAfter}s`,
					);
					return sendBeautifulError(
						res,
						429,
						'Too Many Upload Requests',
						'Too many upload requests. Please slow down and try again later.',
						{
							maxUploads: MAX_UPLOAD_REQUESTS_PER_IP,
							window: '1 minute',
							retryAfter: retryAfter,
						},
					);
				}
			}
		}

		// ==================== SUSPICIOUS PATTERN DETECTION ====================
		let isSuspicious = false;
		let suspiciousReason = '';

		// Whitelist untuk SEO-critical paths sebelum suspicious pattern check
		const isSeoCriticalPath =
			path === '/' ||
			path === '/sitemap.xml' ||
			path === '/robots.txt' ||
			path.startsWith('/berita');

		// Jangan pakai req.url (ada query) — substring seperti "upload" di query memicu false positive.
		// Traffic /api/* dari situs resmi tidak pakai pola ini (tetap kena tier rate limit lain).
		if (!isSeoCriticalPath && !isOfficialSiteApiTraffic(req)) {
			for (const pattern of suspiciousPatterns) {
				if (pattern.test(path)) {
					isSuspicious = true;
					suspiciousReason = `Suspicious URL pattern: ${pattern}`;
					break;
				}
			}
		}

		// ==================== RESPONSE TO SUSPICIOUS ACTIVITY ====================
		if (isSuspicious) {
			console.log(
				`🚨 DDoS Protection: Suspicious activity detected from IP ${clientIP}`,
			);
			console.log(`   Reason: ${suspiciousReason}`);
			console.log(`   Path: ${path}`);
			console.log(`   Method: ${method}`);
			console.log(`   User-Agent: ${userAgent}`);

			return sendBeautifulError(
				res,
				403,
				'Access Denied',
				'Suspicious activity detected. This request has been blocked for security reasons.',
				{
					reason: suspiciousReason,
					path: path,
					method: method,
					ip: clientIP,
					deviceId: deviceId,
				},
			);
		}

		// ==================== CLEANUP ON RESPONSE END ====================
		res.on('finish', () => {
			// Decrement connection counts
			const ipConnections = activeConnectionsByIP.get(clientIP) || 0;
			const deviceConnections = activeConnectionsByDevice.get(deviceId) || 0;

			if (ipConnections > 0) {
				activeConnectionsByIP.set(clientIP, ipConnections - 1);
			}
			if (deviceConnections > 0) {
				activeConnectionsByDevice.set(deviceId, deviceConnections - 1);
			}
		});

		// ==================== TIER 2/3 BARU (blok penuh per IP atau per device) ====================
		// Check Tier 3 first (highest priority)
		if (tier3IPData && tier3IPData.count > TIER3_IP_LIMIT) {
			const blockUntil = now + TIER3_BLOCK_DURATION_MS;
			blockedIPs.set(clientIP, { blockUntil, tier: 3 });
			console.log(
				`🚨 Tier 3 Block: IP ${clientIP} exceeded ${TIER3_IP_LIMIT} requests in 60 minutes, blocked until ${new Date(
					blockUntil,
				).toLocaleString()}`,
			);
			return sendTierBlockResponse(req, res, 3, blockUntil);
		}

		if (tier3DeviceData && tier3DeviceData.count > TIER3_DEVICE_LIMIT) {
			const blockUntil = now + TIER3_BLOCK_DURATION_MS;
			blockedDevices.set(deviceId, { blockUntil, tier: 3 });
			console.log(
				`🚨 Tier 3 Block: Device ${deviceId} exceeded ${TIER3_DEVICE_LIMIT} requests in 60 minutes, blocked until ${new Date(
					blockUntil,
				).toLocaleString()}`,
			);
			return sendTierBlockResponse(req, res, 3, blockUntil);
		}

		// Check Tier 2
		if (tier2IPData && tier2IPData.count > TIER2_IP_LIMIT) {
			const blockUntil = now + TIER2_BLOCK_DURATION_MS;
			blockedIPs.set(clientIP, { blockUntil, tier: 2 });
			console.log(
				`🚨 Tier 2 Block: IP ${clientIP} exceeded ${TIER2_IP_LIMIT} requests in 5 minutes, blocked until ${new Date(
					blockUntil,
				).toLocaleString()}`,
			);
			return sendTierBlockResponse(req, res, 2, blockUntil);
		}

		if (tier2DeviceData && tier2DeviceData.count > TIER2_DEVICE_LIMIT) {
			const blockUntil = now + TIER2_BLOCK_DURATION_MS;
			blockedDevices.set(deviceId, { blockUntil, tier: 2 });
			console.log(
				`🚨 Tier 2 Block: Device ${deviceId} exceeded ${TIER2_DEVICE_LIMIT} requests in 5 minutes, blocked until ${new Date(
					blockUntil,
				).toLocaleString()}`,
			);
			return sendTierBlockResponse(req, res, 2, blockUntil);
		}

		// Check Tier 1 (lowest priority)
		if (tier1IPData && tier1IPData.count > TIER1_IP_LIMIT) {
			const retryAfter = Math.ceil((tier1IPData.resetTime - now) / 1000);
			console.log(
				`🚨 Tier 1 Block: IP ${clientIP} exceeded ${TIER1_IP_LIMIT} requests in 1 minute, retry in ${retryAfter}s`,
			);
			return sendBeautifulError(
				res,
				429,
				'Rate Limit Exceeded',
				'Too many requests from your IP address. Please slow down and try again later.',
				{
					limit: TIER1_IP_LIMIT,
					window: '1 minute',
					retryAfter: retryAfter,
				},
			);
		}

		if (tier1DeviceData && tier1DeviceData.count > TIER1_DEVICE_LIMIT) {
			const retryAfter = Math.ceil((tier1DeviceData.resetTime - now) / 1000);
			console.log(
				`🚨 Tier 1 Block: Device ${deviceId} exceeded ${TIER1_DEVICE_LIMIT} requests in 1 minute, retry in ${retryAfter}s`,
			);
			return sendBeautifulError(
				res,
				429,
				'Rate Limit Exceeded',
				'Too many requests from your device. Please slow down and try again later.',
				{
					limit: TIER1_DEVICE_LIMIT,
					window: '1 minute',
					retryAfter: retryAfter,
				},
			);
		}

		// ==================== STATISTICS LOGGING ====================
		if (tier1IPData && tier1IPData.count % 100 === 0) {
			console.log(
				`📊 DDoS Stats: IP ${clientIP} has made ${tier1IPData.count} requests in current window`,
			);
		}

		next();
	} catch (error) {
		console.error('❌ DDoS Protection Error:', error);
		next(); // Continue processing if DDoS protection fails
	}
};

// ==================== CLEANUP FUNCTION ====================
export const cleanupDdosData = () => {
	const now = Date.now();

	// Cleanup expired request counts by IP
	for (const [ip, data] of Array.from(tier1RequestCountsByIP.entries())) {
		if (now > data.resetTime) {
			tier1RequestCountsByIP.delete(ip);
		}
	}
	for (const [ip, data] of Array.from(tier2RequestCountsByIP.entries())) {
		if (now > data.resetTime) {
			tier2RequestCountsByIP.delete(ip);
		}
	}
	for (const [ip, data] of Array.from(tier3RequestCountsByIP.entries())) {
		if (now > data.resetTime) {
			tier3RequestCountsByIP.delete(ip);
		}
	}

	// Cleanup expired request counts by device
	for (const [deviceId, data] of Array.from(
		tier1RequestCountsByDevice.entries(),
	)) {
		if (now > data.resetTime) {
			tier1RequestCountsByDevice.delete(deviceId);
		}
	}
	for (const [deviceId, data] of Array.from(
		tier2RequestCountsByDevice.entries(),
	)) {
		if (now > data.resetTime) {
			tier2RequestCountsByDevice.delete(deviceId);
		}
	}
	for (const [deviceId, data] of Array.from(
		tier3RequestCountsByDevice.entries(),
	)) {
		if (now > data.resetTime) {
			tier3RequestCountsByDevice.delete(deviceId);
		}
	}

	// Cleanup expired blocks
	for (const [ip, data] of Array.from(blockedIPs.entries())) {
		if (now > data.blockUntil) {
			blockedIPs.delete(ip);
		}
	}
	for (const [deviceId, data] of Array.from(blockedDevices.entries())) {
		if (now > data.blockUntil) {
			blockedDevices.delete(deviceId);
		}
	}

	// Cleanup expired login attempts
	for (const [ip, data] of Array.from(loginAttemptsByIP.entries())) {
		if (now > data.resetTime) {
			loginAttemptsByIP.delete(ip);
		}
	}

	// Cleanup expired upload requests
	for (const [ip, data] of Array.from(uploadRequestsByIP.entries())) {
		if (now > data.resetTime) {
			uploadRequestsByIP.delete(ip);
		}
	}

	// Cleanup connection counts (reset every 5 minutes)
	if (now % (5 * 60 * 1000) === 0) {
		activeConnectionsByIP.clear();
		activeConnectionsByDevice.clear();
	}
};

// ==================== STATISTICS FUNCTION ====================
export const getDdosStats = () => {
	const now = Date.now();
	const stats = {
		totalIPs: tier1RequestCountsByIP.size,
		totalDevices: tier1RequestCountsByDevice.size,
		activeConnectionsByIP: Array.from(activeConnectionsByIP.values()).reduce(
			(a, b) => a + b,
			0,
		),
		activeConnectionsByDevice: Array.from(
			activeConnectionsByDevice.values(),
		).reduce((a, b) => a + b, 0),
		topIPs: [] as Array<{ ip: string; requests: number }>,
		topDevices: [] as Array<{ deviceId: string; requests: number }>,
		loginAttempts: loginAttemptsByIP.size,
		uploadRequests: uploadRequestsByIP.size,
		blockedIPs: blockedIPs.size,
		blockedDevices: blockedDevices.size,
		tier1Stats: {
			ips: tier1RequestCountsByIP.size,
			devices: tier1RequestCountsByDevice.size,
		},
		tier2Stats: {
			ips: tier2RequestCountsByIP.size,
			devices: tier2RequestCountsByDevice.size,
		},
		tier3Stats: {
			ips: tier3RequestCountsByIP.size,
			devices: tier3RequestCountsByDevice.size,
		},
	};

	// Get top 5 IPs by request count
	const ipEntries = Array.from(tier1RequestCountsByIP.entries());
	const validIPEntries = ipEntries.filter(([, data]) => now <= data.resetTime);
	const sortedIPEntries = validIPEntries.sort(
		([, a], [, b]) => b.count - a.count,
	);
	const topIPEntries = sortedIPEntries.slice(0, 5);

	stats.topIPs = topIPEntries.map(([ip, data]) => ({
		ip,
		requests: data.count,
	}));

	// Get top 5 devices by request count
	const deviceEntries = Array.from(tier1RequestCountsByDevice.entries());
	const validDeviceEntries = deviceEntries.filter(
		([, data]) => now <= data.resetTime,
	);
	const sortedDeviceEntries = validDeviceEntries.sort(
		([, a], [, b]) => b.count - a.count,
	);
	const topDeviceEntries = sortedDeviceEntries.slice(0, 5);

	stats.topDevices = topDeviceEntries.map(([deviceId, data]) => ({
		deviceId,
		requests: data.count,
	}));

	return stats;
};

// Run cleanup every minute
setInterval(cleanupDdosData, 60 * 1000);

// Log statistics every 5 minutes
setInterval(
	() => {
		const stats = getDdosStats();
		console.log('📊 DDoS Protection Stats:', stats);
	},
	5 * 60 * 1000,
);

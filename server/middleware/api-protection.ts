import { NextFunction, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { getTrustedClientIp } from '../lib/client-ip';
import { getMiddlewareSettings } from '../models/middleware-settings';
import { isTrustedOrigin } from '../config/trusted-network';

function envInt(name: string, fallback: number): number {
	const v = parseInt(process.env[name] || '', 10);
	return Number.isFinite(v) && v > 0 ? v : fallback;
}

/** Ada kredensial login (JWT di cookie / Bearer) — kuota API terpisah & lebih longgar dari anon di IP sama (NAT/kampus). */
function hasAuthCredentials(req: Request): boolean {
	if (req.headers.authorization?.startsWith('Bearer ')) return true;
	const raw = req.headers.cookie || '';
	const m = raw.match(/(?:^|;\s*)authToken=([^;]*)/);
	return !!(m && m[1] && String(m[1]).trim().length > 10);
}

// Cache for middleware settings
let middlewareSettingsCache: any = null;
let settingsCacheTimestamp: number = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Function to clear settings cache (called when settings are updated)
export function clearMiddlewareSettingsCache() {
	middlewareSettingsCache = null;
	settingsCacheTimestamp = 0;
}

// Function to get middleware settings with caching
async function getCachedMiddlewareSettings() {
	const now = Date.now();
	if (
		!middlewareSettingsCache ||
		now - settingsCacheTimestamp > CACHE_DURATION
	) {
		try {
			middlewareSettingsCache = await getMiddlewareSettings();
			settingsCacheTimestamp = now;
		} catch (error) {
			console.error('Error getting middleware settings:', error);
			// Fallback to default enabled settings if error
			middlewareSettingsCache = {
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
	return middlewareSettingsCache;
}

// ==================== API PROTECTION CONFIGURATION ====================
/**
 * Daftar rute API yang boleh diakses tanpa konteks frontend tepercaya.
 *
 * Sebelumnya dicocokkan dengan `path.startsWith(route)` sehingga satu route
 * baru di bawah prefix (mis. `/api/settings/*`) otomatis mewarisi bypass.
 * Sekarang tiap entri punya bentuk eksplisit:
 *  - `exact`:   path harus sama persis
 *  - `prefix`:  path sama persis ATAU diawali `<prefix>/`
 *  - `pattern`: regexp penuh (dipakai untuk path berparameter)
 *
 * Menambah rute publik baru = tambah satu baris di sini, bukan melebarkan
 * prefix yang sudah ada.
 */
type AllowedRouteRule = {
	kind: 'exact' | 'prefix' | 'pattern';
	value: string | RegExp;
};

const ALLOWED_API_ROUTE_RULES: AllowedRouteRule[] = [
	// Auth
	{ kind: 'exact', value: '/api/auth/login' },
	{ kind: 'exact', value: '/api/auth/login/google' },
	{ kind: 'exact', value: '/api/auth/google/identify' },
	{ kind: 'exact', value: '/api/auth/register' },
	{ kind: 'exact', value: '/api/auth/me' },
	{ kind: 'exact', value: '/api/auth/logout' },
	{ kind: 'exact', value: '/api/auth/firebase-config' },
	{ kind: 'exact', value: '/api/auth/login-targets' },
	{ kind: 'exact', value: '/api/auth/switch-to-staff' },
	{ kind: 'prefix', value: '/api/auth/forgot-password' },

	// Konten publik
	{ kind: 'prefix', value: '/api/berita' },
	{ kind: 'prefix', value: '/api/library' },
	{ kind: 'prefix', value: '/api/events' },
	{ kind: 'prefix', value: '/api/event-years' },
	{ kind: 'prefix', value: '/api/organization' },
	{ kind: 'prefix', value: '/api/prodi' },
	{ kind: 'prefix', value: '/api/profil' },
	{ kind: 'prefix', value: '/api/home-images' },
	{ kind: 'exact', value: '/api/stats' },
	{ kind: 'exact', value: '/api/info' },
	{ kind: 'exact', value: '/api/settings' },
	{ kind: 'exact', value: '/api/settings/home-config' },
	{ kind: 'exact', value: '/api/communities' },
	{ kind: 'exact', value: '/api/roles/levels' },

	// Aset & media
	{ kind: 'prefix', value: '/api/upload' },
	{ kind: 'prefix', value: '/api/gdrive' },
	{ kind: 'prefix', value: '/api/og' },

	// Chat & interaksi publik
	{ kind: 'prefix', value: '/api/chat' },
	{ kind: 'prefix', value: '/api/comments' },
	{ kind: 'prefix', value: '/api/feedback' },
	{ kind: 'prefix', value: '/api/social-feed' },
	{ kind: 'prefix', value: '/api/notifications' },

	// Toko publik
	{ kind: 'prefix', value: '/api/store/public' },
	{ kind: 'exact', value: '/api/store/cart' },
	{ kind: 'prefix', value: '/api/store/cart' },
	{ kind: 'prefix', value: '/api/store/checkout' },
	{ kind: 'prefix', value: '/api/store/direct-checkout' },
	{ kind: 'prefix', value: '/api/store/buy-link' },
	{ kind: 'prefix', value: '/api/store/my-orders' },
	{ kind: 'prefix', value: '/api/store/orders' },
	{ kind: 'prefix', value: '/api/store/shipping' },
	{ kind: 'prefix', value: '/api/store/payment-preview' },
	{ kind: 'prefix', value: '/api/buyer' },

	// Registrasi komunitas
	{ kind: 'exact', value: '/api/register/validate-code' },
	{ kind: 'exact', value: '/api/register/community' },
	{ kind: 'prefix', value: '/api/register/upload' },
	{ kind: 'prefix', value: '/api/registration' },

	// Tenant API
	{ kind: 'prefix', value: '/api/c' },

	// Monitor (auth via API key di router sendiri)
	{ kind: 'prefix', value: '/api/monitor' },
];

/** Apakah path API ini boleh diakses tanpa konteks frontend tepercaya? */
function isAllowedPublicApiPath(path: string): boolean {
	for (const rule of ALLOWED_API_ROUTE_RULES) {
		if (rule.kind === 'exact') {
			if (path === rule.value) return true;
		} else if (rule.kind === 'prefix') {
			const prefix = String(rule.value);
			if (path === prefix || path.startsWith(`${prefix}/`)) return true;
		} else if (rule.kind === 'pattern') {
			if ((rule.value as RegExp).test(path)) return true;
		}
	}
	return false;
}


// ==================== BEAUTIFUL API ERROR RESPONSE ====================
function sendBeautifulApiError(
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
			help: 'This API endpoint is protected and requires proper authentication or server-to-server communication.',
		},
	};

	// Ambil info dari request
	const req = res.req as any;
	const accept = req.headers['accept'] || '';
	const xRequestedWith = req.headers['x-requested-with'] || '';

	// Cek apakah ini request dari fetch/ajax (bukan browser biasa)
	const isAjaxRequest =
		accept.includes('application/json') || xRequestedWith === 'XMLHttpRequest';

	// Jika request fetch/ajax, balas JSON
	if (isAjaxRequest) {
		return res.status(statusCode).json(errorResponse);
	}

	// Cek apakah sudah di error page untuk mencegah redirect loop
	if (res.req?.path?.startsWith('/error')) {
		return res.status(statusCode).json(errorResponse);
	}

	// Untuk browser biasa, selalu redirect ke halaman error yang cantik
	const errorParam = encodeURIComponent(JSON.stringify(errorResponse.error));
	const redirectUrl = `/error?error=${errorParam}`;
	return res.redirect(redirectUrl);
}

// ==================== API PROTECTION MIDDLEWARE ====================
export const apiProtectionMiddleware = async (
	req: Request,
	res: Response,
	next: NextFunction,
) => {
	try {
		const settings = await getCachedMiddlewareSettings();

		// Master toggle + dedicated flag
		if (settings.allEnabled === false || !settings.apiProtectionEnabled) {
			return next();
		}

		const path = req.path;
		const method = req.method;
		const userAgent = req.get('User-Agent') || '';
		const referer = req.get('Referer') || '';
		const origin = req.get('Origin') || '';
		const secFetchSite = req.get('Sec-Fetch-Site') || '';

		// Skip jika bukan API route
		if (!path.startsWith('/api/')) {
			return next();
		}

		// Cek apakah route diizinkan untuk akses umum (exact / prefix / pattern,
		// bukan startsWith longgar agar sub-route baru tidak ikut terbuka).
		const isAllowedRoute = isAllowedPublicApiPath(path);

		// Cek apakah request dari browser (bukan server-to-server)
		const isBrowserRequest =
			userAgent.includes('Mozilla') ||
			userAgent.includes('Chrome') ||
			userAgent.includes('Safari') ||
			userAgent.includes('Firefox') ||
			userAgent.includes('Edge') ||
			userAgent.includes('Opera');

		// Request browser dianggap dari frontend kalau benar-benar datang dari origin/referer
		// tepercaya atau ditandai same-site oleh browser (fetch/XHR dari halaman situs ini).
		const isFromFrontend =
			isTrustedOrigin(referer) ||
			isTrustedOrigin(origin) ||
			secFetchSite === 'same-origin' ||
			secFetchSite === 'same-site';

		// Chat mutation: harus same-site ATAU trusted Origin (lihat chat-origin-gate).
		// Middleware chat-origin-gate dipasang di router chat, tapi sebagai safety net
		// untuk mutasi /api/chat/* kita tolak di sini juga kalau request via address-bar
		// (bukan fetch JSON) tanpa origin/referer tepercaya.
		const isChatMutation =
			method !== 'GET' && path.startsWith('/api/chat');

		// Cek apakah ada authentication header atau session
		const hasAuth =
			req.headers.authorization ||
			req.headers['x-api-key'] ||
			(req as any).session?.user ||
			(req as any).cookies?.token;

		// Cek apakah ini request dengan proper headers (AJAX/fetch)
		const hasProperHeaders =
			req.headers['accept']?.includes('application/json') ||
			req.headers['x-requested-with'] === 'XMLHttpRequest' ||
			req.headers['content-type']?.includes('application/json');

		// Chat mutation tanpa bukti same-site / trusted origin ditolak di sini juga
		// (pengaman kedua selain chat-origin-gate).
		if (isChatMutation && !isFromFrontend && !hasAuth) {
			return sendBeautifulApiError(
				res,
				403,
				'API Access Forbidden',
				'Chat mutations require a trusted frontend origin.',
				{
					path: path,
					method: method,
					reason: 'chat-mutation-without-trusted-origin',
					secFetchSite,
				},
			);
		}

		// ALLOW FRONTEND REQUESTS (hanya dari browser situs sendiri / auth)
		if (isBrowserRequest && (isFromFrontend || hasProperHeaders || hasAuth)) {
			return next();
		}

		// BLOCK direct browser address-bar access (tanpa konteks frontend situs)
		if (isBrowserRequest && !isFromFrontend && !hasProperHeaders && !hasAuth) {
			return sendBeautifulApiError(
				res,
				403,
				'API Access Forbidden',
				'Direct browser access to API endpoints is not allowed.',
				{
					path: path,
					method: method,
					reason: 'Direct browser access without trusted frontend context',
					userAgent: userAgent,
					referer: referer,
					origin: origin,
					secFetchSite,
				},
			);
		}

		// Allow semua request yang lain (server-to-server, authenticated, proper headers)
		next();
	} catch (error) {
		console.error('Error in API protection middleware:', error);
		// Continue processing if middleware fails
		next();
	}
};

// ==================== API RATE LIMITING ====================
/**
 * Per menit: bucket terpisah anon vs login (`IP:anon` / `IP:auth`) supaya satu IP publik
 * (WiFi kampus, ISP) tidak cepat kena imbas traffic anon, sementara user login tetap nyaman.
 */
const apiLimiterCore = rateLimit({
	windowMs: 60 * 1000,
	limit: (req) =>
		hasAuthCredentials(req)
			? envInt('API_RATE_LIMIT_PER_MINUTE_AUTH', 420)
			: envInt('API_RATE_LIMIT_PER_MINUTE', 240),
	standardHeaders: true,
	legacyHeaders: false,
	skip: (req) => !req.path.startsWith('/api/'),
	keyGenerator: (req) => {
		const ip = getTrustedClientIp(req);
		return hasAuthCredentials(req) ? `${ip}:auth` : `${ip}:anon`;
	},
	validate: false,
	handler: (req, res) => {
		const clientIP = getTrustedClientIp(req);
		const retryAfter = envInt('API_RATE_LIMIT_WINDOW_SEC', 60);
		const auth = hasAuthCredentials(req);
		const lim = auth
			? envInt('API_RATE_LIMIT_PER_MINUTE_AUTH', 420)
			: envInt('API_RATE_LIMIT_PER_MINUTE', 240);
		console.log(
			`🚨 API Rate Limit: IP ${clientIP} (${auth ? 'auth' : 'anon'}) melebihi ${lim}/menit, retry ${retryAfter}s`,
		);
		return sendBeautifulApiError(
			res,
			429,
			'API Rate Limit Exceeded',
			'Too many API requests. Please slow down and try again later.',
			{
				limit: lim,
				window: '1 minute',
				retryAfter,
				ip: clientIP,
				bucket: auth ? 'authenticated' : 'anonymous',
			},
		);
	},
});

export const apiRateLimitMiddleware = async (
	req: Request,
	res: Response,
	next: NextFunction,
) => {
	try {
		const settings = await getCachedMiddlewareSettings();
		if (settings.allEnabled === false || !settings.apiRateLimitEnabled) {
			return next();
		}
		return apiLimiterCore(req, res, next);
	} catch (error) {
		console.error('Error in API rate limit middleware:', error);
		next();
	}
};

/** No-op: kompatibilitas; limiter membersihkan memori sendiri. */
export const cleanupApiData = () => {};

import { NextFunction, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { getTrustedClientIp } from '../lib/client-ip';
import { getMiddlewareSettings } from '../models/middleware-settings';
import { isTrustedHost, isTrustedOrigin } from '../config/trusted-network';

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
const ALLOWED_API_ROUTES = [
	'/api/auth/login',
	'/api/auth/register',
	'/api/auth/me',
	'/api/berita',
	'/api/berita/slug/',
	'/api/upload',
	'/api/chat',
	'/api/activities',
	'/api/organizations',
	'/api/content',
	'/api/media',
	'/api/settings',
	'/api/stats',
	'/api/library',
	'/api/gdrive',
	'/api/organization/members',
	'/api/organization/periods',
	'/api/organization/periods/', // For POST requests
	'/api/communities',
	'/api/register/validate-code',
	'/api/register/community',
	'/api/registration/',
	'/api/c/', // Community tenant API prefix
];

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

		// If API Protection is completely disabled, allow ALL requests
		if (!settings.apiProtectionEnabled) {
			return next();
		}

		const path = req.path;
		const method = req.method;
		const userAgent = req.get('User-Agent') || '';
		const referer = req.get('Referer') || '';
		const origin = req.get('Origin') || '';
		const host = req.get('Host') || '';

		// Skip jika bukan API route
		if (!path.startsWith('/api/')) {
			return next();
		}

		// Cek apakah route diizinkan untuk akses umum
		const isAllowedRoute = ALLOWED_API_ROUTES.some((route) =>
			path.startsWith(route),
		);

		// Cek apakah request dari browser (bukan server-to-server)
		const isBrowserRequest =
			userAgent.includes('Mozilla') ||
			userAgent.includes('Chrome') ||
			userAgent.includes('Safari') ||
			userAgent.includes('Firefox') ||
			userAgent.includes('Edge') ||
			userAgent.includes('Opera');

		// Cek apakah request dari frontend (production dan development)
		const isFromFrontend =
			isTrustedOrigin(referer) ||
			isTrustedOrigin(origin) ||
			isTrustedHost(host);

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

		// ALLOW FRONTEND REQUESTS (relaxed protection for production)
		if (isBrowserRequest && (isFromFrontend || hasProperHeaders || hasAuth)) {
			return next();
		}

		// BLOCK ONLY DIRECT BROWSER ACCESS TANPA REFERER DAN HEADERS
		if (isBrowserRequest && !referer && !hasProperHeaders && !hasAuth) {
			return sendBeautifulApiError(
				res,
				403,
				'API Access Forbidden',
				'Direct browser access to API endpoints is not allowed.',
				{
					path: path,
					method: method,
					reason: 'Direct browser access without proper referer',
					userAgent: userAgent,
					referer: referer,
					origin: origin,
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
		if (!settings.apiRateLimitEnabled) {
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

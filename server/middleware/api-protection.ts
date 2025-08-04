import { NextFunction, Request, Response } from 'express';

// ==================== API PROTECTION CONFIGURATION ====================
const ALLOWED_API_ROUTES = [
	'/api/auth/login',
	'/api/auth/register',
	'/api/auth/me',
	'/api/articles',
	'/api/upload',
	'/api/chat',
	'/api/activities',
	'/api/organizations',
	'/api/content',
	'/api/media',
	'/api/settings',
	'/api/stats',
	'/api/library',
	'/api/organization/members',
	'/api/organization/periods',
	'/api/organization/periods/', // For POST requests
];

// ==================== BEAUTIFUL API ERROR RESPONSE ====================
function sendBeautifulApiError(
	res: Response,
	statusCode: number,
	title: string,
	message: string,
	details?: any
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

	// Untuk browser biasa, selalu redirect ke halaman error yang cantik
	const errorParam = encodeURIComponent(JSON.stringify(errorResponse.error));
	const redirectUrl = `/error?error=${errorParam}`;
	return res.redirect(redirectUrl);
}

// ==================== API PROTECTION MIDDLEWARE ====================
export const apiProtectionMiddleware = (
	req: Request,
	res: Response,
	next: NextFunction
) => {
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
		path.startsWith(route)
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
		referer.includes('localhost:5000') ||
		origin.includes('localhost:5000') ||
		referer.includes('43.157.211.134') ||
		origin.includes('43.157.211.134') ||
		referer.includes('https://43.157.211.134') ||
		origin.includes('https://43.157.211.134') ||
		referer.includes('http://43.157.211.134') ||
		origin.includes('http://43.157.211.134') ||
		referer.includes('himatif-encoder.com') ||
		origin.includes('himatif-encoder.com') ||
		referer.includes('https://himatif-encoder.com') ||
		origin.includes('https://himatif-encoder.com') ||
		referer.includes('www.himatif-encoder.com') ||
		origin.includes('www.himatif-encoder.com');

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
		console.log(`✅ API Protection: Allowing frontend request to ${path}`);
		return next();
	}

	// BLOCK ONLY DIRECT BROWSER ACCESS TANPA REFERER DAN HEADERS
	if (isBrowserRequest && !referer && !hasProperHeaders && !hasAuth) {
		console.log(`🚫 API Protection: Direct browser access blocked to ${path}`);

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
			}
		);
	}

	// Allow semua request yang lain (server-to-server, authenticated, proper headers)
	console.log(`✅ API Protection: Allowing request to ${path}`);
	next();
};

// ==================== API RATE LIMITING ====================
const apiRequestCounts = new Map<
	string,
	{ count: number; resetTime: number }
>();
const API_RATE_LIMIT = 100; // 100 requests per minute per IP for API
const API_WINDOW_MS = 60 * 1000; // 1 minute

export const apiRateLimitMiddleware = (
	req: Request,
	res: Response,
	next: NextFunction
) => {
	const path = req.path;

	// Skip jika bukan API route
	if (!path.startsWith('/api/')) {
		return next();
	}

	const clientIP = req.ip || req.connection.remoteAddress || 'unknown';
	const now = Date.now();
	const ipData = apiRequestCounts.get(clientIP);

	if (!ipData || now > ipData.resetTime) {
		apiRequestCounts.set(clientIP, {
			count: 1,
			resetTime: now + API_WINDOW_MS,
		});
	} else {
		ipData.count++;
		apiRequestCounts.set(clientIP, ipData);

		// Check API rate limit
		if (ipData.count > API_RATE_LIMIT) {
			const retryAfter = Math.ceil((ipData.resetTime - now) / 1000);
			console.log(
				`🚨 API Rate Limit: IP ${clientIP} exceeded API rate limit, retry in ${retryAfter}s`
			);

			return sendBeautifulApiError(
				res,
				429,
				'API Rate Limit Exceeded',
				'Too many API requests. Please slow down and try again later.',
				{
					limit: API_RATE_LIMIT,
					window: '1 minute',
					retryAfter: retryAfter,
					ip: clientIP,
				}
			);
		}
	}

	next();
};

// ==================== CLEANUP FUNCTION ====================
export const cleanupApiData = () => {
	const now = Date.now();

	// Cleanup expired API request counts
	for (const [ip, data] of Array.from(apiRequestCounts.entries())) {
		if (now > data.resetTime) {
			apiRequestCounts.delete(ip);
		}
	}
};

// Run cleanup every minute
setInterval(cleanupApiData, 60 * 1000);

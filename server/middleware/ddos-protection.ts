import crypto from 'crypto';
import { NextFunction, Request, Response } from 'express';

// ==================== DDoS PROTECTION CONFIGURATION ====================
const WINDOW_MS = 60 * 1000; // 1 menit

// Rate limits per IP
const MAX_REQUESTS_PER_IP = 500; // 500 request per IP per menit
const MAX_CONCURRENT_CONNECTIONS_PER_IP = 100; // 100 koneksi bersamaan per IP

// Rate limits per device (lebih ketat)
const MAX_REQUESTS_PER_DEVICE = 20; // 20 request per device per menit
const MAX_CONCURRENT_CONNECTIONS_PER_DEVICE = 5; // 5 koneksi bersamaan per device

// Special rate limits untuk sensitive endpoints
const MAX_LOGIN_ATTEMPTS_PER_IP = 10; // 10 login attempts per IP per menit
const MAX_UPLOAD_REQUESTS_PER_IP = 50; // 100 upload requests per IP per menit

const requestCountsByIP = new Map<
	string,
	{ count: number; resetTime: number }
>();
const requestCountsByDevice = new Map<
	string,
	{ count: number; resetTime: number }
>();
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

// Suspicious patterns untuk detection
const suspiciousPatterns = [
	/upload/i,
	/admin/i,
	/\.\.\//, // Directory traversal
	/union\s+select/i, // SQL injection
	/script/i, // XSS
	/eval\s*\(/i, // Code injection
	/exec\s*\(/i, // Command injection
	/etc\/passwd/i, // System files
	/etc\/shadow/i, // System files
	/proc\//i, // System files
	/var\/log/i, // System files
	/config/i, // Configuration files
	/\.env/i, // Environment files
	/\.git/i, // Git files
	/\.svn/i, // SVN files
	/\.htaccess/i, // Apache files
	/\.htpasswd/i, // Apache files
	/\.ini/i, // Configuration files
	/\.conf/i, // Configuration files
	/\.xml/i, // XML files
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
	/curl/i,
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

// ==================== DEVICE ID GENERATION ====================
function generateDeviceId(req: Request): string {
	const userAgent = req.get('User-Agent') || '';
	const acceptLanguage = req.get('Accept-Language') || '';
	const acceptEncoding = req.get('Accept-Encoding') || '';
	const ip = req.ip || req.connection.remoteAddress || 'unknown';

	// Create a unique device fingerprint
	const fingerprint = `${userAgent}|${acceptLanguage}|${acceptEncoding}|${ip}`;
	return crypto
		.createHash('sha256')
		.update(fingerprint)
		.digest('hex')
		.substring(0, 16);
}

// ==================== BEAUTIFUL ERROR RESPONSE ====================
function sendBeautifulError(
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
export const ddosProtectionMiddleware = (
	req: Request,
	res: Response,
	next: NextFunction
) => {
	const clientIP = req.ip || req.connection.remoteAddress || 'unknown';
	const userAgent = req.get('User-Agent') || '';
	const path = req.path;
	const method = req.method;
	const deviceId = generateDeviceId(req);

	// Skip protection hanya untuk static files dan error page
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
		path.startsWith('/api/') // Skip API routes untuk rate limit global
	) {
		return next();
	}

	// ==================== BOT/CRAWLER DETECTION ====================
	let isBot = false;
	for (const pattern of botUserAgents) {
		if (pattern.test(userAgent)) {
			isBot = true;
			break;
		}
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
			}
		);
	}

	// ==================== RATE LIMITING PER IP ====================
	const now = Date.now();
	const ipData = requestCountsByIP.get(clientIP);

	if (!ipData || now > ipData.resetTime) {
		requestCountsByIP.set(clientIP, {
			count: 1,
			resetTime: now + WINDOW_MS,
		});
	} else {
		ipData.count++;
		requestCountsByIP.set(clientIP, ipData);

		// Check IP rate limit
		if (ipData.count > MAX_REQUESTS_PER_IP) {
			const retryAfter = Math.ceil((ipData.resetTime - now) / 1000);
			console.log(
				`🚨 DDoS Protection: IP rate limit exceeded for ${clientIP}, retry in ${retryAfter}s`
			);
			return sendBeautifulError(
				res,
				429,
				'Rate Limit Exceeded',
				'Too many requests from your IP address. Please slow down and try again later.',
				{
					limit: MAX_REQUESTS_PER_IP,
					window: '1 minute',
					retryAfter: retryAfter,
				}
			);
		}
	}

	// ==================== RATE LIMITING PER DEVICE ====================
	const deviceData = requestCountsByDevice.get(deviceId);

	if (!deviceData || now > deviceData.resetTime) {
		requestCountsByDevice.set(deviceId, {
			count: 1,
			resetTime: now + WINDOW_MS,
		});
	} else {
		deviceData.count++;
		requestCountsByDevice.set(deviceId, deviceData);

		// Check device rate limit
		if (deviceData.count > MAX_REQUESTS_PER_DEVICE) {
			const retryAfter = Math.ceil((deviceData.resetTime - now) / 1000);
			console.log(
				`🚨 DDoS Protection: Device rate limit exceeded for ${deviceId}, retry in ${retryAfter}s`
			);
			return sendBeautifulError(
				res,
				429,
				'Rate Limit Exceeded',
				'Too many requests from your device. Please slow down and try again later.',
				{
					limit: MAX_REQUESTS_PER_DEVICE,
					window: '1 minute',
					retryAfter: retryAfter,
				}
			);
		}
	}

	// ==================== CONCURRENT CONNECTION LIMITING ====================
	const currentIPConnections = activeConnectionsByIP.get(clientIP) || 0;
	const currentDeviceConnections = activeConnectionsByDevice.get(deviceId) || 0;

	if (currentIPConnections >= MAX_CONCURRENT_CONNECTIONS_PER_IP) {
		console.log(
			`🚨 DDoS Protection: Too many concurrent connections from IP ${clientIP}`
		);
		return sendBeautifulError(
			res,
			503,
			'Service Temporarily Unavailable',
			'Too many concurrent connections from your IP address. Please try again later.',
			{
				maxConnections: MAX_CONCURRENT_CONNECTIONS_PER_IP,
			}
		);
	}

	if (currentDeviceConnections >= MAX_CONCURRENT_CONNECTIONS_PER_DEVICE) {
		console.log(
			`🚨 DDoS Protection: Too many concurrent connections from device ${deviceId}`
		);
		return sendBeautifulError(
			res,
			503,
			'Service Temporarily Unavailable',
			'Too many concurrent connections from your device. Please try again later.',
			{
				maxConnections: MAX_CONCURRENT_CONNECTIONS_PER_DEVICE,
			}
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
				resetTime: now + WINDOW_MS,
			});
		} else {
			loginData.count++;
			loginAttemptsByIP.set(clientIP, loginData);

			if (loginData.count > MAX_LOGIN_ATTEMPTS_PER_IP) {
				const retryAfter = Math.ceil((loginData.resetTime - now) / 1000);
				console.log(
					`🚨 DDoS Protection: Too many login attempts from IP ${clientIP}, retry in ${retryAfter}s`
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
					}
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
				resetTime: now + WINDOW_MS,
			});
		} else {
			uploadData.count++;
			uploadRequestsByIP.set(clientIP, uploadData);

			if (uploadData.count > MAX_UPLOAD_REQUESTS_PER_IP) {
				const retryAfter = Math.ceil((uploadData.resetTime - now) / 1000);
				console.log(
					`🚨 DDoS Protection: Too many upload requests from IP ${clientIP}, retry in ${retryAfter}s`
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
					}
				);
			}
		}
	}

	// ==================== SUSPICIOUS PATTERN DETECTION ====================
	let isSuspicious = false;
	let suspiciousReason = '';

	for (const pattern of suspiciousPatterns) {
		if (pattern.test(path) || pattern.test(req.url)) {
			isSuspicious = true;
			suspiciousReason = `Suspicious URL pattern: ${pattern}`;
			break;
		}
	}

	// ==================== RESPONSE TO SUSPICIOUS ACTIVITY ====================
	if (isSuspicious) {
		console.log(
			`🚨 DDoS Protection: Suspicious activity detected from IP ${clientIP}`
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
			}
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

	// ==================== STATISTICS LOGGING ====================
	if (ipData && ipData.count % 100 === 0) {
		console.log(
			`📊 DDoS Stats: IP ${clientIP} has made ${ipData.count} requests in current window`
		);
	}

	next();
};

// ==================== CLEANUP FUNCTION ====================
export const cleanupDdosData = () => {
	const now = Date.now();

	// Cleanup expired request counts by IP
	for (const [ip, data] of Array.from(requestCountsByIP.entries())) {
		if (now > data.resetTime) {
			requestCountsByIP.delete(ip);
		}
	}

	// Cleanup expired request counts by device
	for (const [deviceId, data] of Array.from(requestCountsByDevice.entries())) {
		if (now > data.resetTime) {
			requestCountsByDevice.delete(deviceId);
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
		totalIPs: requestCountsByIP.size,
		totalDevices: requestCountsByDevice.size,
		activeConnectionsByIP: Array.from(activeConnectionsByIP.values()).reduce(
			(a, b) => a + b,
			0
		),
		activeConnectionsByDevice: Array.from(
			activeConnectionsByDevice.values()
		).reduce((a, b) => a + b, 0),
		topIPs: [] as Array<{ ip: string; requests: number }>,
		topDevices: [] as Array<{ deviceId: string; requests: number }>,
		loginAttempts: loginAttemptsByIP.size,
		uploadRequests: uploadRequestsByIP.size,
	};

	// Get top 5 IPs by request count
	const ipEntries = Array.from(requestCountsByIP.entries());
	const validIPEntries = ipEntries.filter(([, data]) => now <= data.resetTime);
	const sortedIPEntries = validIPEntries.sort(
		([, a], [, b]) => b.count - a.count
	);
	const topIPEntries = sortedIPEntries.slice(0, 5);

	stats.topIPs = topIPEntries.map(([ip, data]) => ({
		ip,
		requests: data.count,
	}));

	// Get top 5 devices by request count
	const deviceEntries = Array.from(requestCountsByDevice.entries());
	const validDeviceEntries = deviceEntries.filter(
		([, data]) => now <= data.resetTime
	);
	const sortedDeviceEntries = validDeviceEntries.sort(
		([, a], [, b]) => b.count - a.count
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
setInterval(() => {
	const stats = getDdosStats();
	console.log('📊 DDoS Protection Stats:', stats);
}, 5 * 60 * 1000);

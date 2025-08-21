import crypto from 'crypto';
import { NextFunction, Request, Response } from 'express';

// ==================== DDoS PROTECTION CONFIGURATION ====================

// Tier 1: Beautiful Error (50 req/device/min atau 500 req/IP/min)
const TIER1_DEVICE_LIMIT = 50;
const TIER1_IP_LIMIT = 500;
const TIER1_WINDOW_MS = 60 * 1000; // 1 menit

// Tier 2: Quick Block 10 menit (300 req/device/5min atau 3000 req/IP/5min)
const TIER2_DEVICE_LIMIT = 300;
const TIER2_IP_LIMIT = 3000;
const TIER2_WINDOW_MS = 5 * 60 * 1000; // 5 menit
const TIER2_BLOCK_DURATION_MS = 10 * 60 * 1000; // 10 menit

// Tier 3: Quick Block 60 menit (4000 req/device/60min atau 30000 req/IP/60min)
const TIER3_DEVICE_LIMIT = 4000;
const TIER3_IP_LIMIT = 30000;
const TIER3_WINDOW_MS = 60 * 60 * 1000; // 60 menit
const TIER3_BLOCK_DURATION_MS = 60 * 60 * 1000; // 60 menit

// Concurrent connection limits
const MAX_CONCURRENT_CONNECTIONS_PER_IP = 100;
const MAX_CONCURRENT_CONNECTIONS_PER_DEVICE = 5;

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
	const ip = req.ip || req.connection.remoteAddress || 'unknown';

	// Create a unique device fingerprint
	const fingerprint = `${userAgent}|${acceptLanguage}|${acceptEncoding}|${ip}`;
	return crypto
		.createHash('sha256')
		.update(fingerprint)
		.digest('hex')
		.substring(0, 16);
}

// ==================== QUICK BLOCK RESPONSE ====================
function sendQuickBlock(res: Response, tier: number) {
	const messages = {
		2: 'Rate limit exceeded. Blocked for 10 minutes.',
		3: 'Aggressive rate limit exceeded. Blocked for 60 minutes.',
	};

	res
		.status(429)
		.set('Content-Type', 'text/plain')
		.set('Retry-After', tier === 2 ? '600' : '3600')
		.end(messages[tier as keyof typeof messages] || 'Rate limit exceeded.');
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
	try {
		const clientIP = req.ip || req.connection.remoteAddress || 'unknown';
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
			path.startsWith('/api/') || // Skip API routes untuk rate limit global
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

		// Check if currently blocked, but still count for higher tiers
		let isCurrentlyBlocked = false;
		let currentBlockTier = 0;

		if (blockedIP && now < blockedIP.blockUntil) {
			isCurrentlyBlocked = true;
			currentBlockTier = blockedIP.tier;
		}

		if (blockedDevice && now < blockedDevice.blockUntil) {
			isCurrentlyBlocked = true;
			currentBlockTier = Math.max(currentBlockTier, blockedDevice.tier);
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
			p.test(userAgent)
		);
		const isSeoPath =
			path === '/' ||
			path === '/sitemap.xml' ||
			path === '/robots.txt' ||
			path.startsWith('/artikel');

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
				}
			);
		}

		// ==================== TIER 3 CHECK (60 MINUTE WINDOW) ====================
		let tier3IPData = tier3RequestCountsByIP.get(clientIP);
		let tier3DeviceData = tier3RequestCountsByDevice.get(deviceId);

		if (!tier3IPData || now > tier3IPData.resetTime) {
			tier3RequestCountsByIP.set(clientIP, {
				count: 1,
				resetTime: now + TIER3_WINDOW_MS,
			});
		} else {
			tier3IPData.count++;
			tier3RequestCountsByIP.set(clientIP, tier3IPData);
		}

		if (!tier3DeviceData || now > tier3DeviceData.resetTime) {
			tier3RequestCountsByDevice.set(deviceId, {
				count: 1,
				resetTime: now + TIER3_WINDOW_MS,
			});
		} else {
			tier3DeviceData.count++;
			tier3RequestCountsByDevice.set(deviceId, tier3DeviceData);
		}

		// ==================== TIER 2 CHECK (5 MINUTE WINDOW) ====================
		let tier2IPData = tier2RequestCountsByIP.get(clientIP);
		let tier2DeviceData = tier2RequestCountsByDevice.get(deviceId);

		if (!tier2IPData || now > tier2IPData.resetTime) {
			tier2RequestCountsByIP.set(clientIP, {
				count: 1,
				resetTime: now + TIER2_WINDOW_MS,
			});
		} else {
			tier2IPData.count++;
			tier2RequestCountsByIP.set(clientIP, tier2IPData);
		}

		if (!tier2DeviceData || now > tier2DeviceData.resetTime) {
			tier2RequestCountsByDevice.set(deviceId, {
				count: 1,
				resetTime: now + TIER2_WINDOW_MS,
			});
		} else {
			tier2DeviceData.count++;
			tier2RequestCountsByDevice.set(deviceId, tier2DeviceData);
		}

		// ==================== TIER 1 CHECK (1 MINUTE WINDOW) ====================
		let tier1IPData = tier1RequestCountsByIP.get(clientIP);
		let tier1DeviceData = tier1RequestCountsByDevice.get(deviceId);

		if (!tier1IPData || now > tier1IPData.resetTime) {
			tier1RequestCountsByIP.set(clientIP, {
				count: 1,
				resetTime: now + TIER1_WINDOW_MS,
			});
		} else {
			tier1IPData.count++;
			tier1RequestCountsByIP.set(clientIP, tier1IPData);
		}

		if (!tier1DeviceData || now > tier1DeviceData.resetTime) {
			tier1RequestCountsByDevice.set(deviceId, {
				count: 1,
				resetTime: now + TIER1_WINDOW_MS,
			});
		} else {
			tier1DeviceData.count++;
			tier1RequestCountsByDevice.set(deviceId, tier1DeviceData);
		}

		// ==================== CONCURRENT CONNECTION LIMITING ====================
		const currentIPConnections = activeConnectionsByIP.get(clientIP) || 0;
		const currentDeviceConnections =
			activeConnectionsByDevice.get(deviceId) || 0;

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
					resetTime: now + TIER1_WINDOW_MS,
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
					resetTime: now + TIER1_WINDOW_MS,
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

		// Whitelist untuk SEO-critical paths sebelum suspicious pattern check
		const isSeoCriticalPath =
			path === '/' ||
			path === '/sitemap.xml' ||
			path === '/robots.txt' ||
			path.startsWith('/artikel');

		if (!isSeoCriticalPath) {
			for (const pattern of suspiciousPatterns) {
				if (pattern.test(path) || pattern.test(req.url)) {
					isSuspicious = true;
					suspiciousReason = `Suspicious URL pattern: ${pattern}`;
					break;
				}
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

		// ==================== FINAL BLOCKING DECISION ====================
		// Check if currently blocked first
		if (isCurrentlyBlocked) {
			// Check if we need to upgrade to higher tier
			let shouldUpgrade = false;
			let newTier = currentBlockTier;
			let newBlockUntil = 0;

			// Check Tier 3 upgrade
			if (tier3IPData && tier3IPData.count > TIER3_IP_LIMIT) {
				shouldUpgrade = true;
				newTier = 3;
				newBlockUntil = now + TIER3_BLOCK_DURATION_MS;
				blockedIPs.set(clientIP, { blockUntil: newBlockUntil, tier: 3 });
				console.log(
					`🚨 Tier 3 Upgrade: IP ${clientIP} exceeded ${TIER3_IP_LIMIT} requests in 60 minutes, upgraded from Tier ${currentBlockTier} to Tier 3, blocked until ${new Date(
						newBlockUntil
					).toLocaleString()}`
				);
			} else if (
				tier3DeviceData &&
				tier3DeviceData.count > TIER3_DEVICE_LIMIT
			) {
				shouldUpgrade = true;
				newTier = 3;
				newBlockUntil = now + TIER3_BLOCK_DURATION_MS;
				blockedDevices.set(deviceId, { blockUntil: newBlockUntil, tier: 3 });
				console.log(
					`🚨 Tier 3 Upgrade: Device ${deviceId} exceeded ${TIER3_DEVICE_LIMIT} requests in 60 minutes, upgraded from Tier ${currentBlockTier} to Tier 3, blocked until ${new Date(
						newBlockUntil
					).toLocaleString()}`
				);
			}

			if (shouldUpgrade) {
				return sendQuickBlock(res, newTier);
			}

			// If no upgrade needed, continue with current block
			console.log(
				`🚫 Quick Block: IP/Device is blocked (Tier ${currentBlockTier}) until ${new Date(
					blockedIP?.blockUntil || blockedDevice?.blockUntil || 0
				).toLocaleString()}`
			);
			return sendQuickBlock(res, currentBlockTier);
		}

		// Check Tier 3 first (highest priority)
		if (tier3IPData && tier3IPData.count > TIER3_IP_LIMIT) {
			const blockUntil = now + TIER3_BLOCK_DURATION_MS;
			blockedIPs.set(clientIP, { blockUntil, tier: 3 });
			console.log(
				`🚨 Tier 3 Block: IP ${clientIP} exceeded ${TIER3_IP_LIMIT} requests in 60 minutes, blocked until ${new Date(
					blockUntil
				).toLocaleString()}`
			);
			return sendQuickBlock(res, 3);
		}

		if (tier3DeviceData && tier3DeviceData.count > TIER3_DEVICE_LIMIT) {
			const blockUntil = now + TIER3_BLOCK_DURATION_MS;
			blockedDevices.set(deviceId, { blockUntil, tier: 3 });
			console.log(
				`🚨 Tier 3 Block: Device ${deviceId} exceeded ${TIER3_DEVICE_LIMIT} requests in 60 minutes, blocked until ${new Date(
					blockUntil
				).toLocaleString()}`
			);
			return sendQuickBlock(res, 3);
		}

		// Check Tier 2
		if (tier2IPData && tier2IPData.count > TIER2_IP_LIMIT) {
			const blockUntil = now + TIER2_BLOCK_DURATION_MS;
			blockedIPs.set(clientIP, { blockUntil, tier: 2 });
			console.log(
				`🚨 Tier 2 Block: IP ${clientIP} exceeded ${TIER2_IP_LIMIT} requests in 5 minutes, blocked until ${new Date(
					blockUntil
				).toLocaleString()}`
			);
			return sendQuickBlock(res, 2);
		}

		if (tier2DeviceData && tier2DeviceData.count > TIER2_DEVICE_LIMIT) {
			const blockUntil = now + TIER2_BLOCK_DURATION_MS;
			blockedDevices.set(deviceId, { blockUntil, tier: 2 });
			console.log(
				`🚨 Tier 2 Block: Device ${deviceId} exceeded ${TIER2_DEVICE_LIMIT} requests in 5 minutes, blocked until ${new Date(
					blockUntil
				).toLocaleString()}`
			);
			return sendQuickBlock(res, 2);
		}

		// Check Tier 1 (lowest priority)
		if (tier1IPData && tier1IPData.count > TIER1_IP_LIMIT) {
			const retryAfter = Math.ceil((tier1IPData.resetTime - now) / 1000);
			console.log(
				`🚨 Tier 1 Block: IP ${clientIP} exceeded ${TIER1_IP_LIMIT} requests in 1 minute, retry in ${retryAfter}s`
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
				}
			);
		}

		if (tier1DeviceData && tier1DeviceData.count > TIER1_DEVICE_LIMIT) {
			const retryAfter = Math.ceil((tier1DeviceData.resetTime - now) / 1000);
			console.log(
				`🚨 Tier 1 Block: Device ${deviceId} exceeded ${TIER1_DEVICE_LIMIT} requests in 1 minute, retry in ${retryAfter}s`
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
				}
			);
		}

		// ==================== STATISTICS LOGGING ====================
		if (tier1IPData && tier1IPData.count % 100 === 0) {
			console.log(
				`📊 DDoS Stats: IP ${clientIP} has made ${tier1IPData.count} requests in current window`
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
		tier1RequestCountsByDevice.entries()
	)) {
		if (now > data.resetTime) {
			tier1RequestCountsByDevice.delete(deviceId);
		}
	}
	for (const [deviceId, data] of Array.from(
		tier2RequestCountsByDevice.entries()
	)) {
		if (now > data.resetTime) {
			tier2RequestCountsByDevice.delete(deviceId);
		}
	}
	for (const [deviceId, data] of Array.from(
		tier3RequestCountsByDevice.entries()
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
			0
		),
		activeConnectionsByDevice: Array.from(
			activeConnectionsByDevice.values()
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
		([, a], [, b]) => b.count - a.count
	);
	const topIPEntries = sortedIPEntries.slice(0, 5);

	stats.topIPs = topIPEntries.map(([ip, data]) => ({
		ip,
		requests: data.count,
	}));

	// Get top 5 devices by request count
	const deviceEntries = Array.from(tier1RequestCountsByDevice.entries());
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

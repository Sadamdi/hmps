import { NextFunction, Request, Response } from 'express';
import { getMiddlewareSettings } from '../models/middleware-settings';
import { getTrustedClientIp } from '../lib/client-ip';

// Cache for middleware settings
let antiSpoofingSettingsCache: any = null;
let antiSpoofingSettingsCacheTimestamp: number = 0;
const ANTI_SPOOFING_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Function to get middleware settings with caching for anti-spoofing middleware
async function getCachedAntiSpoofingMiddlewareSettings() {
	const now = Date.now();
	if (
		!antiSpoofingSettingsCache ||
		now - antiSpoofingSettingsCacheTimestamp > ANTI_SPOOFING_CACHE_DURATION
	) {
		try {
			antiSpoofingSettingsCache = await getMiddlewareSettings();
			antiSpoofingSettingsCacheTimestamp = now;
		} catch (error) {
			console.error('Error getting anti-spoofing middleware settings:', error);
			// Fallback to default enabled settings if error
			antiSpoofingSettingsCache = {
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
	return antiSpoofingSettingsCache;
}

// ==================== IP SPOOFING DETECTION ====================
// Private IP ranges that should not appear in X-Forwarded-For
const PRIVATE_IP_RANGES = [
	'10.0.0.0/8',
	'172.16.0.0/12',
	'192.168.0.0/16',
	'127.0.0.0/8',
	'169.254.0.0/16', // Link-local
	'224.0.0.0/4', // Multicast
	'::1/128', // IPv6 loopback
	'fc00::/7', // IPv6 private
	'fe80::/10', // IPv6 link-local
];

// Function to check if IP is in private range
function isPrivateIP(ip: string): boolean {
	const normalizedIp = ip.replace(/^::ffff:/, '').trim();

	// Handle IPv4
	if (normalizedIp.includes('.')) {
		const parts = normalizedIp.split('.').map(Number);
		if (parts.length !== 4) return false;

		// 10.0.0.0/8
		if (parts[0] === 10) return true;
		// 172.16.0.0/12
		if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
		// 192.168.0.0/16
		if (parts[0] === 192 && parts[1] === 168) return true;
		// 127.0.0.0/8
		if (parts[0] === 127) return true;
		// 169.254.0.0/16
		if (parts[0] === 169 && parts[1] === 254) return true;

		return false;
	}

	// Handle IPv6 (simplified check)
	if (normalizedIp.includes(':')) {
		if (
			normalizedIp === '::1' ||
			normalizedIp.startsWith('fe80:') ||
			normalizedIp.startsWith('fc00:')
		) {
			return true;
		}
	}

	return false;
}

// ==================== LEGITIMATE BOTS WHITELIST ====================
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

// ==================== USER-AGENT SPOOFING DETECTION ====================
const SUSPICIOUS_USER_AGENTS = [
	// Empty or missing User-Agent
	/^$/,

	// Generic or suspicious patterns
	/^Mozilla\/5\.0$/i,
	/^Mozilla$/i,
	/^curl$/i,
	/^wget$/i,
	/^python-urllib/i,
	/^Go-http-client/i,
	/^Java\/[0-9]/i,

	// Malicious bot patterns (bukan bot resmi)
	/sqlmap/i,
	/nmap/i,
	/masscan/i,
	/zgrab/i,
	/nikto/i,
	/scanner/i,
	/exploit/i,
	/hack/i,
	/attack/i,

	// Very long or suspicious strings
	/^.{200,}$/,
	/<script/i,
	/javascript:/i,
	/data:text\/html/i,
];

// Function to check if bot is legitimate
function isLegitimateBot(userAgent: string): boolean {
	if (!userAgent || userAgent.trim().length === 0) {
		return false;
	}

	for (const pattern of LEGITIMATE_BOTS) {
		if (pattern.test(userAgent)) {
			return true;
		}
	}

	return false;
}

// Function to validate User-Agent
function isSuspiciousUserAgent(userAgent: string): boolean {
	if (!userAgent || userAgent.trim().length === 0) {
		return true;
	}

	// Skip check untuk bot legitimate
	if (isLegitimateBot(userAgent)) {
		return false;
	}

	for (const pattern of SUSPICIOUS_USER_AGENTS) {
		if (pattern.test(userAgent)) {
			return true;
		}
	}

	// Check for reasonable length
	if (userAgent.length > 500) {
		return true;
	}

	// Check for suspicious characters
	if (/[<>"'`]/.test(userAgent)) {
		return true;
	}

	return false;
}

// ==================== REFERRER SPOOFING DETECTION ====================
const SUSPICIOUS_REFERRERS = [
	// Invalid or malformed URLs
	/^https?:\/\/$/i,
	/^https?:\/\/\.$/i,
	/^https?:\/\/\.\.$/i,

	// Localhost in production
	/localhost/i,
	/127\.0\.0\.1/i,
	/0\.0\.0\.0/i,

	// Internal network
	/192\.168\./i,
	/10\./i,
	/172\.(1[6-9]|2[0-9]|3[0-1])\./i,

	// Data URLs
	/data:/i,

	// JavaScript URLs
	/javascript:/i,

	// Very long referrers
	/^.{500,}$/,
];

// Function to validate referrer
function isSuspiciousReferrer(referrer: string): boolean {
	if (!referrer || referrer.trim().length === 0) {
		return false; // Empty referrer is OK
	}

	// Allow local development frontend (localhost:5000) so it isn't flagged
	// as suspicious when accessing private routes like /login.
	if (
		referrer.includes('http://localhost:5000') ||
		referrer.includes('https://localhost:5000') ||
		referrer.includes('http://127.0.0.1:5000') ||
		referrer.includes('https://127.0.0.1:5000')
	) {
		return false;
	}

	for (const pattern of SUSPICIOUS_REFERRERS) {
		if (pattern.test(referrer)) {
			return true;
		}
	}

	// Check for suspicious characters
	if (/[<>"'`\x00-\x1f\x7f-\x9f]/.test(referrer)) {
		return true;
	}

	return false;
}

// ==================== REQUEST PATTERN ANALYSIS ====================
const SUSPICIOUS_REQUEST_PATTERNS = [
	// Directory traversal attempts
	/\.\.\//,
	/\.\.\\\\/,
	/\/etc\/passwd/i,
	/\/proc\//i,
	/\/sys\//i,
	/\/dev\//i,

	// File inclusion attempts
	/\.\.\/.*\.(php|asp|jsp|py|rb)$/i,
	/include.*\.(php|asp|jsp|py|rb)$/i,
	/require.*\.(php|asp|jsp|py|rb)$/i,

	// SQL injection patterns
	/union.*select/i,
	/insert.*into/i,
	/drop.*table/i,
	/or.*1.*=.*1/i,

	// XSS patterns
	/<script/i,
	/javascript:/i,
	/on\w+\s*=/i,

	// Command injection
	/;\s*(cat|ls|dir|type|echo)/i,
	/\|.*(cat|ls|dir|type|echo)/i,
	/`.*(cat|ls|dir|type|echo)/i,
];

// Function to analyze request for suspicious patterns
function hasSuspiciousRequestPattern(req: Request): boolean {
	const url = req.url;
	const query = req.query ? JSON.stringify(req.query) : '';
	const body = req.body ? JSON.stringify(req.body) : '';

	const fullRequest = `${url} ${query} ${body}`;

	for (const pattern of SUSPICIOUS_REQUEST_PATTERNS) {
		if (pattern.test(fullRequest)) {
			return true;
		}
	}

	return false;
}

// ==================== BEAUTIFUL ERROR RESPONSE ====================
function sendBeautifulAntiSpoofingError(
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
			help: 'This request appears to be from a suspicious source. Please contact the administrator if you believe this is an error.',
		},
	};

	// Untuk API requests, return JSON
	if (
		res.req?.headers['content-type']?.includes('application/json') ||
		res.req?.path?.startsWith('/api/')
	) {
		return res.status(statusCode).json(errorResponse);
	}

	// Cek apakah sudah di error page untuk mencegah redirect loop
	if (res.req?.path?.startsWith('/error')) {
		return res.status(statusCode).json(errorResponse);
	}

	// Untuk browser requests, redirect ke error page
	const errorParam = encodeURIComponent(JSON.stringify(errorResponse.error));
	const redirectUrl = `/error?error=${errorParam}`;
	return res.redirect(redirectUrl);
}

// ==================== ANTI-SPOOFING PROTECTION MIDDLEWARE ====================
export const antiSpoofingProtectionMiddleware = async (
	req: Request,
	res: Response,
	next: NextFunction
) => {
	try {
		const settings = await getCachedAntiSpoofingMiddlewareSettings();

		if (
			settings.allEnabled === false ||
			!settings.antiSpoofingProtectionEnabled
		) {
			return next();
		}

		// Skip protection untuk frontend files dan static routes
		if (
			req.path.includes('/src/') ||
			req.path.includes('/@') ||
			req.path.includes('/node_modules/') ||
			req.path.includes('/uploads/') ||
			req.path.includes('/attached_assets/') ||
			req.path.endsWith('.tsx') ||
			req.path.endsWith('.ts') ||
			req.path.endsWith('.js') ||
			req.path.endsWith('.css') ||
			req.path.endsWith('.mjs') ||
			req.path.endsWith('.png') ||
			req.path.endsWith('.jpg') ||
			req.path.endsWith('.jpeg') ||
			req.path.endsWith('.gif') ||
			req.path.endsWith('.svg') ||
			req.path.endsWith('.ico') ||
			req.path.endsWith('.woff') ||
			req.path.endsWith('.woff2') ||
			req.path.endsWith('.ttf') ||
			req.path.endsWith('.eot') ||
			req.path === '/' ||
			req.path === '/sitemap.xml' ||
			req.path === '/robots.txt' ||
			req.path.startsWith('/berita/') ||
			req.path.startsWith('/api/') || // Skip API routes untuk anti-spoofing (handled by API protection)
			req.path.startsWith('/error') // Skip error page untuk mencegah redirect loop
		) {
			return next();
		}

		const clientIP = req.ip || req.connection?.remoteAddress || 'unknown';
		const trustedClientIP = getTrustedClientIp(req);
		const userAgent = req.get('User-Agent') || '';
		const referrer = req.get('Referer') || '';
		const xForwardedFor = req.get('X-Forwarded-For') || '';
		const xRealIP = req.get('X-Real-IP') || '';
		const xForwardedProto = req.get('X-Forwarded-Proto') || '';

		// ==================== PUBLIC VS PRIVATE CONTENT DETECTION ====================
		const isPublicContent =
			req.path === '/' ||
			req.path.startsWith('/berita') ||
			req.path === '/sitemap.xml' ||
			req.path === '/robots.txt';

		const isPrivateContent =
			req.path.startsWith('/dashboard') ||
			req.path.startsWith('/api/') ||
			req.path === '/login';

		// Allow legitimate bots untuk mengakses konten public
		if (isLegitimateBot(userAgent)) {
			console.log(
				`🤖 Legitimate Bot Access Allowed: ${userAgent} to ${req.path}`
			);
			return next();
		}

		// Untuk konten public, biarkan semua akses (termasuk yang mencurigakan)
		// tapi tetap log untuk monitoring
		if (isPublicContent) {
			// Log aktivitas mencurigakan tapi tetap izinkan akses
			if (isSuspiciousUserAgent(userAgent) || isSuspiciousReferrer(referrer)) {
				console.log(
					`⚠️ Suspicious Activity on Public Content (ALLOWED): ${userAgent} from IP ${clientIP} to ${req.path}`
				);
				console.log(`   User-Agent: ${userAgent}`);
				console.log(`   Referrer: ${referrer}`);
				console.log(`   X-Forwarded-For: ${xForwardedFor}`);
			}
			return next();
		}

		// ==================== PRIVATE CONTENT PROTECTION ====================
		// Hanya lakukan deteksi spoofing untuk konten private
		if (isPrivateContent) {
			let spoofingDetected = false;
			let spoofingReason = '';

			// ==================== IP SPOOFING DETECTION ====================
			// Check only the original client hop in X-Forwarded-For.
			// Private IPs in subsequent hops are usually internal reverse-proxy chain.
			if (xForwardedFor) {
				const forwardedIPs = xForwardedFor.split(',').map((ip) => ip.trim());
				const originalClientHop = forwardedIPs[0];
				if (originalClientHop && isPrivateIP(originalClientHop)) {
					spoofingDetected = true;
					spoofingReason = `Private client IP detected in X-Forwarded-For: ${originalClientHop}`;
				}
			}

			// X-Real-IP often contains local proxy IP in reverse-proxy deployments.
			// Treat it as spoofing only when trusted client IP is also private.
			if (
				!spoofingDetected &&
				xRealIP &&
				isPrivateIP(xRealIP) &&
				isPrivateIP(trustedClientIP)
			) {
				spoofingDetected = true;
				spoofingReason = `Private IP detected in X-Real-IP: ${xRealIP}`;
			}

			// Check for protocol mismatch (HTTPS spoofing)
			if (req.secure && xForwardedProto === 'http') {
				spoofingDetected = true;
				spoofingReason =
					'Protocol mismatch: HTTPS request with HTTP X-Forwarded-Proto';
			}

			// ==================== USER-AGENT SPOOFING DETECTION ====================
			if (!spoofingDetected && isSuspiciousUserAgent(userAgent)) {
				spoofingDetected = true;
				spoofingReason = `Suspicious User-Agent: ${userAgent}`;
			}

			// ==================== REFERRER SPOOFING DETECTION ====================
			if (!spoofingDetected && isSuspiciousReferrer(referrer)) {
				spoofingDetected = true;
				spoofingReason = `Suspicious Referrer: ${referrer}`;
			}

			// ==================== REQUEST PATTERN ANALYSIS ====================
			if (!spoofingDetected && hasSuspiciousRequestPattern(req)) {
				spoofingDetected = true;
				spoofingReason = 'Suspicious request pattern detected';
			}

			// ==================== BLOCK SUSPICIOUS ACCESS TO PRIVATE CONTENT ====================
			if (spoofingDetected) {
				console.log(
					`🚨 Anti-Spoofing Protection: Suspicious access to PRIVATE content from IP ${clientIP}`
				);
				console.log(`   Reason: ${spoofingReason}`);
				console.log(`   Path: ${req.path}`);
				console.log(`   Method: ${req.method}`);
				console.log(`   User-Agent: ${userAgent}`);
				console.log(`   Referrer: ${referrer}`);
				console.log(`   X-Forwarded-For: ${xForwardedFor}`);
				console.log(`   X-Real-IP: ${xRealIP}`);

				return sendBeautifulAntiSpoofingError(
					res,
					403,
					'Security Violation',
					'Access to private content blocked. This request appears to be from a suspicious source.',
					{
						reason: spoofingReason,
						path: req.path,
						method: req.method,
						ip: clientIP,
						userAgent: userAgent,
						referrer: referrer,
					}
				);
			}
		}

		// Log legitimate requests for monitoring
		if (clientIP !== 'unknown' && (referrer || userAgent)) {
			console.log(
				`✅ Anti-Spoofing: Valid request from IP ${clientIP} to ${req.path}`
			);
		}

		next();
	} catch (error) {
		console.error('Error in anti-spoofing protection middleware:', error);
		// Continue processing if middleware fails
		next();
	}
};

// ==================== PORT SCANNING DETECTION ====================
const PORT_SCANNING_THRESHOLDS = {
	WINDOW_MS: 60 * 1000, // 1 minute
	MAX_REQUESTS_PER_MINUTE: 100,
	MAX_DIFFERENT_ENDPOINTS: 20,
	SUSPICIOUS_ENDPOINTS: [
		'/admin',
		'/wp-admin',
		'/phpmyadmin',
		'/.env',
		'/config',
	],
};

const portScanningData = new Map<
	string,
	{
		count: number;
		endpoints: Set<string>;
		resetTime: number;
	}
>();

// Function to detect port scanning
function isPortScanning(clientIP: string, currentPath: string): boolean {
	const now = Date.now();
	const scanData = portScanningData.get(clientIP);

	if (!scanData || now > scanData.resetTime) {
		// Reset or create new scan data
		portScanningData.set(clientIP, {
			count: 1,
			endpoints: new Set([currentPath]),
			resetTime: now + PORT_SCANNING_THRESHOLDS.WINDOW_MS,
		});
		return false;
	}

	// Increment request count
	scanData.count++;
	scanData.endpoints.add(currentPath);

	// Update reset time if needed
	if (now > scanData.resetTime) {
		scanData.resetTime = now + PORT_SCANNING_THRESHOLDS.WINDOW_MS;
	}

	// Check if exceeds thresholds
	if (scanData.count > PORT_SCANNING_THRESHOLDS.MAX_REQUESTS_PER_MINUTE) {
		return true;
	}

	if (
		scanData.endpoints.size > PORT_SCANNING_THRESHOLDS.MAX_DIFFERENT_ENDPOINTS
	) {
		return true;
	}

	// Check for suspicious endpoints
	for (const endpoint of Array.from(scanData.endpoints)) {
		if (
			PORT_SCANNING_THRESHOLDS.SUSPICIOUS_ENDPOINTS.some((suspicious) =>
				endpoint.toLowerCase().includes(suspicious)
			)
		) {
			return true;
		}
	}

	return false;
}

// ==================== PORT SCANNING PROTECTION MIDDLEWARE ====================
export const portScanningProtectionMiddleware = async (
	req: Request,
	res: Response,
	next: NextFunction
) => {
	try {
		const settings = await getCachedAntiSpoofingMiddlewareSettings();

		if (
			settings.allEnabled === false ||
			!settings.antiSpoofingProtectionEnabled
		) {
			return next();
		}

		const clientIP = req.ip || req.connection?.remoteAddress || 'unknown';

		// Skip port scanning detection for API routes and static files
		if (
			req.path.startsWith('/api/') ||
			req.path.includes('/src/') ||
			req.path.includes('/uploads/') ||
			req.path.includes('/attached_assets/') ||
			req.path.endsWith('.tsx') ||
			req.path.endsWith('.ts') ||
			req.path.endsWith('.js') ||
			req.path.endsWith('.css') ||
			req.path.endsWith('.mjs') ||
			req.path.endsWith('.png') ||
			req.path.endsWith('.jpg') ||
			req.path.endsWith('.jpeg') ||
			req.path.endsWith('.gif') ||
			req.path.endsWith('.svg') ||
			req.path.endsWith('.ico') ||
			req.path === '/sitemap.xml' ||
			req.path === '/robots.txt' ||
			req.path.startsWith('/error') // Skip error page untuk mencegah redirect loop
		) {
			return next();
		}

		// Detect port scanning
		if (isPortScanning(clientIP, req.path)) {
			console.log(
				`🚨 Port Scanning Protection: Port scanning detected from IP ${clientIP}`
			);

			// Cek apakah sudah di error page untuk mencegah redirect loop
			if (req.path.startsWith('/error')) {
				return res.status(429).json({
					error: {
						code: 429,
						title: 'Too Many Requests',
						message:
							'Port scanning behavior detected. Please slow down your requests.',
						timestamp: new Date().toISOString(),
						details: {
							type: 'port_scanning',
							ip: clientIP,
							path: req.path,
							requestCount: portScanningData.get(clientIP)?.count || 0,
						},
						help: 'This request appears to be from a suspicious source. Please contact the administrator if you believe this is an error.',
					},
				});
			}

			return sendBeautifulAntiSpoofingError(
				res,
				429,
				'Too Many Requests',
				'Port scanning behavior detected. Please slow down your requests.',
				{
					type: 'port_scanning',
					ip: clientIP,
					path: req.path,
					requestCount: portScanningData.get(clientIP)?.count || 0,
				}
			);
		}

		next();
	} catch (error) {
		console.error('Error in port scanning protection middleware:', error);
		next();
	}
};

// ==================== CLEANUP FUNCTIONS ====================
export const cleanupAntiSpoofingData = () => {
	const now = Date.now();

	// Cleanup expired port scanning data
	for (const [ip, data] of Array.from(portScanningData.entries())) {
		if (now > data.resetTime) {
			portScanningData.delete(ip);
		}
	}
};

// Run cleanup every minute
setInterval(cleanupAntiSpoofingData, 60 * 1000);

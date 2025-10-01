import { NextFunction, Request, Response } from 'express';
import { getMiddlewareSettings } from '../models/middleware-settings';

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
	// Handle IPv4
	if (ip.includes('.')) {
		const parts = ip.split('.').map(Number);
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
	if (ip.includes(':')) {
		if (ip === '::1' || ip.startsWith('fe80:') || ip.startsWith('fc00:')) {
			return true;
		}
	}

	return false;
}

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

	// Bot-like patterns
	/bot/i,
	/crawler/i,
	/spider/i,
	/scanner/i,
	/sqlmap/i,
	/nmap/i,
	/masscan/i,
	/zgrab/i,
	/nikto/i,

	// Very long or suspicious strings
	/^.{200,}$/,
	/<script/i,
	/javascript:/i,
	/data:text\/html/i,
];

// Function to validate User-Agent
function isSuspiciousUserAgent(userAgent: string): boolean {
	if (!userAgent || userAgent.trim().length === 0) {
		return true;
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

		// Skip middleware if disabled
		if (!settings.apiProtectionEnabled) {
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
			req.path.startsWith('/artikel/') ||
			req.path.startsWith('/api/') // Skip API routes untuk anti-spoofing (handled by API protection)
		) {
			return next();
		}

		const clientIP = req.ip || req.connection?.remoteAddress || 'unknown';
		const userAgent = req.get('User-Agent') || '';
		const referrer = req.get('Referer') || '';
		const xForwardedFor = req.get('X-Forwarded-For') || '';
		const xRealIP = req.get('X-Real-IP') || '';
		const xForwardedProto = req.get('X-Forwarded-Proto') || '';

		let spoofingDetected = false;
		let spoofingReason = '';

		// ==================== IP SPOOFING DETECTION ====================
		// Check X-Forwarded-For header for private IPs
		if (xForwardedFor) {
			const forwardedIPs = xForwardedFor.split(',').map((ip) => ip.trim());
			for (const forwardedIP of forwardedIPs) {
				if (isPrivateIP(forwardedIP)) {
					spoofingDetected = true;
					spoofingReason = `Private IP detected in X-Forwarded-For: ${forwardedIP}`;
					break;
				}
			}
		}

		// Check X-Real-IP header for private IPs
		if (!spoofingDetected && xRealIP && isPrivateIP(xRealIP)) {
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

		// ==================== LOG AND BLOCK SPOOFING ATTEMPTS ====================
		if (spoofingDetected) {
			console.log(
				`🚨 Anti-Spoofing Protection: Spoofing attempt detected from IP ${clientIP}`
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
				'Spoofing attempt detected. This request has been blocked for security reasons.',
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
	for (const endpoint of scanData.endpoints) {
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

		// Skip middleware if disabled
		if (!settings.apiProtectionEnabled) {
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
			req.path === '/robots.txt'
		) {
			return next();
		}

		// Detect port scanning
		if (isPortScanning(clientIP, req.path)) {
			console.log(
				`🚨 Port Scanning Protection: Port scanning detected from IP ${clientIP}`
			);

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

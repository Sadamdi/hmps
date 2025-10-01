import { NextFunction, Request, Response } from 'express';
import { getMiddlewareSettings } from '../models/middleware-settings';

// Cache for middleware settings
let dnsLayerSettingsCache: any = null;
let dnsLayerSettingsCacheTimestamp: number = 0;
const DNS_LAYER_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Function to get middleware settings with caching for DNS layer middleware
async function getCachedDnsLayerMiddlewareSettings() {
	const now = Date.now();
	if (
		!dnsLayerSettingsCache ||
		now - dnsLayerSettingsCacheTimestamp > DNS_LAYER_CACHE_DURATION
	) {
		try {
			dnsLayerSettingsCache = await getMiddlewareSettings();
			dnsLayerSettingsCacheTimestamp = now;
		} catch (error) {
			console.error('Error getting DNS layer middleware settings:', error);
			// Fallback to default enabled settings if error
			dnsLayerSettingsCache = {
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
	return dnsLayerSettingsCache;
}

// ==================== DNS LAYER PROTECTION CONFIGURATION ====================

// Whitelisted domains (your legitimate domains)
const WHITELISTED_DOMAINS = [
	'localhost',
	'127.0.0.1',
	'43.157.211.134',
	'himatif-encoder.com',
	'www.himatif-encoder.com',
];

// Allowed TLDs for legitimate requests
const ALLOWED_TLDS = [
	'.com',
	'.org',
	'.net',
	'.edu',
	'.gov',
	'.mil',
	'.int',
	'.ac',
	'.ad',
	'.ae',
	'.af',
	'.ag',
	'.ai',
	'.al',
	'.am',
	'.ao',
	'.aq',
	'.ar',
	'.as',
	'.at',
	'.au',
	'.aw',
	'.ax',
	'.az',
	'.ba',
	'.bb',
	'.bd',
	'.be',
	'.bf',
	'.bg',
	'.bh',
	'.bi',
	'.bj',
	'.bl',
	'.bm',
	'.bn',
	'.bo',
	'.bq',
	'.br',
	'.bs',
	'.bt',
	'.bv',
	'.bw',
	'.by',
	'.bz',
	'.ca',
	'.cc',
	'.cd',
	'.cf',
	'.cg',
	'.ch',
	'.ci',
	'.ck',
	'.cl',
	'.cm',
	'.cn',
	'.co',
	'.cr',
	'.cu',
	'.cv',
	'.cw',
	'.cx',
	'.cy',
	'.cz',
	'.de',
	'.dj',
	'.dk',
	'.dm',
	'.do',
	'.dz',
	'.ec',
	'.ee',
	'.eg',
	'.eh',
	'.er',
	'.es',
	'.et',
	'.eu',
	'.fi',
	'.fj',
	'.fk',
	'.fm',
	'.fo',
	'.fr',
	'.ga',
	'.gb',
	'.gd',
	'.ge',
	'.gf',
	'.gg',
	'.gh',
	'.gi',
	'.gl',
	'.gm',
	'.gn',
	'.gp',
	'.gq',
	'.gr',
	'.gs',
	'.gt',
	'.gu',
	'.gw',
	'.gy',
	'.hk',
	'.hm',
	'.hn',
	'.hr',
	'.ht',
	'.hu',
	'.id',
	'.ie',
	'.il',
	'.im',
	'.in',
	'.io',
	'.iq',
	'.ir',
	'.is',
	'.it',
	'.je',
	'.jm',
	'.jo',
	'.jp',
	'.ke',
	'.kg',
	'.kh',
	'.ki',
	'.km',
	'.kn',
	'.kp',
	'.kr',
	'.kw',
	'.ky',
	'.kz',
	'.la',
	'.lb',
	'.lc',
	'.li',
	'.lk',
	'.lr',
	'.ls',
	'.lt',
	'.lu',
	'.lv',
	'.ly',
	'.ma',
	'.mc',
	'.md',
	'.me',
	'.mf',
	'.mg',
	'.mh',
	'.mk',
	'.ml',
	'.mm',
	'.mn',
	'.mo',
	'.mp',
	'.mq',
	'.mr',
	'.ms',
	'.mt',
	'.mu',
	'.mv',
	'.mw',
	'.mx',
	'.my',
	'.mz',
	'.na',
	'.nc',
	'.ne',
	'.nf',
	'.ng',
	'.ni',
	'.nl',
	'.no',
	'.np',
	'.nr',
	'.nu',
	'.nz',
	'.om',
	'.pa',
	'.pe',
	'.pf',
	'.pg',
	'.ph',
	'.pk',
	'.pl',
	'.pm',
	'.pn',
	'.pr',
	'.ps',
	'.pt',
	'.pw',
	'.py',
	'.qa',
	'.re',
	'.ro',
	'.rs',
	'.ru',
	'.rw',
	'.sa',
	'.sb',
	'.sc',
	'.sd',
	'.se',
	'.sg',
	'.sh',
	'.si',
	'.sj',
	'.sk',
	'.sl',
	'.sm',
	'.sn',
	'.so',
	'.sr',
	'.ss',
	'.st',
	'.su',
	'.sv',
	'.sx',
	'.sy',
	'.sz',
	'.tc',
	'.td',
	'.tf',
	'.tg',
	'.th',
	'.tj',
	'.tk',
	'.tl',
	'.tm',
	'.tn',
	'.to',
	'.tp',
	'.tr',
	'.tt',
	'.tv',
	'.tw',
	'.tz',
	'.ua',
	'.ug',
	'.uk',
	'.us',
	'.uy',
	'.uz',
	'.va',
	'.vc',
	'.ve',
	'.vg',
	'.vi',
	'.vn',
	'.vu',
	'.wf',
	'.ws',
	'.ye',
	'.yt',
	'.yu',
	'.za',
	'.zm',
	'.zw',
];

// Suspicious TLDs commonly used for malicious activities
const SUSPICIOUS_TLDS = [
	'.tk',
	'.ml',
	'.ga',
	'.cf',
	'.gq',
	'.pw',
	'.top',
	'.win',
	'.bid',
	'.stream',
	'.download',
	'.racing',
	'.science',
	'.party',
	'.review',
	'.trade',
	'.date',
	'.loan',
	'.cricket',
	'.accountant',
];

// Blacklisted domains known for malicious activities
const BLACKLISTED_DOMAINS = [
	// Malware domains
	'malware-test.com',
	'evil.com',
	'phishing-site.com',

	// Test domains that might be used for attacks
	'example.com',
	'test.com',

	// Domains known for hosting malicious content
	'drive-by-download.com',
	'exploit-kit.com',
];

// ==================== DNS REBINDING PROTECTION ====================
const DNS_REBINDING_PATTERNS = [
	// Common DNS rebinding patterns
	/^\d+\.\d+\.\d+\.\d+$/, // Pure IP addresses
	/^localhost$/,
	/^127\./,
	/^10\./,
	/^192\.168\./,
	/^172\.(1[6-9]|2[0-9]|3[0-1])\./,
	/^\[::1\]$/,
	/^::1$/,
	/^fe80:/,
	/^fc00:/,

	// Internal hostnames
	/broadcast$/,
	/multicast$/,
	/linklocal$/,
];

// Function to detect DNS rebinding attempts
function isDnsRebindingAttempt(hostname: string): boolean {
	if (!hostname) return false;

	// Check for obvious DNS rebinding patterns
	for (const pattern of DNS_REBINDING_PATTERNS) {
		if (pattern.test(hostname)) {
			return true;
		}
	}

	// Check for suspicious domain patterns
	if (
		hostname.includes('..') ||
		hostname.startsWith('.') ||
		hostname.endsWith('.')
	) {
		return true;
	}

	// Check for extremely long hostnames (potential DNS rebinding)
	if (hostname.length > 253) {
		// RFC 1035 limit
		return true;
	}

	// Check for suspicious characters
	if (/[<>"'`\x00-\x1f\x7f-\x9f]/.test(hostname)) {
		return true;
	}

	return false;
}

// ==================== HOST HEADER VALIDATION ====================
function isValidHostHeader(
	host: string,
	referer: string,
	origin: string
): boolean {
	if (!host) return false;

	// Extract domain from referer/origin if available
	let requestDomain = '';
	if (referer) {
		try {
			const refererUrl = new URL(referer);
			requestDomain = refererUrl.hostname;
		} catch (e) {
			// Invalid referer URL
		}
	}

	if (origin) {
		try {
			const originUrl = new URL(origin);
			if (!requestDomain) {
				requestDomain = originUrl.hostname;
			}
		} catch (e) {
			// Invalid origin URL
		}
	}

	// If we have a request domain, check if host matches
	if (requestDomain) {
		return host === requestDomain || host === `www.${requestDomain}`;
	}

	// Check if host is in whitelist
	for (const domain of WHITELISTED_DOMAINS) {
		if (host === domain || host.endsWith(`.${domain}`)) {
			return true;
		}
	}

	return false;
}

// ==================== SUSPICIOUS DOMAIN DETECTION ====================
function isSuspiciousDomain(domain: string): boolean {
	if (!domain) return false;

	// Check blacklisted domains
	for (const blacklisted of BLACKLISTED_DOMAINS) {
		if (domain.includes(blacklisted)) {
			return true;
		}
	}

	// Check suspicious TLDs
	for (const tld of SUSPICIOUS_TLDS) {
		if (domain.endsWith(tld)) {
			return true;
		}
	}

	// Check for suspicious domain patterns
	if (/^[0-9a-f]{32,}\.com$/.test(domain)) {
		// MD5 hash domains
		return true;
	}

	if (/^[a-z]{1,3}\d{1,3}\.com$/.test(domain)) {
		// Short random domains
		return true;
	}

	// Check for domains with suspicious keywords
	const suspiciousKeywords = [
		'malware',
		'exploit',
		'hack',
		'phish',
		'spam',
		'scam',
	];
	for (const keyword of suspiciousKeywords) {
		if (domain.includes(keyword)) {
			return true;
		}
	}

	return false;
}

// ==================== BEAUTIFUL ERROR RESPONSE ====================
function sendBeautifulDnsLayerError(
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
			help: 'This request appears to be from a suspicious domain or may be a DNS-related attack. Please contact the administrator if you believe this is an error.',
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

// ==================== DNS LAYER PROTECTION MIDDLEWARE ====================
export const dnsLayerProtectionMiddleware = async (
	req: Request,
	res: Response,
	next: NextFunction
) => {
	try {
		const settings = await getCachedDnsLayerMiddlewareSettings();

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
			req.path === '/sitemap.xml' ||
			req.path === '/robots.txt' ||
			req.path.startsWith('/artikel/')
		) {
			return next();
		}

		const host = req.get('Host') || '';
		const referer = req.get('Referer') || '';
		const origin = req.get('Origin') || '';
		const clientIP = req.ip || req.connection?.remoteAddress || 'unknown';

		let dnsAttackDetected = false;
		let attackReason = '';

		// ==================== DNS REBINDING DETECTION ====================
		if (isDnsRebindingAttempt(host)) {
			dnsAttackDetected = true;
			attackReason = `DNS rebinding attempt detected: ${host}`;
		}

		// ==================== HOST HEADER VALIDATION ====================
		if (!dnsAttackDetected && !isValidHostHeader(host, referer, origin)) {
			dnsAttackDetected = true;
			attackReason = `Invalid or suspicious Host header: ${host}`;
		}

		// ==================== SUSPICIOUS DOMAIN DETECTION ====================
		if (!dnsAttackDetected && isSuspiciousDomain(host)) {
			dnsAttackDetected = true;
			attackReason = `Suspicious domain detected: ${host}`;
		}

		// ==================== ORIGIN-HOST MISMATCH DETECTION ====================
		if (!dnsAttackDetected && origin && host) {
			try {
				const originUrl = new URL(origin);
				const originDomain = originUrl.hostname;

				if (originDomain !== host && `www.${originDomain}` !== host) {
					// Check if it's a legitimate subdomain relationship
					if (!host.endsWith(`.${originDomain}`)) {
						dnsAttackDetected = true;
						attackReason = `Origin-Host mismatch: Origin=${originDomain}, Host=${host}`;
					}
				}
			} catch (e) {
				// Invalid origin URL
			}
		}

		// ==================== LOG AND BLOCK DNS ATTACKS ====================
		if (dnsAttackDetected) {
			console.log(
				`🚨 DNS Layer Protection: DNS attack detected from IP ${clientIP}`
			);
			console.log(`   Reason: ${attackReason}`);
			console.log(`   Path: ${req.path}`);
			console.log(`   Method: ${req.method}`);
			console.log(`   Host: ${host}`);
			console.log(`   Referer: ${referer}`);
			console.log(`   Origin: ${origin}`);

			return sendBeautifulDnsLayerError(
				res,
				403,
				'Security Violation',
				'DNS layer attack detected. This request has been blocked for security reasons.',
				{
					type: 'dns_attack',
					reason: attackReason,
					host: host,
					referer: referer,
					origin: origin,
					ip: clientIP,
				}
			);
		}

		// Log legitimate requests for monitoring
		if (host) {
			console.log(`✅ DNS Layer: Valid request to ${host}${req.path}`);
		}

		next();
	} catch (error) {
		console.error('Error in DNS layer protection middleware:', error);
		// Continue processing if middleware fails
		next();
	}
};

// ==================== DNS CACHE POISONING DETECTION ====================
// Track requests from suspicious sources
const suspiciousSourceTracker = new Map<
	string,
	{
		count: number;
		lastSeen: number;
		domains: Set<string>;
	}
>();

const SUSPICIOUS_SOURCES = {
	MAX_REQUESTS_PER_MINUTE: 50,
	MAX_DIFFERENT_DOMAINS: 10,
	WINDOW_MS: 60 * 1000,
};

// Function to detect DNS cache poisoning attempts
function isDnsCachePoisoningAttempt(clientIP: string, host: string): boolean {
	const now = Date.now();
	const sourceData = suspiciousSourceTracker.get(clientIP);

	if (!sourceData) {
		// First request from this IP
		suspiciousSourceTracker.set(clientIP, {
			count: 1,
			lastSeen: now,
			domains: new Set([host]),
		});
		return false;
	}

	// Update existing data
	sourceData.count++;
	sourceData.lastSeen = now;
	sourceData.domains.add(host);

	// Reset if window expired
	if (now - sourceData.lastSeen > SUSPICIOUS_SOURCES.WINDOW_MS) {
		sourceData.count = 1;
		sourceData.domains.clear();
		sourceData.domains.add(host);
		sourceData.lastSeen = now;
	}

	// Check for suspicious patterns
	if (sourceData.count > SUSPICIOUS_SOURCES.MAX_REQUESTS_PER_MINUTE) {
		return true;
	}

	if (sourceData.domains.size > SUSPICIOUS_SOURCES.MAX_DIFFERENT_DOMAINS) {
		return true;
	}

	return false;
}

// ==================== DNS CACHE POISONING PROTECTION ====================
export const dnsCachePoisoningProtectionMiddleware = async (
	req: Request,
	res: Response,
	next: NextFunction
) => {
	try {
		const settings = await getCachedDnsLayerMiddlewareSettings();

		// Skip middleware if disabled
		if (!settings.apiProtectionEnabled) {
			return next();
		}

		const host = req.get('Host') || '';
		const clientIP = req.ip || req.connection?.remoteAddress || 'unknown';

		// Skip for legitimate whitelisted domains
		const isWhitelisted = WHITELISTED_DOMAINS.some(
			(domain) => host === domain || host.endsWith(`.${domain}`)
		);

		if (isWhitelisted) {
			return next();
		}

		// Detect DNS cache poisoning attempts
		if (isDnsCachePoisoningAttempt(clientIP, host)) {
			console.log(
				`🚨 DNS Cache Poisoning Protection: Suspicious activity from IP ${clientIP}`
			);

			return sendBeautifulDnsLayerError(
				res,
				429,
				'Too Many Requests',
				'Suspicious DNS activity detected. Please slow down your requests.',
				{
					type: 'dns_cache_poisoning',
					ip: clientIP,
					host: host,
					requestCount: suspiciousSourceTracker.get(clientIP)?.count || 0,
				}
			);
		}

		next();
	} catch (error) {
		console.error('Error in DNS cache poisoning protection middleware:', error);
		next();
	}
};

// ==================== CLEANUP FUNCTIONS ====================
export const cleanupDnsLayerData = () => {
	const now = Date.now();

	// Cleanup expired suspicious source data
	for (const [ip, data] of Array.from(suspiciousSourceTracker.entries())) {
		if (now - data.lastSeen > SUSPICIOUS_SOURCES.WINDOW_MS * 2) {
			suspiciousSourceTracker.delete(ip);
		}
	}
};

// Run cleanup every 5 minutes
setInterval(cleanupDnsLayerData, 5 * 60 * 1000);

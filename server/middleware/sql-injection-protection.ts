import { NextFunction, Request, Response } from 'express';

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

	res.status(statusCode).json(errorResponse);
}

// ==================== SQL INJECTION PATTERNS ====================
const sqlInjectionPatterns = [
	// Basic SQL injection patterns
	/\b(union\s+select|select\s+union)\b/i,
	/\b(insert\s+into|update\s+set|delete\s+from)\b/i,
	/\b(drop\s+table|create\s+table|alter\s+table)\b/i,
	/\b(exec\s+sp_|execute\s+sp_)\b/i,

	// Comment patterns (hanya untuk body/query, bukan URL)
	/(--|#|\/\*|\*\/)/,

	// String concatenation (hanya untuk body/query)
	/(%27|%22|\'|\")/,

	// Boolean logic
	/\b(and|or)\s+\d+\s*=\s*\d+/i,
	/\b(and|or)\s+\d+\s*!=\s*\d+/i,
	/\b(and|or)\s+\d+\s*>\s*\d+/i,
	/\b(and|or)\s+\d+\s*<\s*\d+/i,

	// Time-based attacks
	/\b(sleep|benchmark|waitfor)\s*\(/i,

	// Stacked queries
	/;\s*(select|insert|update|delete|drop|create|alter|exec)/i,

	// Error-based attacks
	/\b(convert|cast)\s*\(/i,
	/\b(extractvalue|updatexml)\s*\(/i,

	// Blind SQL injection
	/\b(if|case)\s*\(/i,
	/\b(substr|substring|mid|left|right)\s*\(/i,

	// Advanced patterns
	/\b(load_file|into\s+outfile|into\s+dumpfile)\b/i,
	/\b(group_concat|concat)\s*\(/i,
	/\b(information_schema|sys\.|mysql\.)\b/i,
];

// ==================== NOSQL INJECTION PATTERNS ====================
const noSqlInjectionPatterns = [
	// MongoDB injection patterns
	/\$where\s*:/i,
	/\$ne\s*:/i,
	/\$gt\s*:/i,
	/\$lt\s*:/i,
	/\$gte\s*:/i,
	/\$lte\s*:/i,
	/\$in\s*:/i,
	/\$nin\s*:/i,
	/\$regex\s*:/i,
	/\$options\s*:/i,
	/\$exists\s*:/i,
	/\$type\s*:/i,
	/\$mod\s*:/i,
	/\$all\s*:/i,
	/\$elemMatch\s*:/i,
	/\$size\s*:/i,
	/\$or\s*:/i,
	/\$and\s*:/i,
	/\$not\s*:/i,
	/\$nor\s*:/i,

	// JavaScript injection in MongoDB
	/\$where\s*:\s*function/i,
	/\$where\s*:\s*"function/i,
	/\$where\s*:\s*'function/i,

	// Array injection
	/\$in\s*:\s*\[/i,
	/\$nin\s*:\s*\[/i,
	/\$all\s*:\s*\[/i,
];

// ==================== XSS PATTERNS ====================
const xssPatterns = [
	// Script tags
	/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
	/<script\b[^>]*>/gi,

	// Event handlers
	/on\w+\s*=/gi,
	/onload\s*=/gi,
	/onerror\s*=/gi,
	/onclick\s*=/gi,
	/onmouseover\s*=/gi,
	/onfocus\s*=/gi,
	/onblur\s*=/gi,

	// JavaScript protocols
	/javascript:/gi,
	/javas&#x63;ript:/gi,
	/javas&#x63;ript&#x3A;/gi,

	// Data URIs
	/data:text\/html/gi,
	/data:application\/javascript/gi,

	// VBScript
	/vbscript:/gi,
	/vbs:/gi,

	// Expression
	/expression\s*\(/gi,

	// Eval
	/eval\s*\(/gi,
	/setTimeout\s*\(/gi,
	/setInterval\s*\(/gi,
];

// ==================== SQL INJECTION PROTECTION MIDDLEWARE ====================
export const sqlInjectionProtectionMiddleware = (
	req: Request,
	res: Response,
	next: NextFunction
) => {
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
		req.path === '/login' ||
		req.path === '/dashboard' ||
		req.path === '/artikel' ||
		req.path === '/library' ||
		req.path === '/about' ||
		req.path === '/ai-chat' ||
		req.path.startsWith('/artikel/') ||
		req.path.startsWith('/dashboard/') ||
		req.path.startsWith('/login') ||
		// Skip untuk semua API routes
		req.path.startsWith('/api/') ||
		req.path.startsWith('/.well-known/')
	) {
		return next();
	}

	const clientIP = req.ip || req.connection.remoteAddress || 'unknown';
	let isInjectionDetected = false;
	let injectionType = '';
	let detectedPattern = '';

	// ==================== CHECK REQUEST BODY ====================
	if (req.body) {
		const bodyString = JSON.stringify(req.body);

		// Check SQL injection
		for (const pattern of sqlInjectionPatterns) {
			if (pattern.test(bodyString)) {
				isInjectionDetected = true;
				injectionType = 'SQL Injection';
				detectedPattern = pattern.source;
				break;
			}
		}

		// Check NoSQL injection
		if (!isInjectionDetected) {
			for (const pattern of noSqlInjectionPatterns) {
				if (pattern.test(bodyString)) {
					isInjectionDetected = true;
					injectionType = 'NoSQL Injection';
					detectedPattern = pattern.source;
					break;
				}
			}
		}

		// Check XSS
		if (!isInjectionDetected) {
			for (const pattern of xssPatterns) {
				if (pattern.test(bodyString)) {
					isInjectionDetected = true;
					injectionType = 'XSS';
					detectedPattern = pattern.source;
					break;
				}
			}
		}
	}

	// ==================== CHECK QUERY PARAMETERS ====================
	if (!isInjectionDetected && req.query) {
		const queryString = JSON.stringify(req.query);

		// Check SQL injection
		for (const pattern of sqlInjectionPatterns) {
			if (pattern.test(queryString)) {
				isInjectionDetected = true;
				injectionType = 'SQL Injection';
				detectedPattern = pattern.source;
				break;
			}
		}

		// Check NoSQL injection
		if (!isInjectionDetected) {
			for (const pattern of noSqlInjectionPatterns) {
				if (pattern.test(queryString)) {
					isInjectionDetected = true;
					injectionType = 'NoSQL Injection';
					detectedPattern = pattern.source;
					break;
				}
			}
		}

		// Check XSS
		if (!isInjectionDetected) {
			for (const pattern of xssPatterns) {
				if (pattern.test(queryString)) {
					isInjectionDetected = true;
					injectionType = 'XSS';
					detectedPattern = pattern.source;
					break;
				}
			}
		}
	}

	// ==================== CHECK URL PARAMETERS ====================
	if (!isInjectionDetected && req.params) {
		const paramsString = JSON.stringify(req.params);

		// Check SQL injection (hanya untuk pattern yang benar-benar mencurigakan)
		for (const pattern of sqlInjectionPatterns) {
			// Skip pattern yang terlalu umum untuk URL
			if (pattern.source.includes('--') || pattern.source.includes('#')) {
				continue;
			}

			if (pattern.test(paramsString)) {
				isInjectionDetected = true;
				injectionType = 'SQL Injection';
				detectedPattern = pattern.source;
				break;
			}
		}

		// Check NoSQL injection
		if (!isInjectionDetected) {
			for (const pattern of noSqlInjectionPatterns) {
				if (pattern.test(paramsString)) {
					isInjectionDetected = true;
					injectionType = 'NoSQL Injection';
					detectedPattern = pattern.source;
					break;
				}
			}
		}

		// Check XSS
		if (!isInjectionDetected) {
			for (const pattern of xssPatterns) {
				if (pattern.test(paramsString)) {
					isInjectionDetected = true;
					injectionType = 'XSS';
					detectedPattern = pattern.source;
					break;
				}
			}
		}
	}

	// ==================== CHECK HEADERS ====================
	if (!isInjectionDetected) {
		const headersString = JSON.stringify(req.headers);

		// Check SQL injection (hanya untuk pattern yang benar-benar mencurigakan)
		for (const pattern of sqlInjectionPatterns) {
			// Skip pattern yang terlalu umum
			if (pattern.source.includes('--') || pattern.source.includes('#')) {
				continue;
			}

			if (pattern.test(headersString)) {
				isInjectionDetected = true;
				injectionType = 'SQL Injection';
				detectedPattern = pattern.source;
				break;
			}
		}

		// Check XSS in headers
		if (!isInjectionDetected) {
			for (const pattern of xssPatterns) {
				if (pattern.test(headersString)) {
					isInjectionDetected = true;
					injectionType = 'XSS';
					detectedPattern = pattern.source;
					break;
				}
			}
		}
	}

	// ==================== RESPONSE TO INJECTION ATTEMPT ====================
	if (isInjectionDetected) {
		console.log(
			`🚨 SQL Injection Protection: ${injectionType} attempt detected from IP ${clientIP}`
		);
		console.log(`   Pattern: ${detectedPattern}`);
		console.log(`   Path: ${req.path}`);
		console.log(`   Method: ${req.method}`);
		console.log(`   User-Agent: ${req.get('User-Agent') || 'Unknown'}`);

		// Log detailed injection attempt
		console.log(
			`🚨 ${injectionType} Attempt: ${req.method} ${req.path} from IP ${clientIP}`,
			{
				type: injectionType,
				pattern: detectedPattern,
				path: req.path,
				method: req.method,
				userAgent: req.get('User-Agent'),
				body: req.body ? JSON.stringify(req.body).substring(0, 200) : null,
				query: req.query ? JSON.stringify(req.query).substring(0, 200) : null,
				timestamp: new Date().toISOString(),
			}
		);

		// Return beautiful error response
		return sendBeautifulError(
			res,
			403,
			'Security Violation',
			'Malicious injection attempt detected. This request has been blocked for security reasons.',
			{
				type: injectionType,
				pattern: detectedPattern,
				path: req.path,
				method: req.method,
				ip: clientIP,
			}
		);
	}

	next();
};

// ==================== NOSQL INJECTION PROTECTION MIDDLEWARE ====================
export const noSqlInjectionProtectionMiddleware = (
	req: Request,
	res: Response,
	next: NextFunction
) => {
	// Skip protection untuk frontend files
	if (
		req.path.includes('/src/') ||
		req.path.includes('/@') ||
		req.path.includes('/node_modules/') ||
		req.path.endsWith('.tsx') ||
		req.path.endsWith('.ts') ||
		req.path.endsWith('.js') ||
		req.path.endsWith('.css') ||
		req.path.endsWith('.mjs')
	) {
		return next();
	}

	const clientIP = req.ip || req.connection.remoteAddress || 'unknown';
	let isInjectionDetected = false;
	let detectedPattern = '';

	// Check all request data for NoSQL injection patterns
	const requestData = {
		body: req.body,
		query: req.query,
		params: req.params,
		headers: req.headers,
	};

	const dataString = JSON.stringify(requestData);

	for (const pattern of noSqlInjectionPatterns) {
		if (pattern.test(dataString)) {
			isInjectionDetected = true;
			detectedPattern = pattern.source;
			break;
		}
	}

	if (isInjectionDetected) {
		console.log(
			`🚨 NoSQL Injection Protection: NoSQL injection attempt detected from IP ${clientIP}`
		);
		console.log(`   Pattern: ${detectedPattern}`);
		console.log(`   Path: ${req.path}`);
		console.log(`   Method: ${req.method}`);

		// Log detailed injection attempt
		console.log(
			`🚨 NoSQL Injection Attempt: ${req.method} ${req.path} from IP ${clientIP}`,
			{
				pattern: detectedPattern,
				path: req.path,
				method: req.method,
				userAgent: req.get('User-Agent'),
				timestamp: new Date().toISOString(),
			}
		);

		// Return beautiful error response
		return sendBeautifulError(
			res,
			403,
			'Security Violation',
			'Malicious NoSQL injection attempt detected. This request has been blocked for security reasons.',
			{
				type: 'NoSQL Injection',
				pattern: detectedPattern,
				path: req.path,
				method: req.method,
				ip: clientIP,
			}
		);
	}

	next();
};

import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import hpp from 'hpp';
import { z } from 'zod';

// ==================== RATE LIMITING ====================
export const apiLimiter = rateLimit({
	windowMs: 60 * 1000, // 1 menit
	max: 500, // Maksimal 500 request per IP per menit
	message: {
		error: 'Terlalu banyak request. Silakan coba lagi dalam 1 menit.',
		retryAfter: 60,
	},
	standardHeaders: true,
	legacyHeaders: false,
});

export const loginLimiter = rateLimit({
	windowMs: 60 * 1000, // 1 menit
	max: 5, // Maksimal 5 percobaan login per IP per menit
	message: {
		error: 'Terlalu banyak percobaan login. Silakan coba lagi dalam 1 menit.',
		retryAfter: 60,
	},
	standardHeaders: true,
	legacyHeaders: false,
});

export const uploadLimiter = rateLimit({
	windowMs: 60 * 1000, // 1 menit
	max: 500, // Maksimal 500 upload per IP per menit
	message: {
		error: 'Terlalu banyak upload. Silakan coba lagi dalam 1 menit.',
		retryAfter: 60,
	},
	standardHeaders: true,
	legacyHeaders: false,
});

export const chatLimiter = rateLimit({
	windowMs: 60 * 1000, // 1 menit
	max: 30, // Maksimal 30 pesan per IP per menit
	message: {
		error: 'Terlalu banyak pesan chat. Silakan tunggu sebentar.',
		retryAfter: 60,
	},
	standardHeaders: true,
	legacyHeaders: false,
});

// ==================== INPUT VALIDATION SCHEMAS ====================
export const loginSchema = z.object({
	username: z.string().min(1, 'Username diperlukan'),
	password: z.string().min(1, 'Password diperlukan'),
});

export const uploadSchema = z.object({
	category: z.string().optional(),
	oldFileUrl: z.string().optional(),
});

// ==================== SECURITY MIDDLEWARE ====================
export const securityMiddleware = {
	helmet: helmet({
		contentSecurityPolicy: {
			directives: {
				defaultSrc: ["'self'"],
				styleSrc: ["'self'", "'unsafe-inline'", 'https://cdn.tiny.cloud'],
				scriptSrc: ["'self'", "'unsafe-inline'", 'https://cdn.tiny.cloud'],
				imgSrc: ["'self'", 'data:', 'https:', 'blob:'],
				connectSrc: ["'self'", 'https://cdn.tiny.cloud'],
				fontSrc: ["'self'", 'https://fonts.gstatic.com'],
				objectSrc: ["'none'"],
				mediaSrc: ["'self'"],
				frameSrc: ["'none'"],
			},
		},
		hsts: {
			maxAge: 31536000,
			includeSubDomains: true,
			preload: true,
		},
		noSniff: true,
		referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
	}),

	hpp: hpp(),

	securityErrorHandler: (err: any, req: any, res: any, next: any) => {
		if (err.type === 'entity.too.large') {
			return res.status(413).json({
				error: 'File terlalu besar',
				message: 'Ukuran file melebihi batas maksimal',
			});
		}
		next(err);
	},
};

// ==================== INPUT VALIDATION MIDDLEWARE ====================
export const validateInput = (schema: z.ZodSchema) => {
	return (req: any, res: any, next: any) => {
		try {
			// Skip validation for frontend files
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

			const result = schema.safeParse(req.body);
			if (!result.success) {
				return res.status(400).json({
					error: 'Invalid input',
					details: result.error.errors,
				});
			}
			req.body = result.data;
			next();
		} catch (error) {
			console.error('Validation error:', error);
			res.status(500).json({ error: 'Internal server error' });
		}
	};
};

// ==================== FILE UPLOAD VALIDATION ====================
export const validateFileUpload = (req: any, res: any, next: any) => {
	// Skip validation for frontend files
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

	if (!req.file) {
		return res.status(400).json({ error: 'No file uploaded' });
	}

	// Validate file type
	const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
	if (!allowedTypes.includes(req.file.mimetype)) {
		return res.status(400).json({
			error: 'Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed.',
		});
	}

	// Validate file size (5MB max)
	const maxSize = 5 * 1024 * 1024; // 5MB
	if (req.file.size > maxSize) {
		return res.status(400).json({
			error: 'File too large. Maximum size is 5MB.',
		});
	}

	next();
};

// ==================== INPUT SANITIZATION ====================
export const sanitizeInput = (req: any, res: any, next: any) => {
	// Skip sanitization for frontend files
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

	// Sanitize body
	if (req.body) {
		Object.keys(req.body).forEach((key) => {
			if (typeof req.body[key] === 'string') {
				req.body[key] = req.body[key]
					.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
					.replace(/javascript:/gi, '')
					.replace(/on\w+\s*=/gi, '');
			}
		});
	}

	// Sanitize query parameters
	if (req.query) {
		Object.keys(req.query).forEach((key) => {
			if (typeof req.query[key] === 'string') {
				req.query[key] = req.query[key]
					.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
					.replace(/javascript:/gi, '')
					.replace(/on\w+\s*=/gi, '');
			}
		});
	}

	next();
};

// ==================== SECURITY LOGGING ====================
export const securityLogger = (req: any, res: any, next: any) => {
	// Skip logging for frontend files
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

	const start = Date.now();
	const ip = req.ip || req.connection.remoteAddress;
	const userAgent = req.get('User-Agent') || 'Unknown';

	// Log request
	console.log(
		`✅ ${req.method} ${req.path} - ${res.statusCode} (${
			Date.now() - start
		}ms) - IP: ${ip}`
	);

	// Log suspicious activity
	if (
		req.path.includes('admin') ||
		req.path.includes('login') ||
		req.path.includes('upload')
	) {
		console.log(
			`🔍 Security Check: ${req.method} ${req.path} from IP: ${ip}, User-Agent: ${userAgent}`
		);
	}

	next();
};

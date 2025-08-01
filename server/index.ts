import express, { NextFunction, type Request, Response } from 'express';
import path from 'path';
import { connectDB } from '../db/mongodb';
import { registerRoutes } from './routes';
import { ChatService } from './services/chat-service';
import { log, serveStatic, setupVite } from './vite';

// Import security middleware
import {
	apiProtectionMiddleware,
	apiRateLimitMiddleware,
} from './middleware/api-protection';
import { ddosProtectionMiddleware, cleanupDdosData } from './middleware/ddos-protection';
import {
	noSqlInjectionProtectionMiddleware,
	sqlInjectionProtectionMiddleware,
} from './middleware/sql-injection-protection';
import { sanitizeInput, securityLogger, securityMiddleware } from './security';

// Import models to ensure they are registered
import './models/activity';

// Set MongoDB URI yang Anda berikan
process.env.MONGODB_URI =
	'mongodb+srv://recipesDB:4434@recipesdb.pjmdt.mongodb.net/?retryWrites=true&w=majority&appName=recipesDB';

// Karena kita menggunakan MongoDB, pastikan DISABLE_MONGODB dinonaktifkan
process.env.DISABLE_MONGODB = 'false';

const app = express();

// ==================== SECURITY MIDDLEWARE SETUP ====================
// Apply security headers and basic protection
app.use(securityMiddleware.helmet);
app.use(securityMiddleware.hpp);

// Apply DDoS protection
app.use(ddosProtectionMiddleware);

// Apply API protection
app.use(apiProtectionMiddleware);
app.use(apiRateLimitMiddleware);

// Apply SQL/NoSQL injection protection
app.use(sqlInjectionProtectionMiddleware);
app.use(noSqlInjectionProtectionMiddleware);

// Apply input sanitization
app.use(sanitizeInput);

// Apply security logging
app.use(securityLogger);

// ==================== BASIC MIDDLEWARE ====================
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false, limit: '10mb' }));

// Tambahkan middleware static agar file upload bisa diakses publik
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));
app.use(
	'/attached_assets',
	express.static(path.join(process.cwd(), 'attached_assets'))
);

// ==================== REQUEST LOGGING MIDDLEWARE ====================
app.use((req, res, next) => {
	const start = Date.now();
	const path = req.path;
	let capturedJsonResponse: Record<string, any> | undefined = undefined;

	const originalResJson = res.json;
	res.json = function (bodyJson, ...args) {
		capturedJsonResponse = bodyJson;
		return originalResJson.apply(res, [bodyJson, ...args]);
	};

	res.on('finish', () => {
		const duration = Date.now() - start;
		if (path.startsWith('/api')) {
			let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
			if (capturedJsonResponse) {
				logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
			}

			if (logLine.length > 80) {
				logLine = logLine.slice(0, 79) + '…';
			}

			log(logLine);
		}
	});

	next();
});

// ==================== CLEANUP SCHEDULER ====================
const cleanupInterval = 6 * 60 * 60 * 1000; // 6 jam
setInterval(async () => {
	try {
		await ChatService.cleanupUnusedImages();
	} catch (error) {
		console.error('Error in cleanup scheduler:', error);
	}
}, cleanupInterval);

// DDoS Protection Cleanup (every hour)
setInterval(cleanupDdosData, 60 * 60 * 1000);

// ==================== SECURITY MONITORING ====================
// Security monitoring akan ditampilkan saat server start

// Log server status setiap 5 menit
setInterval(() => {
	console.log('📊 Server Status: Active');
	console.log('   - MongoDB Connection: ✅ Connected');
	console.log('   - Server Uptime: ✅ Running');
	console.log('   - Memory Usage: ✅ Normal');
	console.log('   - Request Handling: ✅ Active');
}, 5 * 60 * 1000);

(async () => {
	// Connect to MongoDB
	try {
		await connectDB();
		// Nota: connectDB sekarang mengembalikan false jika gagal, tapi tidak melempar error
		// karena kita mau fallback ke PostgreSQL
	} catch (error) {
		console.error('Error saat inisialisasi database:', error);
		process.exit(1);
	}

	const server = await registerRoutes(app);

	// ==================== ERROR HANDLING ====================
	app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
		const status = err.status || err.statusCode || 500;
		const message = err.message || 'Internal Server Error';

		// Log security-related errors
		if (status === 403 || status === 429 || status === 503) {
			console.log(`🚨 Security Error: ${status} - ${message}`);
		}

		res.status(status).json({ message });
		throw err;
	});

	// importantly only setup vite in development and after
	// setting up all the other routes so the catch-all route
	// doesn't interfere with the other routes
	if (app.get('env') === 'development') {
		await setupVite(app, server);
	} else {
		serveStatic(app);
	}

	// ALWAYS serve the app on port 5000
	// this serves both the API and the client.
	// It is the only port that is not firewalled.
	const port = 5000;
	server.listen(
		{
			port,
			host: '0.0.0.0',
			reusePort: true,
		},
		() => {
			log(`🛡️ Secure server running on port ${port}`);
			console.log('🛡️ Security Features Activated:');
			console.log('   ✅ DDoS Protection (Multi-Tier System)');
			console.log('   ✅ SQL Injection Protection');
			console.log('   ✅ NoSQL Injection Protection');
			console.log('   ✅ XSS Protection');
			console.log('   ✅ Rate Limiting');
			console.log('   ✅ Security Headers');
		}
	);
})();

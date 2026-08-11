import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { Session } from '../db/mongodb';
import { mongoStorage } from './mongo-storage';

// Define user type for MongoDB
interface UserWithRole {
	_id: string;
	username: string;
	name: string;
	email: string;
	role: string;
	division?: string;
	password?: string;
	createdAt?: Date;
	updatedAt?: Date;
	lastLogin?: Date;
}

// Environment variables with fallbacks
const JWT_SECRET_STRING =
	process.env.JWT_SECRET || 'hmti-secret-key-change-in-production';
const JWT_SECRET_KEY = JWT_SECRET_STRING; // Use string format instead of Buffer
const JWT_EXPIRY = process.env.JWT_EXPIRY || '24h';

export function buildAuthCookieOptions() {
	return {
		httpOnly: true,
		secure: process.env.NODE_ENV === 'production',
		sameSite: 'lax' as const,
		path: '/',
		maxAge: 24 * 60 * 60 * 1000,
	};
}

export function buildClearCookieOptions() {
	const { maxAge: _, ...opts } = buildAuthCookieOptions();
	return opts;
}

// Generate JWT token (optionally tenant-scoped)
export function generateToken(user: UserWithRole, tenantDbName?: string): string {
	const payload: any = {
		id: user._id,
		username: user.username,
		role: user.role,
		tv: (user as any).tokenVersion || 0,
		sid: (user as any).sessionId,
	};
	if (tenantDbName) {
		payload.tenant = tenantDbName;
	}

	// @ts-ignore
	return jwt.sign(payload, JWT_SECRET_KEY, { expiresIn: JWT_EXPIRY });
}

// Verify password
export async function verifyPassword(
	plainPassword: string,
	hashedPassword: string
): Promise<boolean> {
	return await bcrypt.compare(plainPassword, hashedPassword);
}

// Hash password
export async function hashPassword(password: string): Promise<string> {
	const saltRounds = 10;
	return await bcrypt.hash(password, saltRounds);
}

// Authentication middleware (tenant-aware)
export async function authenticate(
	req: Request,
	res: Response,
	next: NextFunction
) {
	try {
		const token = req.cookies?.authToken;

		if (!token) {
			return res.status(401).json({ message: 'Authentication required' });
		}

		// @ts-ignore
		const decoded = jwt.verify(token, JWT_SECRET_KEY) as { id: string } & {
			sid?: string;
			tenant?: string;
		};

		let user: any;
		let SessionModel: any;
		(req as any)._authResolvedFromMainInTenant = false;
		if (req.isTenantRequest && req.tenantModels) {
			const tokenTenant = (decoded as any).tenant || null;
			if (tokenTenant && req.tenantDbName && tokenTenant !== req.tenantDbName) {
				return res.status(401).json({ message: 'Authentication required' });
			}
			user = await req.tenantModels.User.findById(decoded.id).lean();
			SessionModel = req.tenantModels.Session;
			if (!user) {
				return res.status(401).json({ message: 'Authentication required' });
			}
		} else if ((decoded as any).tenant) {
			try {
				const { getTenantModels } = await import('../db/tenant');
				const models = getTenantModels((decoded as any).tenant);
				user = await models.User.findById(decoded.id).lean();
				SessionModel = models.Session;
			} catch {
				return res.status(401).json({ message: 'Authentication required' });
			}
		} else {
			user = await mongoStorage.getUserById(decoded.id);
			const { Session: MainSession } = await import('../db/mongodb');
			SessionModel = MainSession;
		}

		if (!user) {
			return res.status(401).json({ message: 'User not found' });
		}

		const tokenVersionFromDb = (user as any).tokenVersion || 0;
		const tokenVersionFromToken = (decoded as any).tv || 0;
		if (tokenVersionFromDb !== tokenVersionFromToken) {
			return res.status(401).json({ message: 'Session revoked. Please login again.' });
		}

		try {
			if ((decoded as any).sid && SessionModel) {
				const sess: any = await SessionModel.findOne({
					sessionId: (decoded as any).sid,
					userId: (user as any)._id,
				}).lean();
				if (!sess || sess.revokedAt) {
					return res.status(401).json({ message: 'Session revoked. Please login again.' });
				}
				await SessionModel.updateOne(
					{ _id: sess._id },
					{ $set: { lastActive: new Date() } }
				);
			}
		} catch (e) {
			// ignore session update errors
		}

		req.user = user as UserWithRole;
		(req as any)._authTokenTenant = (decoded as any).tenant || null;
		next();
	} catch (error) {
		return res.status(401).json({ message: 'Invalid or expired token' });
	}
}

/**
 * Optional authentication: populates req.user when valid token is present,
 * but does NOT fail when token is missing or invalid (continues without req.user).
 */
export async function authenticateOptional(
	req: Request,
	res: Response,
	next: NextFunction
) {
	try {
		const token = req.cookies?.authToken;
		if (!token) {
			return next();
		}
		// @ts-ignore
		const decoded = jwt.verify(token, JWT_SECRET_KEY) as { id: string } & {
			sid?: string;
			tv?: number;
			tenant?: string;
		};

		let user: any;
		let SessionModel: any;
		if (req.isTenantRequest && req.tenantModels) {
			const tokenTenant = decoded.tenant || null;
			if (tokenTenant && req.tenantDbName && tokenTenant !== req.tenantDbName) {
				return next();
			}
			if (!tokenTenant) {
				return next();
			}
			user = await req.tenantModels.User.findById(decoded.id).lean();
			SessionModel = req.tenantModels.Session;
		} else if (decoded.tenant) {
			const { getTenantModels } = await import('../db/tenant');
			const models = getTenantModels(decoded.tenant);
			user = await models.User.findById(decoded.id).lean();
			SessionModel = models.Session;
		} else {
			user = await mongoStorage.getUserById(decoded.id);
			const { Session: MainSession } = await import('../db/mongodb');
			SessionModel = MainSession;
		}
		if (!user) return next();
		const tokenVersionFromDb = (user as any).tokenVersion || 0;
		const tokenVersionFromToken = decoded.tv || 0;
		if (tokenVersionFromDb !== tokenVersionFromToken) return next();
		try {
			if (decoded.sid && SessionModel) {
				const sess: any = await SessionModel.findOne({
					sessionId: decoded.sid,
					userId: (user as any)._id,
				}).lean();
				if (!sess || sess.revokedAt) return next();
			}
		} catch {
			/* ignore */
		}
		req.user = user as UserWithRole;
		next();
	} catch {
		next();
	}
}

/**
 * Guard middleware that blocks tenant requests from accessing main-only routes.
 */
export function mainOnly(req: Request, res: Response, next: NextFunction) {
	if (req.isTenantRequest) {
		return res.status(403).json({ message: 'Endpoint ini hanya tersedia untuk web utama' });
	}
	next();
}

async function resolveGeoLocation(ip: string): Promise<string> {
	try {
		if (!ip) return '';
		// Prefer ipapi.co; fall back to ipwho.is
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), 2000);
		try {
			const res = await fetch(
				`https://ipapi.co/${encodeURIComponent(ip)}/json/`,
				{ signal: controller.signal }
			);
			clearTimeout(timeout);
			if (res.ok) {
				const data: any = await res.json();
				const city = data?.city || '';
				const region = data?.region || '';
				const country = data?.country_name || data?.country || '';
				const parts = [city, region, country].filter(Boolean);
				return parts.join(', ');
			}
		} catch {}
		// fallback
		const res2 = await fetch(`https://ipwho.is/${encodeURIComponent(ip)}`);
		if (res2.ok) {
			const data2: any = await res2.json();
			const city = data2?.city || '';
			const region = data2?.region || '';
			const country = data2?.country || '';
			const parts = [city, region, country].filter(Boolean);
			return parts.join(', ');
		}
	} catch {}
	return '';
}

// Helper to create a session record and return sessionId.
// Pass tenantSessionModel for tenant-scoped sessions.
export async function createSessionRecord(req: Request, userId: string, tenantSessionModel?: any) {
	const sessionId = crypto.randomUUID();
	try {
		const ua = (req.headers['user-agent'] as string) || '';
		let device = '';
		if (/Mobile|Android|iPhone|iPad/i.test(ua)) device = 'Mobile';
		else if (/Tablet|iPad/i.test(ua)) device = 'Tablet';
		else device = 'Desktop';
		let os = '';
		if (/Windows/i.test(ua)) os = 'Windows';
		else if (/Mac OS X/i.test(ua)) os = 'macOS';
		else if (/Android/i.test(ua)) os = 'Android';
		else if (/iPhone|iPad|iOS/i.test(ua)) os = 'iOS';
		else if (/Linux/i.test(ua)) os = 'Linux';
		let browser = '';
		if (/Chrome\//i.test(ua)) browser = 'Chrome';
		else if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua)) browser = 'Safari';
		else if (/Firefox\//i.test(ua)) browser = 'Firefox';
		else if (/Edg\//i.test(ua)) browser = 'Edge';

		const ip =
			(req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
			req.socket.remoteAddress ||
			'';

		const location = await resolveGeoLocation(ip);
		const Model = tenantSessionModel || Session;
		await new Model({
			userId,
			sessionId,
			userAgent: ua,
			ip,
			device,
			os,
			browser,
			location,
		}).save();
	} catch (e) {
		console.error('Failed to save session record:', e);
	}
	return sessionId;
}

// Authorization middleware for role-based access
export function authorize(allowedRoles: string[]) {
	return (req: Request, res: Response, next: NextFunction) => {
		if (!req.user) {
			return res.status(401).json({ message: 'Authentication required' });
		}

		if (allowedRoles.length > 0 && !allowedRoles.includes(req.user.role)) {
			return res.status(403).json({
				message: 'You do not have permission to access this resource',
			});
		}

		next();
	};
}

// Permission-based authorization middleware (tenant-aware)
export function requirePermission(permission: string) {
	return async (req: Request, res: Response, next: NextFunction) => {
		try {
			if (!req.user) {
				return res.status(401).json({ message: 'Authentication required' });
			}

			let effectivePermissions: string[];
			if (req.isTenantRequest && req.tenantModels) {
				const { createTenantStorage } = await import('./tenant-storage');
				const tenantStorage = createTenantStorage(req.tenantModels);
				effectivePermissions = await tenantStorage.getUserPermissions(String(req.user._id));
			} else {
				effectivePermissions = await mongoStorage.getUserPermissions(String(req.user._id));
			}

			if (!effectivePermissions.includes(permission)) {
				return res.status(403).json({
					message: 'You do not have permission to perform this action',
				});
			}

			next();
		} catch (error) {
			console.error('Permission check error:', error);
			return res.status(500).json({ message: 'Internal server error' });
		}
	};
}

// Check if user can manage roles (only higher level roles can manage lower level roles)
export function canManageRole(userRole: string, targetRole: string): boolean {
	const roleLevels: { [key: string]: number } = {
		owner: 1,
		admin: 2,
		chair: 3,
		vice_chair: 4,
		bph: 5,
		division_head: 6,
	};

	const userLevel = roleLevels[userRole] || 999;
	const targetLevel = roleLevels[targetRole] || 999;

	// User can only manage roles with higher level numbers (lower hierarchy)
	return userLevel < targetLevel;
}

// Type augmentation for Express Request
declare global {
	namespace Express {
		interface Request {
			user?: UserWithRole;
		}
	}
}

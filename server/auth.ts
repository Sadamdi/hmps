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

// Generate JWT token
export function generateToken(user: UserWithRole): string {
	const payload = {
		id: user._id,
		username: user.username,
		role: user.role,
		// Embed token version to support global revoke
		tv: (user as any).tokenVersion || 0,
		// include sessionId if present
		sid: (user as any).sessionId,
	};

	// @ts-ignore - Ignore typings issue with jwt.sign
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

// Authentication middleware
export async function authenticate(
	req: Request,
	res: Response,
	next: NextFunction
) {
	try {
		// Check for JWT token in cookies
		const token = req.cookies?.authToken;

		if (!token) {
			return res.status(401).json({ message: 'Authentication required' });
		}

		// Verify token
		// @ts-ignore
		const decoded = jwt.verify(token, JWT_SECRET_KEY) as { id: string } & {
			sid?: string;
		};

		// Fetch user from database
		const user = await mongoStorage.getUserById(decoded.id);

		if (!user) {
			return res.status(401).json({ message: 'User not found' });
		}

		// Compare tokenVersion to invalidate old tokens
		const tokenVersionFromDb = (user as any).tokenVersion || 0;
		const tokenVersionFromToken = (decoded as any).tv || 0;
		if (tokenVersionFromDb !== tokenVersionFromToken) {
			return res
				.status(401)
				.json({ message: 'Session revoked. Please login again.' });
		}

		// Validate session not revoked + update lastActive
		try {
			if ((decoded as any).sid) {
				const { Session } = await import('../db/mongodb');
				const sess: any = await Session.findOne({
					sessionId: (decoded as any).sid,
					userId: (user as any)._id,
				}).lean();
				if (!sess || sess.revokedAt) {
					return res
						.status(401)
						.json({ message: 'Session revoked. Please login again.' });
				}
				await Session.updateOne(
					{ _id: sess._id },
					{ $set: { lastActive: new Date() } }
				);
			}
		} catch (e) {
			// ignore session update errors
		}

		// Set user in request
		req.user = user as UserWithRole;
		next();
	} catch (error) {
		return res.status(401).json({ message: 'Invalid or expired token' });
	}
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

// Helper to create a session record and return sessionId
export async function createSessionRecord(req: Request, userId: string) {
	const sessionId = crypto.randomUUID();
	try {
		// Basic UA parsing (lightweight)
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
		await new Session({
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

// Permission-based authorization middleware
export function requirePermission(permission: string) {
	return async (req: Request, res: Response, next: NextFunction) => {
		try {
			if (!req.user) {
				return res.status(401).json({ message: 'Authentication required' });
			}

			// Get user's role and check permissions
			const userRole = await mongoStorage.getRoleByName(req.user.role);
			if (!userRole || !userRole.permissions.includes(permission)) {
				console.log(
					`🚫 Permission denied: User ${req.user.username} (${req.user.role}) missing permission: ${permission}`
				);
				console.log(`   User permissions:`, userRole?.permissions || []);
				console.log(`   Required permission: ${permission}`);

				return res.status(403).json({
					message: 'You do not have permission to perform this action',
					debug: {
						userRole: req.user.role,
						requiredPermission: permission,
						userPermissions: userRole?.permissions || [],
						hasPermission: userRole?.permissions?.includes(permission) || false,
					},
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

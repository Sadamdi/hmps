import bcrypt from 'bcryptjs';
import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
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
		const decoded = jwt.verify(token, JWT_SECRET_KEY) as { id: string };

		// Fetch user from database
		const user = await mongoStorage.getUserById(decoded.id);

		if (!user) {
			return res.status(401).json({ message: 'User not found' });
		}

		// Set user in request
		req.user = user as UserWithRole;
		next();
	} catch (error) {
		return res.status(401).json({ message: 'Invalid or expired token' });
	}
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

import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt, { Secret, SignOptions } from 'jsonwebtoken';
import { db } from '@db';
import { users, UserWithRole } from '@shared/schema';
import { eq } from 'drizzle-orm';

// Environment variables with fallbacks
const JWT_SECRET_STRING = process.env.JWT_SECRET || 'hmti-secret-key-change-in-production';
const JWT_SECRET = Buffer.from(JWT_SECRET_STRING, 'utf-8');
const JWT_EXPIRY = process.env.JWT_EXPIRY || '24h';

// Generate JWT token
export function generateToken(user: UserWithRole): string {
  const payload = { 
    id: user.id, 
    username: user.username,
    role: user.role
  };
  
  // @ts-ignore
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRY });
}

// Verify password
export async function verifyPassword(plainPassword: string, hashedPassword: string): Promise<boolean> {
  return await bcrypt.compare(plainPassword, hashedPassword);
}

// Hash password
export async function hashPassword(password: string): Promise<string> {
  const saltRounds = 10;
  return await bcrypt.hash(password, saltRounds);
}

// Authentication middleware
export async function authenticate(req: Request, res: Response, next: NextFunction) {
  try {
    // Check for JWT token in cookies
    const token = req.cookies?.authToken;
    
    if (!token) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    // Verify token
    // @ts-ignore
    const decoded = jwt.verify(token, JWT_SECRET) as { id: number };
    
    // Fetch user from database
    const user = await db.query.users.findFirst({
      where: eq(users.id, decoded.id)
    });

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
      return res.status(403).json({ message: 'You do not have permission to access this resource' });
    }

    next();
  };
}

// Type augmentation for Express Request
declare global {
  namespace Express {
    interface Request {
      user?: UserWithRole;
    }
  }
}

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { prisma } from '../lib/prisma';
import { AppError } from './errorHandler';
import { Role } from '@prisma/client';

export interface JwtPayload {
  userId: string;
  role: Role;
  email: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

// ─────────────────────────────────────────────────────────────
// TOKEN GENERATION
// ─────────────────────────────────────────────────────────────

export function generateAccessToken(payload: JwtPayload): string {
  return jwt.sign(payload, process.env.JWT_ACCESS_SECRET!, {
    expiresIn: (process.env.JWT_ACCESS_EXPIRES_IN as any) || '15m',
  });
}

export function generateRefreshToken(payload: JwtPayload): string {
  return jwt.sign(payload, process.env.JWT_REFRESH_SECRET!, {
    expiresIn: (process.env.JWT_REFRESH_EXPIRES_IN as any) || '7d',
  });
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// ─────────────────────────────────────────────────────────────
// STORE REFRESH TOKEN IN DB
// ─────────────────────────────────────────────────────────────

export async function storeRefreshToken(userId: string, token: string): Promise<void> {
  const tokenHash = hashToken(token);
  const decoded = jwt.decode(token) as { exp: number };
  const expiresAt = new Date(decoded.exp * 1000);

  await prisma.refreshToken.create({
    data: { userId, tokenHash, expiresAt },
  });
}

// ─────────────────────────────────────────────────────────────
// REVOKE REFRESH TOKEN
// ─────────────────────────────────────────────────────────────

export async function revokeRefreshToken(token: string): Promise<void> {
  const tokenHash = hashToken(token);
  await prisma.refreshToken.updateMany({
    where: { tokenHash },
    data: { revoked: true },
  });
}

export async function revokeAllUserTokens(userId: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { userId },
    data: { revoked: true },
  });
}

// ─────────────────────────────────────────────────────────────
// requireAuth MIDDLEWARE
// ─────────────────────────────────────────────────────────────

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return next(new AppError('No access token provided', 'UNAUTHORIZED', 401));
  }

  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET!) as JwtPayload;
    req.user = payload;
    next();
  } catch (err) {
    if ((err as any).name === 'TokenExpiredError') {
      return next(new AppError('Access token expired', 'TOKEN_EXPIRED', 401));
    }
    return next(new AppError('Invalid access token', 'UNAUTHORIZED', 401));
  }
}

// ─────────────────────────────────────────────────────────────
// requireRole MIDDLEWARE
// ─────────────────────────────────────────────────────────────

export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError('Not authenticated', 'UNAUTHORIZED', 401));
    }
    if (!roles.includes(req.user.role)) {
      return next(
        new AppError(
          `Access denied. Required role: ${roles.join(' or ')}`,
          'FORBIDDEN',
          403
        )
      );
    }
    next();
  };
}

// ─────────────────────────────────────────────────────────────
// OPTIONAL AUTH (for public endpoints that can use auth if available)
// ─────────────────────────────────────────────────────────────

export function optionalAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return next();
  }
  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET!) as JwtPayload;
    req.user = payload;
  } catch {
    // Ignore auth errors for optional auth
  }
  next();
}

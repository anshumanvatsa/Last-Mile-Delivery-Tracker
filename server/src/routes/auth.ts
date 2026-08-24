import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import {
  generateAccessToken,
  generateRefreshToken,
  hashToken,
  storeRefreshToken,
  revokeRefreshToken,
  revokeAllUserTokens,
  JwtPayload,
} from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { successResponse } from '../utils/response';

const router = Router();

const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

// ─────────────────────────────────────────────────────────────
// POST /api/auth/register
// ─────────────────────────────────────────────────────────────

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  name: z.string().min(2, 'Name must be at least 2 characters'),
  phone: z.string().optional(),
  role: z.enum(['CUSTOMER', 'AGENT']).default('CUSTOMER'),
});

router.post('/register', async (req, res, next) => {
  try {
    const data = registerSchema.parse(req.body);

    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) {
      throw new AppError('Email already registered', 'EMAIL_TAKEN', 409);
    }

    const passwordHash = await bcrypt.hash(data.password, 10);
    const user = await prisma.user.create({
      data: {
        email: data.email,
        passwordHash,
        name: data.name,
        phone: data.phone,
        role: data.role,
      },
      select: { id: true, email: true, name: true, role: true, phone: true, createdAt: true },
    });

    // If agent, create availability record
    if (data.role === 'AGENT') {
      const firstZone = await prisma.zone.findFirst();
      if (firstZone) {
        await prisma.agentAvailability.create({
          data: { agentId: user.id, currentZoneId: firstZone.id, isAvailable: true },
        });
      }
    }

    const payload: JwtPayload = { userId: user.id, role: user.role, email: user.email };
    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);
    await storeRefreshToken(user.id, refreshToken);

    res.cookie('refreshToken', refreshToken, REFRESH_COOKIE_OPTIONS);
    return successResponse(res, { user, accessToken }, 201);
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────
// POST /api/auth/login
// ─────────────────────────────────────────────────────────────

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

router.post('/login', async (req, res, next) => {
  try {
    const data = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { email: data.email } });
    if (!user) {
      throw new AppError('Invalid email or password', 'INVALID_CREDENTIALS', 401);
    }

    const isValid = await bcrypt.compare(data.password, user.passwordHash);
    if (!isValid) {
      throw new AppError('Invalid email or password', 'INVALID_CREDENTIALS', 401);
    }

    const payload: JwtPayload = { userId: user.id, role: user.role, email: user.email };
    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);
    await storeRefreshToken(user.id, refreshToken);

    res.cookie('refreshToken', refreshToken, REFRESH_COOKIE_OPTIONS);
    return successResponse(res, {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        phone: user.phone,
      },
      accessToken,
    });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────
// POST /api/auth/refresh — Token rotation
// ─────────────────────────────────────────────────────────────

router.post('/refresh', async (req, res, next) => {
  try {
    const token = req.cookies?.refreshToken;
    if (!token) {
      throw new AppError('No refresh token provided', 'UNAUTHORIZED', 401);
    }

    // Verify JWT signature
    let decoded: JwtPayload;
    try {
      decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET!) as JwtPayload;
    } catch {
      throw new AppError('Invalid or expired refresh token', 'UNAUTHORIZED', 401);
    }

    // Check DB — must exist and not be revoked
    const tokenHash = hashToken(token);
    const stored = await prisma.refreshToken.findUnique({ where: { tokenHash } });

    if (!stored || stored.revoked || stored.expiresAt < new Date()) {
      // Token reuse detected or expired — revoke all user tokens (security)
      await revokeAllUserTokens(decoded.userId);
      res.clearCookie('refreshToken');
      throw new AppError('Refresh token revoked or expired. Please log in again.', 'UNAUTHORIZED', 401);
    }

    // Rotate: revoke old, issue new
    await revokeRefreshToken(token);

    const newAccessToken = generateAccessToken(decoded);
    const newRefreshToken = generateRefreshToken(decoded);
    await storeRefreshToken(decoded.userId, newRefreshToken);

    res.cookie('refreshToken', newRefreshToken, REFRESH_COOKIE_OPTIONS);
    return successResponse(res, { accessToken: newAccessToken });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────
// POST /api/auth/logout
// ─────────────────────────────────────────────────────────────

router.post('/logout', async (req, res, next) => {
  try {
    const token = req.cookies?.refreshToken;
    if (token) {
      await revokeRefreshToken(token);
    }
    res.clearCookie('refreshToken');
    return successResponse(res, { message: 'Logged out successfully' });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────
// GET /api/auth/me
// ─────────────────────────────────────────────────────────────

import { requireAuth } from '../middleware/auth';

router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { id: true, email: true, name: true, role: true, phone: true, createdAt: true },
    });
    if (!user) throw new AppError('User not found', 'NOT_FOUND', 404);
    return successResponse(res, { user });
  } catch (err) {
    next(err);
  }
});

export default router;

import { Router } from 'express';
import { z } from 'zod';
import { OrderType, Role } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { requireAuth, requireRole } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { successResponse } from '../utils/response';
import { cacheDelete, cacheGet, cacheSet, CacheKeys, getCacheStats } from '../lib/redis';

const router = Router();

const rateCardSchema = z.object({
  name: z.string().min(2),
  orderType: z.enum(['B2B', 'B2C']),
  fromZoneId: z.string(),
  toZoneId: z.string(),
  isIntraZone: z.boolean(),
  baseRatePerKg: z.number().positive(),
  codSurchargePercent: z.number().min(0).max(100),
  effectiveFrom: z.string().transform((s) => new Date(s)),
});

// ─────────────────────────────────────────────────────────────
// GET /api/rate-cards
// ─────────────────────────────────────────────────────────────

router.get('/', requireAuth, requireRole(Role.ADMIN), async (req, res, next) => {
  try {
    const { orderType } = req.query;

    // Cache the full list (invalidated on any write)
    const cacheKey = CacheKeys.allRateCards();
    const cached = await cacheGet<any[]>(cacheKey);
    if (cached && !orderType) {
      return successResponse(res, { rateCards: cached, _cached: true });
    }

    const where: any = {};
    if (orderType) where.orderType = orderType;

    const rateCards = await prisma.rateCard.findMany({
      where,
      include: {
        fromZone: { select: { name: true } },
        toZone: { select: { name: true } },
      },
      orderBy: [{ orderType: 'asc' }, { fromZone: { name: 'asc' } }, { toZone: { name: 'asc' } }, { effectiveFrom: 'desc' }],
    });

    // Cache the list (only when not filtered)
    if (!orderType) await cacheSet(cacheKey, rateCards, 3600);

    return successResponse(res, { rateCards, _cached: false });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────
// POST /api/rate-cards — Create
// ─────────────────────────────────────────────────────────────

router.post('/', requireAuth, requireRole(Role.ADMIN), async (req, res, next) => {
  try {
    const data = rateCardSchema.parse(req.body);

    const existing = await prisma.rateCard.findFirst({
      where: {
        fromZoneId: data.fromZoneId,
        toZoneId: data.toZoneId,
        orderType: data.orderType as OrderType,
        isIntraZone: data.isIntraZone,
        effectiveFrom: data.effectiveFrom,
      },
    });

    if (existing) {
      throw new AppError(
        `A rate card already exists for this zone pair, order type, and effective date. To update rates, create a new card with a later effective date, or update the existing one.`,
        'RATE_CARD_DUPLICATE',
        409
      );
    }

    const rateCard = await prisma.rateCard.create({
      data: {
        name: data.name,
        orderType: data.orderType as OrderType,
        fromZoneId: data.fromZoneId,
        toZoneId: data.toZoneId,
        isIntraZone: data.isIntraZone,
        baseRatePerKg: data.baseRatePerKg,
        codSurchargePercent: data.codSurchargePercent,
        effectiveFrom: data.effectiveFrom,
      },
      include: {
        fromZone: { select: { name: true } },
        toZone: { select: { name: true } },
      },
    });

    // Invalidate all rate card cache entries
    await cacheDelete(CacheKeys.rateCardPattern());
    console.log('[REDIS] Rate card cache invalidated after CREATE');

    return successResponse(res, { rateCard }, 201);
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────
// PUT /api/rate-cards/:id — Update
// ─────────────────────────────────────────────────────────────

router.put('/:id', requireAuth, requireRole(Role.ADMIN), async (req, res, next) => {
  try {
    const data = rateCardSchema.partial().parse(req.body);

    const existing = await prisma.rateCard.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new AppError('Rate card not found', 'NOT_FOUND', 404);

    const newFromZoneId = data.fromZoneId || existing.fromZoneId;
    const newToZoneId = data.toZoneId || existing.toZoneId;
    const newOrderType = (data.orderType || existing.orderType) as OrderType;
    const newIsIntraZone = data.isIntraZone !== undefined ? data.isIntraZone : existing.isIntraZone;
    const newEffectiveFrom = data.effectiveFrom || existing.effectiveFrom;

    const duplicate = await prisma.rateCard.findFirst({
      where: {
        id: { not: req.params.id },
        fromZoneId: newFromZoneId,
        toZoneId: newToZoneId,
        orderType: newOrderType,
        isIntraZone: newIsIntraZone,
        effectiveFrom: newEffectiveFrom,
      },
    });

    if (duplicate) {
      throw new AppError('A rate card with these parameters already exists', 'RATE_CARD_DUPLICATE', 409);
    }

    const rateCard = await prisma.rateCard.update({
      where: { id: req.params.id },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.orderType && { orderType: data.orderType as OrderType }),
        ...(data.fromZoneId && { fromZoneId: data.fromZoneId }),
        ...(data.toZoneId && { toZoneId: data.toZoneId }),
        ...(data.isIntraZone !== undefined && { isIntraZone: data.isIntraZone }),
        ...(data.baseRatePerKg && { baseRatePerKg: data.baseRatePerKg }),
        ...(data.codSurchargePercent !== undefined && { codSurchargePercent: data.codSurchargePercent }),
        ...(data.effectiveFrom && { effectiveFrom: data.effectiveFrom }),
      },
      include: {
        fromZone: { select: { name: true } },
        toZone: { select: { name: true } },
      },
    });

    // Invalidate all rate card cache entries
    await cacheDelete(CacheKeys.rateCardPattern());
    console.log('[REDIS] Rate card cache invalidated after UPDATE');

    return successResponse(res, { rateCard });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────
// DELETE /api/rate-cards/:id
// ─────────────────────────────────────────────────────────────

router.delete('/:id', requireAuth, requireRole(Role.ADMIN), async (req, res, next) => {
  try {
    await prisma.rateCard.delete({ where: { id: req.params.id } });

    // Invalidate all rate card cache entries
    await cacheDelete(CacheKeys.rateCardPattern());
    console.log('[REDIS] Rate card cache invalidated after DELETE');

    return successResponse(res, { message: 'Rate card deleted' });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────
// GET /api/rate-cards/cache-stats — Cache metrics
// ─────────────────────────────────────────────────────────────

router.get('/cache-stats', requireAuth, requireRole(Role.ADMIN), async (_req, res) => {
  const stats = getCacheStats();
  return successResponse(res, {
    cache: stats,
    summary: `Redis cache hit rate: ${stats.hitRatePercent}% (${stats.hits} hits, ${stats.misses} misses out of ${stats.total} lookups)`,
  });
});

export default router;

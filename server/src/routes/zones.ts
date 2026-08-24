import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireAuth, requireRole } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { successResponse } from '../utils/response';
import { Role } from '@prisma/client';

const router = Router();

// ─────────────────────────────────────────────────────────────
// GET /api/zones — List all zones with area counts
// ─────────────────────────────────────────────────────────────

router.get('/', async (req, res, next) => {
  try {
    const zones = await prisma.zone.findMany({
      include: {
        areas: true,
        _count: { select: { ordersPickup: true, agentsInZone: true } },
      },
      orderBy: { name: 'asc' },
    });
    return successResponse(res, { zones });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────
// GET /api/zones/detect?area=<string> — Zone detection via ILIKE
// ─────────────────────────────────────────────────────────────

router.get('/detect', async (req, res, next) => {
  try {
    const area = req.query.area as string;
    if (!area || area.trim().length < 2) {
      throw new AppError('Query param "area" must be at least 2 characters', 'VALIDATION_ERROR', 400);
    }

    // Case-insensitive partial match on area_name using ILIKE
    const matches = await prisma.zoneArea.findMany({
      where: {
        areaName: { contains: area.trim(), mode: 'insensitive' },
      },
      include: {
        zone: { select: { id: true, name: true, description: true, latitude: true, longitude: true } },
      },
      take: 5,
    });

    if (matches.length === 0) {
      return successResponse(res, {
        detected: false,
        zone: null,
        message: `No zone found for area "${area}". Check spelling or try a partial name.`,
        suggestions: [],
      });
    }

    // De-duplicate by zone (multiple areas can match in the same zone)
    const uniqueZones = Array.from(
      new Map(matches.map((m) => [m.zone.id, { ...m.zone, matchedArea: m.areaName }])).values()
    );

    return successResponse(res, {
      detected: true,
      zone: uniqueZones[0], // Primary match
      allMatches: uniqueZones,
      confidence: uniqueZones.length === 1 ? 'HIGH' : 'MULTIPLE_MATCHES',
    });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────
// POST /api/zones — Create zone (ADMIN only)
// ─────────────────────────────────────────────────────────────

const createZoneSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

router.post('/', requireAuth, requireRole(Role.ADMIN), async (req, res, next) => {
  try {
    const data = createZoneSchema.parse(req.body);
    const zone = await prisma.zone.create({ data });
    return successResponse(res, { zone }, 201);
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────
// GET /api/zones/:id — Zone detail
// ─────────────────────────────────────────────────────────────

router.get('/:id', async (req, res, next) => {
  try {
    const zone = await prisma.zone.findUnique({
      where: { id: req.params.id },
      include: { areas: true },
    });
    if (!zone) throw new AppError('Zone not found', 'NOT_FOUND', 404);
    return successResponse(res, { zone });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────
// POST /api/zones/:id/areas — Add area to zone (ADMIN only)
// ─────────────────────────────────────────────────────────────

const addAreaSchema = z.object({
  areaName: z.string().min(2, 'Area name must be at least 2 characters'),
});

router.post('/:id/areas', requireAuth, requireRole(Role.ADMIN), async (req, res, next) => {
  try {
    const { areaName } = addAreaSchema.parse(req.body);

    const zone = await prisma.zone.findUnique({ where: { id: req.params.id } });
    if (!zone) throw new AppError('Zone not found', 'NOT_FOUND', 404);

    // Check for duplicate area name in this zone
    const existing = await prisma.zoneArea.findFirst({
      where: { zoneId: req.params.id, areaName: { equals: areaName, mode: 'insensitive' } },
    });
    if (existing) {
      throw new AppError(`Area "${areaName}" already exists in ${zone.name}`, 'CONFLICT', 409);
    }

    const area = await prisma.zoneArea.create({
      data: { zoneId: req.params.id, areaName },
    });

    return successResponse(res, { area }, 201);
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────
// DELETE /api/zones/:id/areas/:areaId — Remove area (ADMIN only)
// ─────────────────────────────────────────────────────────────

router.delete('/:id/areas/:areaId', requireAuth, requireRole(Role.ADMIN), async (req, res, next) => {
  try {
    await prisma.zoneArea.delete({ where: { id: req.params.areaId } });
    return successResponse(res, { message: 'Area removed successfully' });
  } catch (err) {
    next(err);
  }
});

export default router;

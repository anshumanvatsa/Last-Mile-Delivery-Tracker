import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import { Role } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { requireAuth, requireRole } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { successResponse } from '../utils/response';

const router = Router();

// ─────────────────────────────────────────────────────────────
// GET /api/agents — List agents with availability + today's stats
// ─────────────────────────────────────────────────────────────

router.get('/', requireAuth, requireRole(Role.ADMIN), async (req, res, next) => {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const agents = await prisma.user.findMany({
      where: { role: Role.AGENT },
      include: {
        agentAvailability: {
          include: { currentZone: { select: { name: true } } },
        },
        ordersAsAgent: {
          where: {
            status: { in: ['DELIVERED', 'PENDING', 'PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY'] },
          },
          select: { id: true, status: true, trackingNumber: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    // Count orders delivered today per agent
    const deliveredToday = await prisma.order.groupBy({
      by: ['assignedAgentId'],
      where: {
        status: 'DELIVERED',
        updatedAt: { gte: todayStart, lte: todayEnd },
        assignedAgentId: { not: null },
      },
      _count: true,
    });

    const deliveredMap = new Map(
      deliveredToday.map((d) => [d.assignedAgentId, d._count])
    );

    const agentsWithStats = agents.map((agent) => ({
      ...agent,
      deliveredToday: deliveredMap.get(agent.id) || 0,
      activeOrders: agent.ordersAsAgent.filter((o) =>
        ['PENDING', 'PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY'].includes(o.status)
      ).length,
    }));

    return successResponse(res, { agents: agentsWithStats });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────
// POST /api/agents — Create agent account (ADMIN only)
// ─────────────────────────────────────────────────────────────

const createAgentSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(2),
  phone: z.string().optional(),
  currentZoneId: z.string(),
});

router.post('/', requireAuth, requireRole(Role.ADMIN), async (req, res, next) => {
  try {
    const data = createAgentSchema.parse(req.body);

    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) throw new AppError('Email already registered', 'EMAIL_TAKEN', 409);

    const zone = await prisma.zone.findUnique({ where: { id: data.currentZoneId } });
    if (!zone) throw new AppError('Zone not found', 'NOT_FOUND', 404);

    const passwordHash = await bcrypt.hash(data.password, 10);

    const agent = await prisma.user.create({
      data: {
        email: data.email,
        passwordHash,
        name: data.name,
        phone: data.phone,
        role: Role.AGENT,
        agentAvailability: {
          create: {
            currentZoneId: data.currentZoneId,
            isAvailable: true,
          },
        },
      },
      include: {
        agentAvailability: { include: { currentZone: { select: { name: true } } } },
      },
    });

    return successResponse(res, { agent }, 201);
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────
// PATCH /api/agents/:id/availability — Toggle availability / update zone
// ─────────────────────────────────────────────────────────────

const availabilitySchema = z.object({
  isAvailable: z.boolean().optional(),
  currentZoneId: z.string().optional(),
});

router.patch('/:id/availability', requireAuth, requireRole(Role.ADMIN), async (req, res, next) => {
  try {
    const data = availabilitySchema.parse(req.body);

    const availability = await prisma.agentAvailability.upsert({
      where: { agentId: req.params.id },
      update: {
        ...(data.isAvailable !== undefined && { isAvailable: data.isAvailable }),
        ...(data.currentZoneId && { currentZoneId: data.currentZoneId }),
        lastUpdated: new Date(),
      },
      create: {
        agentId: req.params.id,
        currentZoneId: data.currentZoneId || (await prisma.zone.findFirst())!.id,
        isAvailable: data.isAvailable ?? true,
      },
      include: { currentZone: { select: { name: true } } },
    });

    return successResponse(res, { availability });
  } catch (err) {
    next(err);
  }
});

export default router;

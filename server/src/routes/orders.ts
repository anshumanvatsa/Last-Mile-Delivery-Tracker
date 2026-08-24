import { Router } from 'express';
import { z } from 'zod';
import { OrderType, PaymentType, OrderStatus, Role } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { requireAuth, requireRole } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { successResponse } from '../utils/response';
import { calculateCharge } from '../services/rateEngine';
import { generateTrackingNumber } from '../services/trackingNumber';
import { assignNearestAgent, manualAssignAgent } from '../services/autoAssign';
import { updateOrderStatus } from '../services/orderLifecycle';
import { rescheduleDelivery } from '../services/rescheduleService';

const router = Router();

// ─────────────────────────────────────────────────────────────
// POST /api/orders/calculate-charge — PUBLIC (no auth required)
// ─────────────────────────────────────────────────────────────

const calculateSchema = z.object({
  pickupZoneId: z.string(),
  dropZoneId: z.string(),
  lengthCm: z.number().positive(),
  breadthCm: z.number().positive(),
  heightCm: z.number().positive(),
  actualWeightKg: z.number().positive(),
  orderType: z.enum(['B2B', 'B2C']),
  paymentType: z.enum(['PREPAID', 'COD']),
});

router.post('/calculate-charge', async (req, res, next) => {
  try {
    const params = calculateSchema.parse(req.body);
    const breakdown = await calculateCharge({
      ...params,
      orderType: params.orderType as OrderType,
      paymentType: params.paymentType as PaymentType,
    });
    return successResponse(res, breakdown);
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────
// GET /api/orders/track/:trackingNumber — PUBLIC
// ─────────────────────────────────────────────────────────────

router.get('/track/:trackingNumber', async (req, res, next) => {
  try {
    const order = await prisma.order.findUnique({
      where: { trackingNumber: req.params.trackingNumber },
      include: {
        customer: { select: { name: true } },
        pickupZone: { select: { name: true } },
        dropZone: { select: { name: true } },
        assignedAgent: { select: { name: true } },
        trackingEvents: {
          orderBy: { createdAt: 'asc' },
          include: { actor: { select: { name: true } } },
        },
      },
    });

    if (!order) {
      throw new AppError('Order not found', 'NOT_FOUND', 404);
    }

    return successResponse(res, { order });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────
// POST /api/orders — Create order (CUSTOMER or ADMIN)
// ─────────────────────────────────────────────────────────────

const createOrderSchema = z.object({
  pickupAddress: z.string().min(5),
  dropAddress: z.string().min(5),
  pickupZoneId: z.string(),
  dropZoneId: z.string(),
  lengthCm: z.number().positive(),
  breadthCm: z.number().positive(),
  heightCm: z.number().positive(),
  actualWeightKg: z.number().positive(),
  orderType: z.enum(['B2B', 'B2C']),
  paymentType: z.enum(['PREPAID', 'COD']),
  customerId: z.string().optional(), // admin can create on behalf of customer
});

router.post('/', requireAuth, async (req, res, next) => {
  try {
    const data = createOrderSchema.parse(req.body);
    const user = req.user!;

    // Determine customer
    let customerId = user.userId;
    let createdByAdminId: string | undefined;

    if (user.role === Role.ADMIN && data.customerId) {
      customerId = data.customerId;
      createdByAdminId = user.userId;
    } else if (user.role === Role.CUSTOMER) {
      customerId = user.userId;
    }

    const breakdown = await calculateCharge({
      pickupZoneId: data.pickupZoneId,
      dropZoneId: data.dropZoneId,
      lengthCm: data.lengthCm,
      breadthCm: data.breadthCm,
      heightCm: data.heightCm,
      actualWeightKg: data.actualWeightKg,
      orderType: data.orderType as OrderType,
      paymentType: data.paymentType as PaymentType,
    });

    const trackingNumber = await generateTrackingNumber();

    const order = await prisma.order.create({
      data: {
        trackingNumber,
        customerId,
        createdByAdminId,
        pickupAddress: data.pickupAddress,
        dropAddress: data.dropAddress,
        pickupZoneId: data.pickupZoneId,
        dropZoneId: data.dropZoneId,
        lengthCm: data.lengthCm,
        breadthCm: data.breadthCm,
        heightCm: data.heightCm,
        actualWeightKg: data.actualWeightKg,
        volumetricWeightKg: breakdown.volumetricWeightKg,
        billableWeightKg: breakdown.billableWeightKg,
        orderType: data.orderType as OrderType,
        paymentType: data.paymentType as PaymentType,
        rateCardId: breakdown.rateCardId,
        baseRatePerKg: breakdown.baseRatePerKg,
        charge: breakdown.baseCharge,
        codSurcharge: breakdown.codSurcharge,
        totalCharge: breakdown.totalCharge,
        status: OrderStatus.PENDING,
        trackingEvents: {
          create: {
            status: OrderStatus.PENDING,
            actorId: user.userId,
            actorRole: user.role,
            note: createdByAdminId ? `Order created by admin on behalf of customer` : 'Order placed',
          },
        },
      },
      include: {
        pickupZone: { select: { name: true } },
        dropZone: { select: { name: true } },
        trackingEvents: true,
      },
    });

    return successResponse(res, { order, chargeBreakdown: breakdown }, 201);
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────
// GET /api/orders — List orders (admin: all with filters, customer: own)
// ─────────────────────────────────────────────────────────────

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const user = req.user!;
    const {
      status, pickupZoneId, dropZoneId, agentId,
      dateFrom, dateTo, page = '1', limit = '20',
    } = req.query as Record<string, string>;

    const pageNum = parseInt(page);
    const limitNum = Math.min(parseInt(limit), 100);
    const skip = (pageNum - 1) * limitNum;

    const where: any = {};

    // Customers only see their own orders
    if (user.role === Role.CUSTOMER) {
      where.customerId = user.userId;
    } else if (user.role === Role.AGENT) {
      where.assignedAgentId = user.userId;
    }

    // Admin filters
    if (status) where.status = status;
    if (pickupZoneId) where.pickupZoneId = pickupZoneId;
    if (dropZoneId) where.dropZoneId = dropZoneId;
    if (agentId) where.assignedAgentId = agentId;
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) where.createdAt.lte = new Date(dateTo);
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { createdAt: 'desc' },
        include: {
          customer: { select: { name: true, email: true } },
          assignedAgent: { select: { name: true } },
          pickupZone: { select: { name: true } },
          dropZone: { select: { name: true } },
          _count: { select: { trackingEvents: true } },
        },
      }),
      prisma.order.count({ where }),
    ]);

    return successResponse(res, {
      orders,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────
// GET /api/orders/:id — Order detail with tracking timeline
// ─────────────────────────────────────────────────────────────

router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const user = req.user!;
    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: {
        customer: { select: { name: true, email: true, phone: true } },
        assignedAgent: { select: { name: true, email: true, phone: true } },
        pickupZone: { select: { name: true, latitude: true, longitude: true } },
        dropZone: { select: { name: true, latitude: true, longitude: true } },
        trackingEvents: {
          orderBy: { createdAt: 'asc' },
          include: { actor: { select: { name: true } } },
        },
        reschedules: { orderBy: { createdAt: 'desc' } },
      },
    });

    if (!order) throw new AppError('Order not found', 'NOT_FOUND', 404);

    // Role-based access
    if (user.role === Role.CUSTOMER && order.customerId !== user.userId) {
      throw new AppError('Access denied', 'FORBIDDEN', 403);
    }
    if (user.role === Role.AGENT && order.assignedAgentId !== user.userId) {
      throw new AppError('Access denied', 'FORBIDDEN', 403);
    }

    return successResponse(res, { order });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────
// PATCH /api/orders/:id/status — Update status (AGENT or ADMIN)
// ─────────────────────────────────────────────────────────────

const updateStatusSchema = z.object({
  status: z.enum(['PENDING', 'PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'FAILED']),
  note: z.string().optional(),
});

router.patch('/:id/status', requireAuth, requireRole(Role.AGENT, Role.ADMIN), async (req, res, next) => {
  try {
    const data = updateStatusSchema.parse(req.body);
    await updateOrderStatus({
      orderId: req.params.id,
      newStatus: data.status as OrderStatus,
      actorId: req.user!.userId,
      actorRole: req.user!.role,
      note: data.note,
    });

    const updated = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: { trackingEvents: { orderBy: { createdAt: 'asc' } } },
    });

    return successResponse(res, { order: updated });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────
// POST /api/orders/:id/auto-assign — ADMIN only
// ─────────────────────────────────────────────────────────────

router.post('/:id/auto-assign', requireAuth, requireRole(Role.ADMIN), async (req, res, next) => {
  try {
    const result = await assignNearestAgent(req.params.id, req.user!.userId);
    return successResponse(res, { assignedAgent: result });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────
// POST /api/orders/:id/assign — Manual assign, ADMIN only
// ─────────────────────────────────────────────────────────────

const assignSchema = z.object({ agentId: z.string() });

router.post('/:id/assign', requireAuth, requireRole(Role.ADMIN), async (req, res, next) => {
  try {
    const { agentId } = assignSchema.parse(req.body);
    await manualAssignAgent(req.params.id, agentId, req.user!.userId);
    return successResponse(res, { message: 'Agent assigned successfully' });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────
// POST /api/orders/:id/reschedule — CUSTOMER or ADMIN
// ─────────────────────────────────────────────────────────────

const rescheduleSchema = z.object({
  newDate: z.string().transform((s) => new Date(s)),
  reason: z.string().min(5, 'Please provide a reason (min 5 characters)'),
});

router.post('/:id/reschedule', requireAuth, async (req, res, next) => {
  try {
    const data = rescheduleSchema.parse(req.body);

    // Customers can only reschedule their own orders
    const order = await prisma.order.findUnique({ where: { id: req.params.id } });
    if (!order) throw new AppError('Order not found', 'NOT_FOUND', 404);

    if (req.user!.role === Role.CUSTOMER && order.customerId !== req.user!.userId) {
      throw new AppError('Access denied', 'FORBIDDEN', 403);
    }

    const result = await rescheduleDelivery({
      orderId: req.params.id,
      newDate: data.newDate,
      reason: data.reason,
      userId: req.user!.userId,
    });

    return successResponse(res, result);
  } catch (err) {
    next(err);
  }
});

export default router;

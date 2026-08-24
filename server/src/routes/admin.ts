import { Router } from 'express';
import { OrderStatus, Role } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { requireAuth, requireRole } from '../middleware/auth';
import { successResponse } from '../utils/response';

const router = Router();

// ─────────────────────────────────────────────────────────────
// GET /api/admin/stats — Dashboard statistics
// ─────────────────────────────────────────────────────────────

router.get('/stats', requireAuth, requireRole(Role.ADMIN), async (req, res, next) => {
  try {
    const now = new Date();

    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);

    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - 7);

    const monthStart = new Date(now);
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    // Run all stats queries in parallel
    const [
      totalOrders,
      ordersByStatus,
      todayOrders,
      todayRevenue,
      weekRevenue,
      monthRevenue,
      agentsAvailable,
      agentsBusy,
      failedUnrescheduled,
      revenueByDay,
    ] = await Promise.all([
      // Total orders
      prisma.order.count(),

      // Orders by status
      prisma.order.groupBy({ by: ['status'], _count: true }),

      // Today's orders
      prisma.order.count({ where: { createdAt: { gte: todayStart, lte: todayEnd } } }),

      // Today's revenue (from delivered orders)
      prisma.order.aggregate({
        where: { status: OrderStatus.DELIVERED, updatedAt: { gte: todayStart, lte: todayEnd } },
        _sum: { totalCharge: true },
      }),

      // Week's revenue
      prisma.order.aggregate({
        where: { status: OrderStatus.DELIVERED, updatedAt: { gte: weekStart } },
        _sum: { totalCharge: true },
      }),

      // Month's revenue
      prisma.order.aggregate({
        where: { status: OrderStatus.DELIVERED, updatedAt: { gte: monthStart } },
        _sum: { totalCharge: true },
      }),

      // Available agents
      prisma.agentAvailability.count({ where: { isAvailable: true } }),

      // Busy agents
      prisma.agentAvailability.count({ where: { isAvailable: false } }),

      // Revenue at risk: FAILED orders not yet rescheduled (no future reschedule)
      prisma.order.aggregate({
        where: {
          status: OrderStatus.FAILED,
          reschedules: { none: { newDate: { gte: new Date() } } },
        },
        _sum: { totalCharge: true },
        _count: true,
      }),

      // Revenue per day for last 7 days (for chart)
      prisma.$queryRaw<Array<{ date: string; revenue: number; orders: number }>>`
        SELECT
          DATE(created_at) as date,
          SUM(total_charge)::float as revenue,
          COUNT(*)::int as orders
        FROM orders
        WHERE created_at >= ${weekStart}
        GROUP BY DATE(created_at)
        ORDER BY date ASC
      `,
    ]);

    const statusMap = Object.fromEntries(
      Object.values(OrderStatus).map((s) => [s, 0])
    );
    ordersByStatus.forEach((row) => {
      statusMap[row.status] = row._count;
    });

    return successResponse(res, {
      totalOrders,
      ordersByStatus: statusMap,
      today: {
        orders: todayOrders,
        revenue: Number(todayRevenue._sum.totalCharge || 0),
      },
      week: {
        revenue: Number(weekRevenue._sum.totalCharge || 0),
      },
      month: {
        revenue: Number(monthRevenue._sum.totalCharge || 0),
      },
      agents: {
        available: agentsAvailable,
        busy: agentsBusy,
        total: agentsAvailable + agentsBusy,
      },
      revenueAtRisk: {
        amount: Number(failedUnrescheduled._sum.totalCharge || 0),
        orderCount: failedUnrescheduled._count,
      },
      revenueByDay,
    });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────
// GET /api/admin/orders/map — Order + agent data for map view
// ─────────────────────────────────────────────────────────────

router.get('/map-data', requireAuth, requireRole(Role.ADMIN), async (req, res, next) => {
  try {
    const [activeOrders, agents] = await Promise.all([
      prisma.order.findMany({
        where: {
          status: {
            notIn: [OrderStatus.DELIVERED, OrderStatus.FAILED],
          },
        },
        include: {
          customer: { select: { name: true } },
          assignedAgent: { select: { name: true } },
          pickupZone: { select: { name: true, latitude: true, longitude: true } },
          dropZone: { select: { name: true, latitude: true, longitude: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
      prisma.agentAvailability.findMany({
        include: {
          agent: { select: { id: true, name: true } },
          currentZone: { select: { name: true, latitude: true, longitude: true } },
        },
      }),
    ]);

    return successResponse(res, { activeOrders, agents });
  } catch (err) {
    next(err);
  }
});

export default router;

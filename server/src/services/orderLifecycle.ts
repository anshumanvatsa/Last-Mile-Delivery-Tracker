import { OrderStatus, Role } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';
import { sendStatusEmail } from './emailService';

// Valid status transitions
const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.PENDING]: [OrderStatus.PICKED_UP],
  [OrderStatus.PICKED_UP]: [OrderStatus.IN_TRANSIT],
  [OrderStatus.IN_TRANSIT]: [OrderStatus.OUT_FOR_DELIVERY],
  [OrderStatus.OUT_FOR_DELIVERY]: [OrderStatus.DELIVERED, OrderStatus.FAILED],
  [OrderStatus.DELIVERED]: [], // Terminal
  [OrderStatus.FAILED]: [],   // Terminal (use reschedule to restart)
};

export interface UpdateStatusParams {
  orderId: string;
  newStatus: OrderStatus;
  actorId: string;
  actorRole: string;
  note?: string;
}

/**
 * Updates order status with validation, immutable event logging,
 * agent auto-release on terminal statuses, and email notification.
 */
export async function updateOrderStatus(params: UpdateStatusParams): Promise<void> {
  const { orderId, newStatus, actorId, actorRole, note } = params;

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      customer: { select: { email: true, name: true } },
      assignedAgent: { select: { id: true, name: true } },
    },
  });

  if (!order) {
    throw new AppError('Order not found', 'NOT_FOUND', 404);
  }

  // Validate status transition
  const allowed = ALLOWED_TRANSITIONS[order.status];
  if (!allowed.includes(newStatus)) {
    throw new AppError(
      `Cannot transition from ${order.status} to ${newStatus}. Allowed: ${allowed.join(', ') || 'none (terminal state)'}`,
      'INVALID_TRANSITION',
      400
    );
  }

  // Check role permissions for status update
  if (actorRole === Role.AGENT) {
    // Agents can only update their assigned orders
    if (order.assignedAgentId !== actorId) {
      throw new AppError('You can only update status for orders assigned to you', 'FORBIDDEN', 403);
    }
  }

  const isTerminal = newStatus === OrderStatus.DELIVERED || newStatus === OrderStatus.FAILED;

  // Build transaction operations
  const ops: Parameters<typeof prisma.$transaction>[0] = [
    // 1. Update order status
    prisma.order.update({
      where: { id: orderId },
      data: {
        status: newStatus,
        updatedAt: new Date(),
      },
    }),
    // 2. Append tracking event (IMMUTABLE — never updated/deleted)
    prisma.orderTrackingEvent.create({
      data: {
        orderId,
        status: newStatus,
        actorId,
        actorRole,
        note: note || null,
      },
    }),
  ];

  // 3. Auto-release agent on terminal status (DELIVERED or FAILED)
  if (isTerminal && order.assignedAgentId) {
    ops.push(
      prisma.agentAvailability.updateMany({
        where: { agentId: order.assignedAgentId },
        data: { isAvailable: true, lastUpdated: new Date() },
      }) as any
    );
  }

  await prisma.$transaction(ops as any);

  // 4. Send email notification (async, non-blocking — failures are logged not thrown)
  if (order.customer.email) {
    sendStatusEmail({
      to: order.customer.email,
      customerName: order.customer.name,
      trackingNumber: order.trackingNumber,
      status: newStatus,
      note,
    }).catch((err) => {
      console.error('[EMAIL] Unexpected error in sendStatusEmail:', err);
    });
  }
}

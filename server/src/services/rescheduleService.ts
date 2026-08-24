import { OrderStatus } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';
import { assignNearestAgent } from './autoAssign';
import { sendStatusEmail } from './emailService';

export interface RescheduleParams {
  orderId: string;
  newDate: Date;
  reason: string;
  userId: string;
}

/**
 * Reschedules a failed delivery.
 *
 * Idempotency Guard: Rejects if a pending reschedule already exists for this order.
 *
 * Flow:
 * 1. Verify order is in FAILED status
 * 2. Check for existing pending reschedule (idempotency)
 * 3. Validate new date is in the future
 * 4. Create delivery_reschedule record
 * 5. Update order: status → PENDING, scheduled_delivery_date → newDate
 * 6. Append tracking event
 * 7. Run auto-assign to get a new agent
 * 8. Send confirmation email
 */
export async function rescheduleDelivery(params: RescheduleParams) {
  const { orderId, newDate, reason, userId } = params;

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      customer: { select: { email: true, name: true } },
      reschedules: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  });

  if (!order) {
    throw new AppError('Order not found', 'NOT_FOUND', 404);
  }

  // Guard 1: Only FAILED orders can be rescheduled
  if (order.status !== OrderStatus.FAILED) {
    throw new AppError(
      `Only failed deliveries can be rescheduled. Current status: ${order.status}`,
      'INVALID_OPERATION',
      400
    );
  }

  // Guard 2: Idempotency — reject if already has a pending/future reschedule
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const existingReschedule = order.reschedules.find(
    (r) => new Date(r.newDate) >= today
  );

  if (existingReschedule) {
    throw new AppError(
      `This order already has a pending reschedule for ${new Date(existingReschedule.newDate).toLocaleDateString('en-IN')}. Cancel it first before rescheduling again.`,
      'RESCHEDULE_ALREADY_PENDING',
      409
    );
  }

  // Guard 3: New date must be tomorrow or later
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);

  if (newDate < tomorrow) {
    throw new AppError(
      'Scheduled delivery date must be at least tomorrow',
      'INVALID_DATE',
      400
    );
  }

  const originalDate = order.scheduledDeliveryDate || new Date();
  const formattedDate = newDate.toLocaleDateString('en-IN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  // Transaction: create reschedule, reset order, append event
  await prisma.$transaction([
    prisma.deliveryReschedule.create({
      data: {
        orderId,
        originalDate,
        newDate,
        reason,
        requestedBy: userId,
      },
    }),
    prisma.order.update({
      where: { id: orderId },
      data: {
        status: OrderStatus.PENDING,
        scheduledDeliveryDate: newDate,
        updatedAt: new Date(),
      },
    }),
    prisma.orderTrackingEvent.create({
      data: {
        orderId,
        status: OrderStatus.PENDING,
        actorId: userId,
        actorRole: 'CUSTOMER',
        note: `Delivery rescheduled to ${formattedDate} — Reason: ${reason}`,
      },
    }),
  ]);

  // Auto-assign a new agent (separate from transaction — can fail without rollback)
  let assignedAgent = null;
  try {
    assignedAgent = await assignNearestAgent(orderId, undefined);
  } catch (err) {
    console.warn('[RESCHEDULE] Auto-assign failed, admin must assign manually:', err);
  }

  // Send confirmation email
  if (order.customer.email) {
    sendStatusEmail({
      to: order.customer.email,
      customerName: order.customer.name,
      trackingNumber: order.trackingNumber,
      status: 'PENDING',
      note: `Your delivery has been rescheduled for ${formattedDate}`,
      scheduledDate: formattedDate,
    }).catch((err) => console.error('[EMAIL] Reschedule email failed:', err));
  }

  return {
    newDate,
    formattedDate,
    assignedAgent,
  };
}

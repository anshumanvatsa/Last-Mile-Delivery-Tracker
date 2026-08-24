import { OrderStatus } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';

/**
 * Auto-assigns the nearest available agent to an order.
 *
 * Algorithm:
 * 1. Get the order's pickup_zone_id
 * 2. Find available agents in the same zone (zone-first matching)
 * 3. If no zone match, fall back to any available agent system-wide
 * 4. If still none, throw error (admin must manually assign)
 * 5. Assign agent, mark as unavailable, insert tracking event
 *
 * Note: In production, this would use PostGIS + haversine distance
 * to find the geographically nearest agent. The zone-based approach
 * is documented as an MVP decision in SYSTEM_DESIGN.md.
 */
export async function assignNearestAgent(orderId: string, actorId?: string): Promise<{
  agentId: string;
  agentName: string;
  agentEmail: string;
}> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { pickupZoneId: true, status: true, assignedAgentId: true },
  });

  if (!order) {
    throw new AppError('Order not found', 'NOT_FOUND', 404);
  }

  // Step 1: Zone-first — find available agent in same pickup zone
  let availability = await prisma.agentAvailability.findFirst({
    where: {
      currentZoneId: order.pickupZoneId,
      isAvailable: true,
    },
    include: { agent: true },
    orderBy: { lastUpdated: 'asc' }, // FIFO: agents who have been available longest
  });

  // Step 2: Fallback — any available agent
  if (!availability) {
    availability = await prisma.agentAvailability.findFirst({
      where: { isAvailable: true },
      include: { agent: true },
      orderBy: { lastUpdated: 'asc' },
    });
  }

  // Step 3: No agent available
  if (!availability) {
    throw new AppError(
      'No agents available — admin must assign manually',
      'NO_AGENT_AVAILABLE',
      409
    );
  }

  const agent = availability.agent;

  // Step 4: Transaction — assign agent + mark unavailable + insert event
  await prisma.$transaction([
    prisma.order.update({
      where: { id: orderId },
      data: { assignedAgentId: agent.id },
    }),
    prisma.agentAvailability.update({
      where: { agentId: agent.id },
      data: { isAvailable: false, lastUpdated: new Date() },
    }),
    prisma.orderTrackingEvent.create({
      data: {
        orderId,
        status: OrderStatus.PENDING,
        actorId: actorId || null,
        actorRole: actorId ? 'ADMIN' : 'SYSTEM',
        note: `Agent assigned: ${agent.name} (${availability.currentZoneId === order.pickupZoneId ? 'zone match' : 'fallback assignment'})`,
      },
    }),
  ]);

  return {
    agentId: agent.id,
    agentName: agent.name,
    agentEmail: agent.email,
  };
}

/**
 * Manually assigns a specific agent to an order (admin override).
 */
export async function manualAssignAgent(
  orderId: string,
  agentId: string,
  adminId: string
): Promise<void> {
  const [order, agent, agentAvail] = await Promise.all([
    prisma.order.findUnique({ where: { id: orderId } }),
    prisma.user.findUnique({ where: { id: agentId }, select: { id: true, name: true, role: true } }),
    prisma.agentAvailability.findUnique({ where: { agentId } }),
  ]);

  if (!order) throw new AppError('Order not found', 'NOT_FOUND', 404);
  if (!agent || agent.role !== 'AGENT') throw new AppError('Agent not found', 'NOT_FOUND', 404);

  // Release previous agent if any
  if (order.assignedAgentId && order.assignedAgentId !== agentId) {
    await prisma.agentAvailability.updateMany({
      where: { agentId: order.assignedAgentId },
      data: { isAvailable: true, lastUpdated: new Date() },
    });
  }

  await prisma.$transaction([
    prisma.order.update({
      where: { id: orderId },
      data: { assignedAgentId: agentId },
    }),
    prisma.agentAvailability.upsert({
      where: { agentId },
      update: { isAvailable: false, lastUpdated: new Date() },
      create: {
        agentId,
        currentZoneId: order.pickupZoneId,
        isAvailable: false,
      },
    }),
    prisma.orderTrackingEvent.create({
      data: {
        orderId,
        status: order.status,
        actorId: adminId,
        actorRole: 'ADMIN',
        note: `Agent manually assigned: ${agent.name}`,
      },
    }),
  ]);
}

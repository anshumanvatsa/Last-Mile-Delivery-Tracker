import { PrismaClient, Role, OrderType, PaymentType, OrderStatus } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting seed...');

  // ─────────────────────────────────────────────────────────────
  // CLEANUP
  // ─────────────────────────────────────────────────────────────
  await prisma.orderTrackingEvent.deleteMany();
  await prisma.deliveryReschedule.deleteMany();
  await prisma.agentAvailability.deleteMany();
  await prisma.order.deleteMany();
  await prisma.rateCard.deleteMany();
  await prisma.zoneArea.deleteMany();
  await prisma.zone.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.user.deleteMany();
  console.log('✓ Cleaned existing data');

  // ─────────────────────────────────────────────────────────────
  // ZONES (with real Indian city centroids)
  // ─────────────────────────────────────────────────────────────
  const zones = await Promise.all([
    prisma.zone.create({
      data: {
        name: 'North Zone',
        description: 'Delhi NCR region — major metro hub',
        latitude: 28.7041,
        longitude: 77.1025,
      },
    }),
    prisma.zone.create({
      data: {
        name: 'South Zone',
        description: 'Bangalore region — tech corridor',
        latitude: 12.9716,
        longitude: 77.5946,
      },
    }),
    prisma.zone.create({
      data: {
        name: 'East Zone',
        description: 'Kolkata region — eastern gateway',
        latitude: 22.5726,
        longitude: 88.3639,
      },
    }),
    prisma.zone.create({
      data: {
        name: 'West Zone',
        description: 'Mumbai region — financial capital',
        latitude: 19.076,
        longitude: 72.8777,
      },
    }),
  ]);
  const [northZone, southZone, eastZone, westZone] = zones;
  console.log('✓ Created 4 zones');

  // ─────────────────────────────────────────────────────────────
  // ZONE AREAS
  // ─────────────────────────────────────────────────────────────
  await prisma.zoneArea.createMany({
    data: [
      // North Zone (Delhi NCR)
      { zoneId: northZone.id, areaName: 'Connaught Place' },
      { zoneId: northZone.id, areaName: 'Karol Bagh' },
      { zoneId: northZone.id, areaName: 'Rohini' },
      { zoneId: northZone.id, areaName: 'Dwarka' },
      { zoneId: northZone.id, areaName: 'Lajpat Nagar' },
      { zoneId: northZone.id, areaName: '110001' },
      { zoneId: northZone.id, areaName: '110005' },
      // South Zone (Bangalore)
      { zoneId: southZone.id, areaName: 'Koramangala' },
      { zoneId: southZone.id, areaName: 'Indiranagar' },
      { zoneId: southZone.id, areaName: 'Whitefield' },
      { zoneId: southZone.id, areaName: 'Jayanagar' },
      { zoneId: southZone.id, areaName: 'Electronic City' },
      { zoneId: southZone.id, areaName: '560034' },
      { zoneId: southZone.id, areaName: '560008' },
      // East Zone (Kolkata)
      { zoneId: eastZone.id, areaName: 'Salt Lake' },
      { zoneId: eastZone.id, areaName: 'Park Street' },
      { zoneId: eastZone.id, areaName: 'Howrah' },
      { zoneId: eastZone.id, areaName: 'New Town' },
      { zoneId: eastZone.id, areaName: 'Dum Dum' },
      { zoneId: eastZone.id, areaName: '700091' },
      { zoneId: eastZone.id, areaName: '700016' },
      // West Zone (Mumbai)
      { zoneId: westZone.id, areaName: 'Andheri' },
      { zoneId: westZone.id, areaName: 'Bandra' },
      { zoneId: westZone.id, areaName: 'Powai' },
      { zoneId: westZone.id, areaName: 'Juhu' },
      { zoneId: westZone.id, areaName: 'Dadar' },
      { zoneId: westZone.id, areaName: '400069' },
      { zoneId: westZone.id, areaName: '400050' },
    ],
  });
  console.log('✓ Created zone areas');

  // ─────────────────────────────────────────────────────────────
  // RATE CARDS (B2B + B2C for all zone pairs)
  // ─────────────────────────────────────────────────────────────
  const effectiveFrom = new Date('2024-01-01');
  const allZones = [northZone, southZone, eastZone, westZone];
  const rateCardData = [];

  const b2cRates: Record<string, number> = {
    'intra': 35,
    'north-south': 55, 'north-east': 50, 'north-west': 60,
    'south-north': 55, 'south-east': 65, 'south-west': 45,
    'east-north': 50, 'east-south': 65, 'east-west': 70,
    'west-north': 60, 'west-south': 45, 'west-east': 70,
  };

  const b2bRates: Record<string, number> = {
    'intra': 25,
    'north-south': 40, 'north-east': 35, 'north-west': 45,
    'south-north': 40, 'south-east': 50, 'south-west': 30,
    'east-north': 35, 'east-south': 50, 'east-west': 55,
    'west-north': 45, 'west-south': 30, 'west-east': 55,
  };

  const zoneKeyMap: Record<string, string> = {
    [northZone.id]: 'north',
    [southZone.id]: 'south',
    [eastZone.id]: 'east',
    [westZone.id]: 'west',
  };

  for (const fromZone of allZones) {
    for (const toZone of allZones) {
      const isIntraZone = fromZone.id === toZone.id;
      const fromKey = zoneKeyMap[fromZone.id];
      const toKey = zoneKeyMap[toZone.id];
      const pairKey = isIntraZone ? 'intra' : `${fromKey}-${toKey}`;

      const b2cRate = b2cRates[pairKey] ?? 60;
      const b2bRate = b2bRates[pairKey] ?? 45;

      // B2C Rate Card
      rateCardData.push({
        name: `B2C ${fromZone.name} → ${toZone.name}`,
        orderType: OrderType.B2C,
        fromZoneId: fromZone.id,
        toZoneId: toZone.id,
        isIntraZone,
        baseRatePerKg: b2cRate,
        codSurchargePercent: 2.0, // 2% for B2C
        effectiveFrom,
      });

      // B2B Rate Card
      rateCardData.push({
        name: `B2B ${fromZone.name} → ${toZone.name}`,
        orderType: OrderType.B2B,
        fromZoneId: fromZone.id,
        toZoneId: toZone.id,
        isIntraZone,
        baseRatePerKg: b2bRate,
        codSurchargePercent: 1.5, // 1.5% for B2B
        effectiveFrom,
      });
    }
  }

  await prisma.rateCard.createMany({ data: rateCardData });
  console.log(`✓ Created ${rateCardData.length} rate cards`);

  // ─────────────────────────────────────────────────────────────
  // USERS
  // ─────────────────────────────────────────────────────────────
  const passwordHash = await bcrypt.hash('Test@1234', 10);

  const admin = await prisma.user.create({
    data: {
      email: 'admin@lastmile.com',
      passwordHash,
      name: 'Super Admin',
      role: Role.ADMIN,
      phone: '+91-9000000001',
    },
  });

  const [agent1, agent2, agent3] = await Promise.all([
    prisma.user.create({
      data: {
        email: 'agent1@lastmile.com',
        passwordHash,
        name: 'Ravi Kumar',
        role: Role.AGENT,
        phone: '+91-9000000002',
      },
    }),
    prisma.user.create({
      data: {
        email: 'agent2@lastmile.com',
        passwordHash,
        name: 'Suresh Patel',
        role: Role.AGENT,
        phone: '+91-9000000003',
      },
    }),
    prisma.user.create({
      data: {
        email: 'agent3@lastmile.com',
        passwordHash,
        name: 'Amit Singh',
        role: Role.AGENT,
        phone: '+91-9000000004',
      },
    }),
  ]);

  const [customer1, customer2, customer3, customer4, customer5] = await Promise.all([
    prisma.user.create({
      data: {
        email: 'customer1@lastmile.com',
        passwordHash,
        name: 'Priya Sharma',
        role: Role.CUSTOMER,
        phone: '+91-9100000001',
      },
    }),
    prisma.user.create({
      data: {
        email: 'customer2@lastmile.com',
        passwordHash,
        name: 'Vikram Mehta',
        role: Role.CUSTOMER,
        phone: '+91-9100000002',
      },
    }),
    prisma.user.create({
      data: {
        email: 'customer3@lastmile.com',
        passwordHash,
        name: 'Ananya Iyer',
        role: Role.CUSTOMER,
        phone: '+91-9100000003',
      },
    }),
    prisma.user.create({
      data: {
        email: 'customer4@lastmile.com',
        passwordHash,
        name: 'Rohan Gupta',
        role: Role.CUSTOMER,
        phone: '+91-9100000004',
      },
    }),
    prisma.user.create({
      data: {
        email: 'customer5@lastmile.com',
        passwordHash,
        name: 'Neha Joshi',
        role: Role.CUSTOMER,
        phone: '+91-9100000005',
      },
    }),
  ]);
  console.log('✓ Created 9 users (1 admin, 3 agents, 5 customers)');

  // ─────────────────────────────────────────────────────────────
  // AGENT AVAILABILITY
  // ─────────────────────────────────────────────────────────────
  await prisma.agentAvailability.createMany({
    data: [
      { agentId: agent1.id, currentZoneId: northZone.id, isAvailable: true },
      { agentId: agent2.id, currentZoneId: southZone.id, isAvailable: false }, // busy
      { agentId: agent3.id, currentZoneId: westZone.id, isAvailable: true },
    ],
  });
  console.log('✓ Created agent availability');

  // ─────────────────────────────────────────────────────────────
  // HELPER: Generate tracking number
  // ─────────────────────────────────────────────────────────────
  let trackingCounter = 0;
  function generateTrackingNumber(date: Date = new Date()): string {
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    const suffix = String(trackingCounter++).padStart(5, '0').replace(/\d/g, (d) =>
      'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'[parseInt(d) * 3 % 36]
    );
    return `LMD-${dateStr}-${suffix.substring(0, 5).toUpperCase()}`;
  }

  // ─────────────────────────────────────────────────────────────
  // ORDERS (15 orders across all statuses)
  // ─────────────────────────────────────────────────────────────
  const now = new Date();
  const daysAgo = (n: number) => new Date(now.getTime() - n * 24 * 60 * 60 * 1000);

  // Helper to calculate charge
  function calcCharge(
    actualKg: number, l: number, b: number, h: number,
    ratePerKg: number, paymentType: PaymentType, codPercent: number
  ) {
    const volKg = (l * b * h) / 5000;
    const billableRaw = Math.max(actualKg, volKg);
    const billableKg = Math.ceil(billableRaw * 2) / 2;
    const baseCharge = billableKg * ratePerKg;
    const codSurcharge = paymentType === PaymentType.COD ? baseCharge * (codPercent / 100) : 0;
    const totalCharge = baseCharge + codSurcharge;
    return {
      volumetricWeightKg: Math.round(volKg * 1000) / 1000,
      billableWeightKg: billableKg,
      charge: Math.round(baseCharge * 100) / 100,
      codSurcharge: Math.round(codSurcharge * 100) / 100,
      totalCharge: Math.round(totalCharge * 100) / 100,
    };
  }

  // Fetch rate cards for reference
  const northSouthB2C = await prisma.rateCard.findFirst({
    where: { fromZoneId: northZone.id, toZoneId: southZone.id, orderType: OrderType.B2C },
  });
  const westNorthB2C = await prisma.rateCard.findFirst({
    where: { fromZoneId: westZone.id, toZoneId: northZone.id, orderType: OrderType.B2C },
  });
  const southEastB2B = await prisma.rateCard.findFirst({
    where: { fromZoneId: southZone.id, toZoneId: eastZone.id, orderType: OrderType.B2B },
  });
  const northIntraB2C = await prisma.rateCard.findFirst({
    where: { fromZoneId: northZone.id, toZoneId: northZone.id, orderType: OrderType.B2C },
  });
  const westSouthB2C = await prisma.rateCard.findFirst({
    where: { fromZoneId: westZone.id, toZoneId: southZone.id, orderType: OrderType.B2C },
  });

  // Order 1: DELIVERED (North → South, B2C, COD) — customer1, agent1
  const o1Charges = calcCharge(1.2, 30, 20, 15, 55, PaymentType.COD, 2.0);
  const order1 = await prisma.order.create({
    data: {
      trackingNumber: `LMD-${daysAgo(7).toISOString().slice(0,10).replace(/-/g,'')}-AB1CD`,
      customerId: customer1.id,
      pickupAddress: 'Karol Bagh Market, New Delhi, 110005',
      dropAddress: 'Koramangala 5th Block, Bangalore, 560095',
      pickupZoneId: northZone.id,
      dropZoneId: southZone.id,
      lengthCm: 30, breadthCm: 20, heightCm: 15,
      actualWeightKg: 1.2,
      volumetricWeightKg: o1Charges.volumetricWeightKg,
      billableWeightKg: o1Charges.billableWeightKg,
      orderType: OrderType.B2C,
      paymentType: PaymentType.COD,
      rateCardId: northSouthB2C?.id,
      baseRatePerKg: 55,
      charge: o1Charges.charge,
      codSurcharge: o1Charges.codSurcharge,
      totalCharge: o1Charges.totalCharge,
      status: OrderStatus.DELIVERED,
      assignedAgentId: agent1.id,
      createdAt: daysAgo(7),
      updatedAt: daysAgo(1),
    },
  });
  await prisma.orderTrackingEvent.createMany({
    data: [
      { orderId: order1.id, status: OrderStatus.PENDING, actorId: customer1.id, actorRole: 'CUSTOMER', note: 'Order placed', createdAt: daysAgo(7) },
      { orderId: order1.id, status: OrderStatus.PENDING, actorId: admin.id, actorRole: 'ADMIN', note: `Agent assigned: ${agent1.name}`, createdAt: daysAgo(6) },
      { orderId: order1.id, status: OrderStatus.PICKED_UP, actorId: agent1.id, actorRole: 'AGENT', note: 'Package picked up from sender', createdAt: daysAgo(6) },
      { orderId: order1.id, status: OrderStatus.IN_TRANSIT, actorId: agent1.id, actorRole: 'AGENT', note: 'In transit to destination hub', createdAt: daysAgo(5) },
      { orderId: order1.id, status: OrderStatus.OUT_FOR_DELIVERY, actorId: agent1.id, actorRole: 'AGENT', note: 'Out for delivery', createdAt: daysAgo(1) },
      { orderId: order1.id, status: OrderStatus.DELIVERED, actorId: agent1.id, actorRole: 'AGENT', note: 'Delivered successfully. Received by: Priya Sharma', createdAt: daysAgo(1) },
    ],
  });

  // Order 2: DELIVERED (West → North, B2C, PREPAID) — customer2, agent3
  const o2Charges = calcCharge(2.5, 40, 30, 20, 60, PaymentType.PREPAID, 2.0);
  const order2 = await prisma.order.create({
    data: {
      trackingNumber: `LMD-${daysAgo(5).toISOString().slice(0,10).replace(/-/g,'')}-BC2DE`,
      customerId: customer2.id,
      pickupAddress: 'Bandra West, Mumbai, 400050',
      dropAddress: 'Connaught Place, New Delhi, 110001',
      pickupZoneId: westZone.id,
      dropZoneId: northZone.id,
      lengthCm: 40, breadthCm: 30, heightCm: 20,
      actualWeightKg: 2.5,
      volumetricWeightKg: o2Charges.volumetricWeightKg,
      billableWeightKg: o2Charges.billableWeightKg,
      orderType: OrderType.B2C,
      paymentType: PaymentType.PREPAID,
      rateCardId: westNorthB2C?.id,
      baseRatePerKg: 60,
      charge: o2Charges.charge,
      codSurcharge: 0,
      totalCharge: o2Charges.totalCharge,
      status: OrderStatus.DELIVERED,
      assignedAgentId: agent3.id,
      createdAt: daysAgo(5),
      updatedAt: daysAgo(1),
    },
  });
  await prisma.orderTrackingEvent.createMany({
    data: [
      { orderId: order2.id, status: OrderStatus.PENDING, actorId: customer2.id, actorRole: 'CUSTOMER', note: 'Order placed', createdAt: daysAgo(5) },
      { orderId: order2.id, status: OrderStatus.PICKED_UP, actorId: agent3.id, actorRole: 'AGENT', note: 'Picked up from Bandra hub', createdAt: daysAgo(4) },
      { orderId: order2.id, status: OrderStatus.IN_TRANSIT, actorId: agent3.id, actorRole: 'AGENT', note: 'Departed Mumbai hub', createdAt: daysAgo(3) },
      { orderId: order2.id, status: OrderStatus.OUT_FOR_DELIVERY, actorId: agent3.id, actorRole: 'AGENT', note: 'Out for delivery in Delhi', createdAt: daysAgo(1) },
      { orderId: order2.id, status: OrderStatus.DELIVERED, actorId: agent3.id, actorRole: 'AGENT', note: 'Delivered. Signed by: Vikram Mehta', createdAt: daysAgo(1) },
    ],
  });

  // Order 3: DELIVERED (South → East, B2B, PREPAID) — customer3, agent2
  const o3Charges = calcCharge(5.0, 50, 40, 30, 50, PaymentType.PREPAID, 1.5);
  const order3 = await prisma.order.create({
    data: {
      trackingNumber: `LMD-${daysAgo(4).toISOString().slice(0,10).replace(/-/g,'')}-CD3EF`,
      customerId: customer3.id,
      pickupAddress: 'Indiranagar 100 Feet Road, Bangalore, 560038',
      dropAddress: 'Salt Lake Sector V, Kolkata, 700091',
      pickupZoneId: southZone.id,
      dropZoneId: eastZone.id,
      lengthCm: 50, breadthCm: 40, heightCm: 30,
      actualWeightKg: 5.0,
      volumetricWeightKg: o3Charges.volumetricWeightKg,
      billableWeightKg: o3Charges.billableWeightKg,
      orderType: OrderType.B2B,
      paymentType: PaymentType.PREPAID,
      rateCardId: southEastB2B?.id,
      baseRatePerKg: 50,
      charge: o3Charges.charge,
      codSurcharge: 0,
      totalCharge: o3Charges.totalCharge,
      status: OrderStatus.DELIVERED,
      assignedAgentId: agent2.id,
      createdAt: daysAgo(4),
      updatedAt: daysAgo(0),
    },
  });
  await prisma.orderTrackingEvent.createMany({
    data: [
      { orderId: order3.id, status: OrderStatus.PENDING, actorId: customer3.id, actorRole: 'CUSTOMER', note: 'B2B order placed', createdAt: daysAgo(4) },
      { orderId: order3.id, status: OrderStatus.PICKED_UP, actorId: agent2.id, actorRole: 'AGENT', note: 'Picked from warehouse', createdAt: daysAgo(3) },
      { orderId: order3.id, status: OrderStatus.IN_TRANSIT, actorId: agent2.id, actorRole: 'AGENT', note: 'In transit via Chennai hub', createdAt: daysAgo(2) },
      { orderId: order3.id, status: OrderStatus.OUT_FOR_DELIVERY, actorId: agent2.id, actorRole: 'AGENT', note: 'Out for delivery', createdAt: daysAgo(0) },
      { orderId: order3.id, status: OrderStatus.DELIVERED, actorId: agent2.id, actorRole: 'AGENT', note: 'Delivered to office reception', createdAt: daysAgo(0) },
    ],
  });

  // Order 4: IN_TRANSIT (North → North intra, B2C, COD) — customer4, agent1
  const o4Charges = calcCharge(0.8, 20, 15, 10, 35, PaymentType.COD, 2.0);
  const order4 = await prisma.order.create({
    data: {
      trackingNumber: `LMD-${daysAgo(3).toISOString().slice(0,10).replace(/-/g,'')}-DE4FG`,
      customerId: customer4.id,
      pickupAddress: 'Rohini Sector 10, New Delhi, 110085',
      dropAddress: 'Lajpat Nagar Market, New Delhi, 110024',
      pickupZoneId: northZone.id,
      dropZoneId: northZone.id,
      lengthCm: 20, breadthCm: 15, heightCm: 10,
      actualWeightKg: 0.8,
      volumetricWeightKg: o4Charges.volumetricWeightKg,
      billableWeightKg: o4Charges.billableWeightKg,
      orderType: OrderType.B2C,
      paymentType: PaymentType.COD,
      rateCardId: northIntraB2C?.id,
      baseRatePerKg: 35,
      charge: o4Charges.charge,
      codSurcharge: o4Charges.codSurcharge,
      totalCharge: o4Charges.totalCharge,
      status: OrderStatus.IN_TRANSIT,
      assignedAgentId: agent1.id,
      createdAt: daysAgo(3),
      updatedAt: daysAgo(1),
    },
  });
  await prisma.orderTrackingEvent.createMany({
    data: [
      { orderId: order4.id, status: OrderStatus.PENDING, actorId: customer4.id, actorRole: 'CUSTOMER', note: 'Order placed', createdAt: daysAgo(3) },
      { orderId: order4.id, status: OrderStatus.PICKED_UP, actorId: agent1.id, actorRole: 'AGENT', note: 'Package collected', createdAt: daysAgo(2) },
      { orderId: order4.id, status: OrderStatus.IN_TRANSIT, actorId: agent1.id, actorRole: 'AGENT', note: 'Moving to delivery hub', createdAt: daysAgo(1) },
    ],
  });

  // Order 5: IN_TRANSIT (West → South, B2C, PREPAID) — customer5, agent3
  const o5Charges = calcCharge(3.0, 35, 25, 20, 45, PaymentType.PREPAID, 2.0);
  const order5 = await prisma.order.create({
    data: {
      trackingNumber: `LMD-${daysAgo(2).toISOString().slice(0,10).replace(/-/g,'')}-EF5GH`,
      customerId: customer5.id,
      pickupAddress: 'Andheri East, Mumbai, 400069',
      dropAddress: 'Jayanagar 4th Block, Bangalore, 560011',
      pickupZoneId: westZone.id,
      dropZoneId: southZone.id,
      lengthCm: 35, breadthCm: 25, heightCm: 20,
      actualWeightKg: 3.0,
      volumetricWeightKg: o5Charges.volumetricWeightKg,
      billableWeightKg: o5Charges.billableWeightKg,
      orderType: OrderType.B2C,
      paymentType: PaymentType.PREPAID,
      rateCardId: westSouthB2C?.id,
      baseRatePerKg: 45,
      charge: o5Charges.charge,
      codSurcharge: 0,
      totalCharge: o5Charges.totalCharge,
      status: OrderStatus.IN_TRANSIT,
      assignedAgentId: agent3.id,
      createdAt: daysAgo(2),
      updatedAt: daysAgo(1),
    },
  });
  await prisma.orderTrackingEvent.createMany({
    data: [
      { orderId: order5.id, status: OrderStatus.PENDING, actorId: customer5.id, actorRole: 'CUSTOMER', note: 'Order placed', createdAt: daysAgo(2) },
      { orderId: order5.id, status: OrderStatus.PICKED_UP, actorId: agent3.id, actorRole: 'AGENT', note: 'Picked from Andheri hub', createdAt: daysAgo(1) },
      { orderId: order5.id, status: OrderStatus.IN_TRANSIT, actorId: agent3.id, actorRole: 'AGENT', note: 'In transit', createdAt: daysAgo(1) },
    ],
  });

  // Order 6: IN_TRANSIT — customer1, agent2
  const o6Charges = calcCharge(1.5, 25, 20, 15, 55, PaymentType.COD, 2.0);
  const order6 = await prisma.order.create({
    data: {
      trackingNumber: `LMD-${daysAgo(2).toISOString().slice(0,10).replace(/-/g,'')}-FG6HI`,
      customerId: customer1.id,
      pickupAddress: 'Dwarka Sector 7, New Delhi, 110075',
      dropAddress: 'Whitefield ITPL Road, Bangalore, 560066',
      pickupZoneId: northZone.id,
      dropZoneId: southZone.id,
      lengthCm: 25, breadthCm: 20, heightCm: 15,
      actualWeightKg: 1.5,
      volumetricWeightKg: o6Charges.volumetricWeightKg,
      billableWeightKg: o6Charges.billableWeightKg,
      orderType: OrderType.B2C,
      paymentType: PaymentType.COD,
      rateCardId: northSouthB2C?.id,
      baseRatePerKg: 55,
      charge: o6Charges.charge,
      codSurcharge: o6Charges.codSurcharge,
      totalCharge: o6Charges.totalCharge,
      status: OrderStatus.IN_TRANSIT,
      assignedAgentId: agent2.id,
      createdAt: daysAgo(2),
      updatedAt: daysAgo(1),
    },
  });
  await prisma.orderTrackingEvent.createMany({
    data: [
      { orderId: order6.id, status: OrderStatus.PENDING, actorId: customer1.id, actorRole: 'CUSTOMER', note: 'Order placed', createdAt: daysAgo(2) },
      { orderId: order6.id, status: OrderStatus.PICKED_UP, actorId: agent2.id, actorRole: 'AGENT', note: 'Picked from sender', createdAt: daysAgo(1) },
      { orderId: order6.id, status: OrderStatus.IN_TRANSIT, actorId: agent2.id, actorRole: 'AGENT', note: 'Package in transit', createdAt: daysAgo(1) },
    ],
  });

  // Order 7: PENDING — customer2 (freshly placed, no agent)
  const o7Charges = calcCharge(0.5, 15, 10, 8, 35, PaymentType.PREPAID, 2.0);
  const order7 = await prisma.order.create({
    data: {
      trackingNumber: `LMD-${now.toISOString().slice(0,10).replace(/-/g,'')}-GH7IJ`,
      customerId: customer2.id,
      pickupAddress: 'Karol Bagh, New Delhi, 110005',
      dropAddress: 'Rohini Sector 3, New Delhi, 110085',
      pickupZoneId: northZone.id,
      dropZoneId: northZone.id,
      lengthCm: 15, breadthCm: 10, heightCm: 8,
      actualWeightKg: 0.5,
      volumetricWeightKg: o7Charges.volumetricWeightKg,
      billableWeightKg: o7Charges.billableWeightKg,
      orderType: OrderType.B2C,
      paymentType: PaymentType.PREPAID,
      rateCardId: northIntraB2C?.id,
      baseRatePerKg: 35,
      charge: o7Charges.charge,
      codSurcharge: 0,
      totalCharge: o7Charges.totalCharge,
      status: OrderStatus.PENDING,
      createdAt: now,
      updatedAt: now,
    },
  });
  await prisma.orderTrackingEvent.create({
    data: { orderId: order7.id, status: OrderStatus.PENDING, actorId: customer2.id, actorRole: 'CUSTOMER', note: 'Order placed', createdAt: now },
  });

  // Order 8: PENDING — customer3
  const o8Charges = calcCharge(2.0, 30, 25, 20, 60, PaymentType.COD, 2.0);
  const order8 = await prisma.order.create({
    data: {
      trackingNumber: `LMD-${now.toISOString().slice(0,10).replace(/-/g,'')}-HI8JK`,
      customerId: customer3.id,
      pickupAddress: 'Powai Hiranandani, Mumbai, 400076',
      dropAddress: 'Connaught Place, New Delhi, 110001',
      pickupZoneId: westZone.id,
      dropZoneId: northZone.id,
      lengthCm: 30, breadthCm: 25, heightCm: 20,
      actualWeightKg: 2.0,
      volumetricWeightKg: o8Charges.volumetricWeightKg,
      billableWeightKg: o8Charges.billableWeightKg,
      orderType: OrderType.B2C,
      paymentType: PaymentType.COD,
      rateCardId: westNorthB2C?.id,
      baseRatePerKg: 60,
      charge: o8Charges.charge,
      codSurcharge: o8Charges.codSurcharge,
      totalCharge: o8Charges.totalCharge,
      status: OrderStatus.PENDING,
      createdAt: now,
      updatedAt: now,
    },
  });
  await prisma.orderTrackingEvent.create({
    data: { orderId: order8.id, status: OrderStatus.PENDING, actorId: customer3.id, actorRole: 'CUSTOMER', note: 'Order placed', createdAt: now },
  });

  // Order 9: PENDING — customer4
  const o9Charges = calcCharge(1.0, 20, 20, 20, 35, PaymentType.PREPAID, 2.0);
  const order9 = await prisma.order.create({
    data: {
      trackingNumber: `LMD-${now.toISOString().slice(0,10).replace(/-/g,'')}-IJ9KL`,
      customerId: customer4.id,
      pickupAddress: 'Electronic City Phase 1, Bangalore, 560100',
      dropAddress: 'Salt Lake City Center, Kolkata, 700064',
      pickupZoneId: southZone.id,
      dropZoneId: eastZone.id,
      lengthCm: 20, breadthCm: 20, heightCm: 20,
      actualWeightKg: 1.0,
      volumetricWeightKg: o9Charges.volumetricWeightKg,
      billableWeightKg: o9Charges.billableWeightKg,
      orderType: OrderType.B2C,
      paymentType: PaymentType.PREPAID,
      baseRatePerKg: 65,
      charge: o9Charges.charge,
      codSurcharge: 0,
      totalCharge: o9Charges.totalCharge,
      status: OrderStatus.PENDING,
      createdAt: now,
      updatedAt: now,
    },
  });
  await prisma.orderTrackingEvent.create({
    data: { orderId: order9.id, status: OrderStatus.PENDING, actorId: customer4.id, actorRole: 'CUSTOMER', note: 'Order placed', createdAt: now },
  });

  // Order 10: OUT_FOR_DELIVERY — customer5, agent1
  const o10Charges = calcCharge(1.8, 25, 20, 18, 55, PaymentType.COD, 2.0);
  const order10 = await prisma.order.create({
    data: {
      trackingNumber: `LMD-${daysAgo(4).toISOString().slice(0,10).replace(/-/g,'')}-JK0LM`,
      customerId: customer5.id,
      pickupAddress: 'Lajpat Nagar Central Market, Delhi, 110024',
      dropAddress: 'Koramangala 7th Block, Bangalore, 560095',
      pickupZoneId: northZone.id,
      dropZoneId: southZone.id,
      lengthCm: 25, breadthCm: 20, heightCm: 18,
      actualWeightKg: 1.8,
      volumetricWeightKg: o10Charges.volumetricWeightKg,
      billableWeightKg: o10Charges.billableWeightKg,
      orderType: OrderType.B2C,
      paymentType: PaymentType.COD,
      rateCardId: northSouthB2C?.id,
      baseRatePerKg: 55,
      charge: o10Charges.charge,
      codSurcharge: o10Charges.codSurcharge,
      totalCharge: o10Charges.totalCharge,
      status: OrderStatus.OUT_FOR_DELIVERY,
      assignedAgentId: agent1.id,
      createdAt: daysAgo(4),
      updatedAt: daysAgo(0),
    },
  });
  await prisma.orderTrackingEvent.createMany({
    data: [
      { orderId: order10.id, status: OrderStatus.PENDING, actorId: customer5.id, actorRole: 'CUSTOMER', note: 'Order placed', createdAt: daysAgo(4) },
      { orderId: order10.id, status: OrderStatus.PICKED_UP, actorId: agent1.id, actorRole: 'AGENT', note: 'Collected from pickup', createdAt: daysAgo(3) },
      { orderId: order10.id, status: OrderStatus.IN_TRANSIT, actorId: agent1.id, actorRole: 'AGENT', note: 'In transit', createdAt: daysAgo(2) },
      { orderId: order10.id, status: OrderStatus.OUT_FOR_DELIVERY, actorId: agent1.id, actorRole: 'AGENT', note: 'Out for delivery today', createdAt: daysAgo(0) },
    ],
  });

  // Order 11: OUT_FOR_DELIVERY — customer1, agent2
  const o11Charges = calcCharge(4.0, 45, 35, 25, 50, PaymentType.PREPAID, 1.5);
  const order11 = await prisma.order.create({
    data: {
      trackingNumber: `LMD-${daysAgo(3).toISOString().slice(0,10).replace(/-/g,'')}-KL1MN`,
      customerId: customer1.id,
      pickupAddress: 'Indiranagar, Bangalore, 560038',
      dropAddress: 'New Town Action Area 1, Kolkata, 700156',
      pickupZoneId: southZone.id,
      dropZoneId: eastZone.id,
      lengthCm: 45, breadthCm: 35, heightCm: 25,
      actualWeightKg: 4.0,
      volumetricWeightKg: o11Charges.volumetricWeightKg,
      billableWeightKg: o11Charges.billableWeightKg,
      orderType: OrderType.B2B,
      paymentType: PaymentType.PREPAID,
      rateCardId: southEastB2B?.id,
      baseRatePerKg: 50,
      charge: o11Charges.charge,
      codSurcharge: 0,
      totalCharge: o11Charges.totalCharge,
      status: OrderStatus.OUT_FOR_DELIVERY,
      assignedAgentId: agent2.id,
      createdAt: daysAgo(3),
      updatedAt: now,
    },
  });
  await prisma.orderTrackingEvent.createMany({
    data: [
      { orderId: order11.id, status: OrderStatus.PENDING, actorId: customer1.id, actorRole: 'CUSTOMER', note: 'B2B order placed', createdAt: daysAgo(3) },
      { orderId: order11.id, status: OrderStatus.PICKED_UP, actorId: agent2.id, actorRole: 'AGENT', note: 'Picked from sender warehouse', createdAt: daysAgo(2) },
      { orderId: order11.id, status: OrderStatus.IN_TRANSIT, actorId: agent2.id, actorRole: 'AGENT', note: 'In transit via Hyderabad hub', createdAt: daysAgo(1) },
      { orderId: order11.id, status: OrderStatus.OUT_FOR_DELIVERY, actorId: agent2.id, actorRole: 'AGENT', note: 'Final delivery attempt today', createdAt: now },
    ],
  });

  // Order 12: PICKED_UP — customer2, agent3
  const o12Charges = calcCharge(0.9, 18, 14, 10, 60, PaymentType.COD, 2.0);
  const order12 = await prisma.order.create({
    data: {
      trackingNumber: `LMD-${daysAgo(1).toISOString().slice(0,10).replace(/-/g,'')}-LM2NO`,
      customerId: customer2.id,
      pickupAddress: 'Juhu Scheme, Mumbai, 400049',
      dropAddress: 'Connaught Place New Delhi, 110001',
      pickupZoneId: westZone.id,
      dropZoneId: northZone.id,
      lengthCm: 18, breadthCm: 14, heightCm: 10,
      actualWeightKg: 0.9,
      volumetricWeightKg: o12Charges.volumetricWeightKg,
      billableWeightKg: o12Charges.billableWeightKg,
      orderType: OrderType.B2C,
      paymentType: PaymentType.COD,
      rateCardId: westNorthB2C?.id,
      baseRatePerKg: 60,
      charge: o12Charges.charge,
      codSurcharge: o12Charges.codSurcharge,
      totalCharge: o12Charges.totalCharge,
      status: OrderStatus.PICKED_UP,
      assignedAgentId: agent3.id,
      createdAt: daysAgo(1),
      updatedAt: now,
    },
  });
  await prisma.orderTrackingEvent.createMany({
    data: [
      { orderId: order12.id, status: OrderStatus.PENDING, actorId: customer2.id, actorRole: 'CUSTOMER', note: 'Order placed', createdAt: daysAgo(1) },
      { orderId: order12.id, status: OrderStatus.PICKED_UP, actorId: agent3.id, actorRole: 'AGENT', note: 'Package picked up', createdAt: now },
    ],
  });

  // Order 13: PICKED_UP — customer3, agent1
  const o13Charges = calcCharge(1.2, 22, 18, 14, 35, PaymentType.PREPAID, 2.0);
  const order13 = await prisma.order.create({
    data: {
      trackingNumber: `LMD-${daysAgo(1).toISOString().slice(0,10).replace(/-/g,'')}-MN3OP`,
      customerId: customer3.id,
      pickupAddress: 'Karol Bagh Main Market, Delhi, 110005',
      dropAddress: 'Dwarka Sector 12, Delhi, 110078',
      pickupZoneId: northZone.id,
      dropZoneId: northZone.id,
      lengthCm: 22, breadthCm: 18, heightCm: 14,
      actualWeightKg: 1.2,
      volumetricWeightKg: o13Charges.volumetricWeightKg,
      billableWeightKg: o13Charges.billableWeightKg,
      orderType: OrderType.B2C,
      paymentType: PaymentType.PREPAID,
      rateCardId: northIntraB2C?.id,
      baseRatePerKg: 35,
      charge: o13Charges.charge,
      codSurcharge: 0,
      totalCharge: o13Charges.totalCharge,
      status: OrderStatus.PICKED_UP,
      assignedAgentId: agent1.id,
      createdAt: daysAgo(1),
      updatedAt: now,
    },
  });
  await prisma.orderTrackingEvent.createMany({
    data: [
      { orderId: order13.id, status: OrderStatus.PENDING, actorId: customer3.id, actorRole: 'CUSTOMER', note: 'Order placed', createdAt: daysAgo(1) },
      { orderId: order13.id, status: OrderStatus.PICKED_UP, actorId: agent1.id, actorRole: 'AGENT', note: 'Package picked up for intra-zone delivery', createdAt: now },
    ],
  });

  // Order 14: FAILED (not rescheduled) — customer4, was agent2
  const o14Charges = calcCharge(2.2, 32, 26, 20, 55, PaymentType.COD, 2.0);
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const order14 = await prisma.order.create({
    data: {
      trackingNumber: `LMD-${daysAgo(5).toISOString().slice(0,10).replace(/-/g,'')}-NO4PQ`,
      customerId: customer4.id,
      pickupAddress: 'Karol Bagh, Delhi, 110005',
      dropAddress: 'Koramangala, Bangalore, 560034',
      pickupZoneId: northZone.id,
      dropZoneId: southZone.id,
      lengthCm: 32, breadthCm: 26, heightCm: 20,
      actualWeightKg: 2.2,
      volumetricWeightKg: o14Charges.volumetricWeightKg,
      billableWeightKg: o14Charges.billableWeightKg,
      orderType: OrderType.B2C,
      paymentType: PaymentType.COD,
      rateCardId: northSouthB2C?.id,
      baseRatePerKg: 55,
      charge: o14Charges.charge,
      codSurcharge: o14Charges.codSurcharge,
      totalCharge: o14Charges.totalCharge,
      status: OrderStatus.FAILED,
      assignedAgentId: agent2.id,
      createdAt: daysAgo(5),
      updatedAt: daysAgo(0),
    },
  });
  await prisma.orderTrackingEvent.createMany({
    data: [
      { orderId: order14.id, status: OrderStatus.PENDING, actorId: customer4.id, actorRole: 'CUSTOMER', note: 'Order placed', createdAt: daysAgo(5) },
      { orderId: order14.id, status: OrderStatus.PICKED_UP, actorId: agent2.id, actorRole: 'AGENT', note: 'Package collected', createdAt: daysAgo(4) },
      { orderId: order14.id, status: OrderStatus.IN_TRANSIT, actorId: agent2.id, actorRole: 'AGENT', note: 'In transit', createdAt: daysAgo(3) },
      { orderId: order14.id, status: OrderStatus.OUT_FOR_DELIVERY, actorId: agent2.id, actorRole: 'AGENT', note: 'Out for delivery', createdAt: daysAgo(1) },
      { orderId: order14.id, status: OrderStatus.FAILED, actorId: agent2.id, actorRole: 'AGENT', note: 'Delivery failed — recipient not available, door locked', createdAt: daysAgo(0) },
    ],
  });

  // Order 15: FAILED + RESCHEDULED — customer5, agent1 (rescheduled for tomorrow)
  const o15Charges = calcCharge(1.5, 28, 22, 16, 45, PaymentType.PREPAID, 2.0);
  const order15 = await prisma.order.create({
    data: {
      trackingNumber: `LMD-${daysAgo(6).toISOString().slice(0,10).replace(/-/g,'')}-OP5QR`,
      customerId: customer5.id,
      pickupAddress: 'Andheri West, Mumbai, 400053',
      dropAddress: 'Electronic City, Bangalore, 560100',
      pickupZoneId: westZone.id,
      dropZoneId: southZone.id,
      lengthCm: 28, breadthCm: 22, heightCm: 16,
      actualWeightKg: 1.5,
      volumetricWeightKg: o15Charges.volumetricWeightKg,
      billableWeightKg: o15Charges.billableWeightKg,
      orderType: OrderType.B2C,
      paymentType: PaymentType.PREPAID,
      rateCardId: westSouthB2C?.id,
      baseRatePerKg: 45,
      charge: o15Charges.charge,
      codSurcharge: 0,
      totalCharge: o15Charges.totalCharge,
      status: OrderStatus.PENDING, // Re-PENDING after reschedule
      assignedAgentId: agent3.id,
      scheduledDeliveryDate: tomorrow,
      createdAt: daysAgo(6),
      updatedAt: now,
    },
  });
  await prisma.orderTrackingEvent.createMany({
    data: [
      { orderId: order15.id, status: OrderStatus.PENDING, actorId: customer5.id, actorRole: 'CUSTOMER', note: 'Order placed', createdAt: daysAgo(6) },
      { orderId: order15.id, status: OrderStatus.PICKED_UP, actorId: agent3.id, actorRole: 'AGENT', note: 'Picked from sender', createdAt: daysAgo(5) },
      { orderId: order15.id, status: OrderStatus.IN_TRANSIT, actorId: agent3.id, actorRole: 'AGENT', note: 'In transit', createdAt: daysAgo(4) },
      { orderId: order15.id, status: OrderStatus.OUT_FOR_DELIVERY, actorId: agent3.id, actorRole: 'AGENT', note: 'Out for delivery', createdAt: daysAgo(1) },
      { orderId: order15.id, status: OrderStatus.FAILED, actorId: agent3.id, actorRole: 'AGENT', note: 'Delivery failed — address not found, customer number unreachable', createdAt: daysAgo(0) },
      { orderId: order15.id, status: OrderStatus.PENDING, actorId: customer5.id, actorRole: 'CUSTOMER', note: `Delivery rescheduled to ${tomorrow.toLocaleDateString('en-IN')} — Reason: Will be home tomorrow`, createdAt: now },
    ],
  });
  await prisma.deliveryReschedule.create({
    data: {
      orderId: order15.id,
      originalDate: daysAgo(0),
      newDate: tomorrow,
      reason: 'Will be home tomorrow, please redeliver',
      requestedBy: customer5.id,
    },
  });
  console.log('✓ Created 15 orders with full tracking history');

  // ─────────────────────────────────────────────────────────────
  // SUMMARY
  // ─────────────────────────────────────────────────────────────
  console.log('\n✅ Seed complete!');
  console.log('─────────────────────────────────────────────');
  console.log('Test credentials (password: Test@1234):');
  console.log('  Admin:    admin@lastmile.com');
  console.log('  Agent 1:  agent1@lastmile.com (North Zone, available)');
  console.log('  Agent 2:  agent2@lastmile.com (South Zone, busy)');
  console.log('  Agent 3:  agent3@lastmile.com (West Zone, available)');
  console.log('  Customer: customer1@lastmile.com … customer5@lastmile.com');
  console.log('─────────────────────────────────────────────');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

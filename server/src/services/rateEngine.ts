import { OrderType, PaymentType } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';
import { cacheGet, cacheSet, CacheKeys } from '../lib/redis';

export interface CalculateChargeParams {
  pickupZoneId: string;
  dropZoneId: string;
  lengthCm: number;
  breadthCm: number;
  heightCm: number;
  actualWeightKg: number;
  orderType: OrderType;
  paymentType: PaymentType;
}

export interface ChargeBreakdown {
  volumetricWeightKg: number;
  billableWeightKg: number;
  isIntraZone: boolean;
  rateCardId: string;
  rateCardName: string;
  baseRatePerKg: number;
  baseCharge: number;
  codSurchargePercent: number;
  codSurcharge: number;
  totalCharge: number;
  // Cache metadata (transparent to callers)
  _cached?: boolean;
}

// Shape stored in Redis (serialisable — no Decimal objects)
interface CachedRateCard {
  id: string;
  name: string;
  baseRatePerKg: number;
  codSurchargePercent: number;
}

/**
 * Pure rate calculation engine with Redis-backed rate card cache.
 *
 * Algorithm:
 * 1. Volumetric weight = (L × B × H) / 5000
 * 2. Billable weight = max(actual, volumetric), rounded UP to nearest 0.5kg
 * 3. Determine if intra-zone (same pickup and drop zone)
 * 4. Try Redis cache for rate card → on miss, query DB and prime cache (TTL 1hr)
 * 5. Base charge = billable weight × base_rate_per_kg
 * 6. COD surcharge = base charge × (cod_surcharge_percent / 100) if COD
 * 7. Total = base charge + COD surcharge
 *
 * Example: 30×20×15cm, 1.2kg, B2C, COD, North→South (₹55/kg)
 * Volumetric = (30×20×15)/5000 = 1.8kg
 * Billable = max(1.2, 1.8) = 1.8 → round up to 2.0kg
 * Base = 2.0 × 55 = ₹110
 * COD (2%) = ₹2.20
 * Total = ₹112.20
 */
export async function calculateCharge(params: CalculateChargeParams): Promise<ChargeBreakdown> {
  const {
    pickupZoneId,
    dropZoneId,
    lengthCm,
    breadthCm,
    heightCm,
    actualWeightKg,
    orderType,
    paymentType,
  } = params;

  // Step 1: Volumetric weight
  const volumetricWeightKg = (lengthCm * breadthCm * heightCm) / 5000;

  // Step 2: Billable weight (max, round UP to nearest 0.5)
  const rawBillable = Math.max(actualWeightKg, volumetricWeightKg);
  const billableWeightKg = Math.ceil(rawBillable * 2) / 2;

  // Step 3: Intra-zone check
  const isIntraZone = pickupZoneId === dropZoneId;

  // Step 4: Rate card lookup — Redis cache first, DB on miss
  const cacheKey = CacheKeys.rateCard(pickupZoneId, dropZoneId, orderType, isIntraZone);
  let rateCardData = await cacheGet<CachedRateCard>(cacheKey);
  let fromCache = true;

  if (!rateCardData) {
    fromCache = false;
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    const rateCard = await prisma.rateCard.findFirst({
      where: {
        fromZoneId: pickupZoneId,
        toZoneId: dropZoneId,
        orderType,
        isIntraZone,
        effectiveFrom: { lte: today },
      },
      orderBy: { effectiveFrom: 'desc' },
    });

    if (!rateCard) {
      const [pickup, drop] = await Promise.all([
        prisma.zone.findUnique({ where: { id: pickupZoneId }, select: { name: true } }),
        prisma.zone.findUnique({ where: { id: dropZoneId }, select: { name: true } }),
      ]);
      throw new AppError(
        `No active rate card found for ${orderType} orders from ${pickup?.name ?? pickupZoneId} to ${drop?.name ?? dropZoneId}. Please configure a rate card for this zone pair.`,
        'RATE_CARD_NOT_FOUND',
        422
      );
    }

    // Store serialisable form in Redis (Prisma Decimal → number)
    rateCardData = {
      id: rateCard.id,
      name: rateCard.name,
      baseRatePerKg: Number(rateCard.baseRatePerKg),
      codSurchargePercent: Number(rateCard.codSurchargePercent),
    };

    // Prime cache — non-blocking, failure is silent
    await cacheSet(cacheKey, rateCardData, 3600);
  }

  // Step 5-7: Calculate charges
  const { baseRatePerKg, codSurchargePercent } = rateCardData;
  const baseCharge = Math.round(billableWeightKg * baseRatePerKg * 100) / 100;
  const codSurcharge =
    paymentType === PaymentType.COD
      ? Math.round(baseCharge * (codSurchargePercent / 100) * 100) / 100
      : 0;
  const totalCharge = Math.round((baseCharge + codSurcharge) * 100) / 100;

  return {
    volumetricWeightKg: Math.round(volumetricWeightKg * 1000) / 1000,
    billableWeightKg,
    isIntraZone,
    rateCardId: rateCardData.id,
    rateCardName: rateCardData.name,
    baseRatePerKg,
    baseCharge,
    codSurchargePercent,
    codSurcharge,
    totalCharge,
    _cached: fromCache,
  };
}

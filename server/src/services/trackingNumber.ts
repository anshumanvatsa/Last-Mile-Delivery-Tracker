import crypto from 'crypto';
import { prisma } from '../lib/prisma';

/**
 * Generates a unique tracking number in the format: LMD-YYYYMMDD-XXXXX
 * where XXXXX is 5 random alphanumeric uppercase characters.
 * Retries on collision (unique constraint) up to 3 times.
 */
export async function generateTrackingNumber(): Promise<string> {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const suffix = Array.from({ length: 5 }, () =>
      chars[crypto.randomInt(0, chars.length)]
    ).join('');
    const trackingNumber = `LMD-${dateStr}-${suffix}`;

    // Check for collision
    const existing = await prisma.order.findUnique({ where: { trackingNumber } });
    if (!existing) {
      return trackingNumber;
    }

    console.warn(`Tracking number collision on attempt ${attempt}: ${trackingNumber}`);
    if (attempt === maxAttempts) {
      throw new Error(`Failed to generate unique tracking number after ${maxAttempts} attempts`);
    }
  }

  throw new Error('Tracking number generation failed');
}

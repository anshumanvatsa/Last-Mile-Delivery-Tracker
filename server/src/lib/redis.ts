import Redis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// Singleton Redis client
let redisClient: Redis | null = null;
let isConnected = false;

// Detect TLS (Upstash uses rediss://)
const isTLS = REDIS_URL.startsWith('rediss://');

// Hit/miss counters for metrics
let cacheHits = 0;
let cacheMisses = 0;

export function getRedisClient(): Redis | null {
  if (redisClient) return redisClient;

  try {
    redisClient = new Redis(REDIS_URL, {
      maxRetriesPerRequest: 1,
      connectTimeout: 3000,
      lazyConnect: true,
      enableOfflineQueue: false,
      ...(isTLS && { tls: { rejectUnauthorized: false } }), // Upstash TLS support
    });

    redisClient.on('connect', () => {
      isConnected = true;
      console.log('[REDIS] Connected to Redis');
    });

    redisClient.on('error', (err) => {
      isConnected = false;
      // Graceful — log but never crash the app
      console.warn('[REDIS] Connection error (non-fatal):', err.message);
    });

    redisClient.on('close', () => {
      isConnected = false;
    });

    redisClient.connect().catch((err) => {
      console.warn('[REDIS] Failed to connect (non-fatal):', err.message);
    });
  } catch (err: any) {
    console.warn('[REDIS] Init failed (non-fatal):', err.message);
    redisClient = null;
  }

  return redisClient;
}

export function isRedisConnected(): boolean {
  return isConnected;
}

// ─── Cache Helpers ────────────────────────────────────────────────────────────

const DEFAULT_TTL = 3600; // 1 hour

export async function cacheGet<T>(key: string): Promise<T | null> {
  const client = getRedisClient();
  if (!client || !isConnected) return null;

  try {
    const raw = await client.get(key);
    if (raw !== null) {
      cacheHits++;
      return JSON.parse(raw) as T;
    }
    cacheMisses++;
    return null;
  } catch {
    cacheMisses++;
    return null; // Graceful degradation
  }
}

export async function cacheSet(key: string, value: unknown, ttlSeconds = DEFAULT_TTL): Promise<void> {
  const client = getRedisClient();
  if (!client || !isConnected) return;

  try {
    await client.setex(key, ttlSeconds, JSON.stringify(value));
  } catch {
    // Graceful — cache write failure never blocks the request
  }
}

export async function cacheDelete(pattern: string): Promise<void> {
  const client = getRedisClient();
  if (!client || !isConnected) return;

  try {
    // Scan-based delete (safe for production — no KEYS command)
    let cursor = '0';
    do {
      const [nextCursor, keys] = await client.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = nextCursor;
      if (keys.length > 0) {
        await client.del(...keys);
      }
    } while (cursor !== '0');
  } catch {
    // Graceful
  }
}

// ─── Cache Key Builders ────────────────────────────────────────────────────────

export const CacheKeys = {
  rateCard: (fromZoneId: string, toZoneId: string, orderType: string, isIntraZone: boolean) =>
    `rc:${fromZoneId}:${toZoneId}:${orderType}:${isIntraZone}`,

  allRateCards: () => `rc:list:all`,
  allZones:     () => `zones:all`,

  // Pattern to invalidate all rate card cache on mutations
  rateCardPattern: () => `rc:*`,
  zonesPattern:    () => `zones:*`,
};

// ─── Metrics ──────────────────────────────────────────────────────────────────

export function getCacheStats() {
  const total = cacheHits + cacheMisses;
  const hitRate = total > 0 ? Math.round((cacheHits / total) * 100) : 0;
  return {
    hits: cacheHits,
    misses: cacheMisses,
    total,
    hitRatePercent: hitRate,
    connected: isConnected,
  };
}

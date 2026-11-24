/**
 * High-Performance Token Bucket Rate Limiter
 * Limits abusive traffic, scraping, and webhook flooding per IP and Tenant.
 */

interface Bucket {
  tokens: number;
  lastRefillMs: number;
}

const globalForLimiter = globalThis as unknown as {
  rateLimitBucketsMap: Map<string, Bucket> | undefined;
};

const buckets =
  globalForLimiter.rateLimitBucketsMap ?? new Map<string, Bucket>();

globalForLimiter.rateLimitBucketsMap = buckets;

export interface RateLimitOptions {
  maxRequests: number; // Max requests allowed within interval
  windowMs: number;    // Window duration in ms
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetMs: number;
}

const MAX_BUCKETS = 50_000;
const IDLE_EVICT_MS = 10 * 60_000;

/** Keeps memory bounded when many distinct keys (e.g. spoofed IPs) are seen. */
function pruneBuckets(now: number): void {
  if (buckets.size < MAX_BUCKETS) return;
  for (const [key, bucket] of buckets) {
    if (now - bucket.lastRefillMs > IDLE_EVICT_MS) buckets.delete(key);
  }
  // Still too many active keys: drop the oldest insertions.
  const excess = buckets.size - MAX_BUCKETS;
  if (excess > 0) {
    let removed = 0;
    for (const key of buckets.keys()) {
      buckets.delete(key);
      if (++removed >= excess) break;
    }
  }
}

export function checkRateLimit(
  identifier: string,
  options: RateLimitOptions = { maxRequests: 60, windowMs: 60_000 }
): RateLimitResult {
  const now = Date.now();
  pruneBuckets(now);
  const bucketKey = `rl:${identifier}`;
  let bucket = buckets.get(bucketKey);

  if (!bucket) {
    bucket = {
      tokens: options.maxRequests - 1,
      lastRefillMs: now,
    };
    buckets.set(bucketKey, bucket);
    return {
      allowed: true,
      limit: options.maxRequests,
      remaining: options.maxRequests - 1,
      resetMs: options.windowMs,
    };
  }

  // Refill tokens proportionally based on elapsed time
  const elapsedMs = now - bucket.lastRefillMs;
  if (elapsedMs > options.windowMs) {
    bucket.tokens = options.maxRequests;
    bucket.lastRefillMs = now;
  } else {
    const refillAmount = (elapsedMs / options.windowMs) * options.maxRequests;
    bucket.tokens = Math.min(options.maxRequests, bucket.tokens + refillAmount);
    bucket.lastRefillMs = now;
  }

  if (bucket.tokens >= 1) {
    bucket.tokens -= 1;
    return {
      allowed: true,
      limit: options.maxRequests,
      remaining: Math.floor(bucket.tokens),
      resetMs: Math.max(0, options.windowMs - elapsedMs),
    };
  }

  return {
    allowed: false,
    limit: options.maxRequests,
    remaining: 0,
    resetMs: Math.max(0, options.windowMs - elapsedMs),
  };
}

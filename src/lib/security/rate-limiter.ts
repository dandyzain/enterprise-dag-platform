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

if (process.env.NODE_ENV !== "production") {
  globalForLimiter.rateLimitBucketsMap = buckets;
}

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

export function checkRateLimit(
  identifier: string,
  options: RateLimitOptions = { maxRequests: 60, windowMs: 60_000 }
): RateLimitResult {
  const now = Date.now();
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

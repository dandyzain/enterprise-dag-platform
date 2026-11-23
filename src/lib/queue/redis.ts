import Redis, { RedisOptions } from "ioredis";

const BASE_OPTIONS: RedisOptions = {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  connectTimeout: 2000,
  retryStrategy: (times) => (times > 3 ? null : Math.min(times * 100, 1000)),
};

export function isRedisConfigured(): boolean {
  return Boolean(process.env.REDIS_URL || process.env.REDIS_HOST);
}

/**
 * Connection options for ioredis/BullMQ. REDIS_URL (redis:// or rediss://) is
 * parsed into discrete options — previously it was ignored, so BullMQ silently
 * connected to localhost on Railway/Render and every job fell back to the
 * in-process runner.
 */
export function getRedisOptions(): RedisOptions {
  const redisUrl = process.env.REDIS_URL;
  if (redisUrl && /^rediss?:\/\//.test(redisUrl)) {
    const url = new URL(redisUrl);
    const db = url.pathname && url.pathname.length > 1 ? Number.parseInt(url.pathname.slice(1), 10) : undefined;
    return {
      ...BASE_OPTIONS,
      host: url.hostname,
      port: url.port ? Number.parseInt(url.port, 10) : 6379,
      username: url.username ? decodeURIComponent(url.username) : undefined,
      password: url.password ? decodeURIComponent(url.password) : undefined,
      db: Number.isFinite(db) ? db : undefined,
      tls: url.protocol === "rediss:" ? {} : undefined,
      family: 0,
    };
  }

  return {
    ...BASE_OPTIONS,
    host: process.env.REDIS_HOST || "127.0.0.1",
    port: Number.parseInt(process.env.REDIS_PORT || "6379", 10),
    password: process.env.REDIS_PASSWORD || undefined,
  };
}

const globalForRedis = globalThis as unknown as {
  __nfRedis?: { client: Redis | null; available: boolean; lastCheck: number };
};
const redisState = globalForRedis.__nfRedis ?? (globalForRedis.__nfRedis = { client: null, available: false, lastCheck: 0 });

export function getRedisConnection(): Redis {
  if (!redisState.client) {
    const client = new Redis({ ...getRedisOptions(), lazyConnect: false });
    client.on("error", () => {
      redisState.available = false;
    });
    client.on("ready", () => {
      redisState.available = true;
    });
    client.on("end", () => {
      // Connection gave up retrying; allow a fresh client on the next health check.
      redisState.available = false;
      if (redisState.client === client) redisState.client = null;
    });
    redisState.client = client;
  }
  return redisState.client;
}

/** Last known Redis state without performing I/O. */
export function isRedisReady(): boolean {
  return redisState.available;
}

const HEALTH_TTL_MS = 10_000;

export async function checkRedisHealth(): Promise<boolean> {
  const now = Date.now();
  if (now - redisState.lastCheck < HEALTH_TTL_MS) return redisState.available;
  redisState.lastCheck = now;

  try {
    const client = getRedisConnection();
    const res = await Promise.race([
      client.ping(),
      new Promise<string>((_, reject) => setTimeout(() => reject(new Error("Redis ping timeout")), 800)),
    ]);
    redisState.available = res === "PONG";
  } catch {
    redisState.available = false;
  }
  return redisState.available;
}

import Redis, { RedisOptions } from "ioredis";

const redisHost = process.env.REDIS_HOST || "127.0.0.1";
const redisPort = parseInt(process.env.REDIS_PORT || "6379", 10);
const redisPassword = process.env.REDIS_PASSWORD || undefined;
const redisUrl = process.env.REDIS_URL;

let redisClient: Redis | null = null;
let isRedisAvailable = false;
let checkDone = false;

export function getRedisOptions(): RedisOptions {
  if (redisUrl && redisUrl.startsWith("redis")) {
    return {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      connectTimeout: 2000,
      retryStrategy: (times) => (times > 3 ? null : Math.min(times * 100, 1000)),
    };
  }

  return {
    host: redisHost,
    port: redisPort,
    password: redisPassword,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    connectTimeout: 2000,
    retryStrategy: (times) => (times > 3 ? null : Math.min(times * 100, 1000)),
  };
}

export function getRedisConnection(): Redis {
  if (!redisClient) {
    if (redisUrl && redisUrl.startsWith("redis")) {
      redisClient = new Redis(redisUrl, getRedisOptions());
    } else {
      redisClient = new Redis(getRedisOptions());
    }

    redisClient.on("error", (err) => {
      isRedisAvailable = false;
      // Suppress unhandled connection refused spew in development
    });

    redisClient.on("ready", () => {
      isRedisAvailable = true;
    });
  }

  return redisClient;
}

export async function checkRedisHealth(): Promise<boolean> {
  if (checkDone && isRedisAvailable) return true;

  try {
    const client = getRedisConnection();
    const res = await Promise.race([
      client.ping(),
      new Promise<string>((_, reject) =>
        setTimeout(() => reject(new Error("Redis ping timeout")), 800)
      ),
    ]);
    isRedisAvailable = res === "PONG";
    checkDone = true;
    return isRedisAvailable;
  } catch {
    isRedisAvailable = false;
    checkDone = true;
    return false;
  }
}

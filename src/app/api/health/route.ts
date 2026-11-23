import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getDbCircuitState, recordDbFailure, isConnectivityError } from "@/lib/db/circuit";
import { checkRedisHealth, isRedisConfigured } from "@/lib/queue/redis";
import { getQueueDepth } from "@/lib/queue/workflow-queue";

export const dynamic = "force-dynamic";

type CheckStatus = "up" | "down" | "not_configured";

/**
 * Liveness/readiness probe with *real* checks (previously the worker was
 * always reported "ready" and the overall status was always "healthy").
 *
 * status: "healthy"  — every configured dependency is reachable
 *         "degraded" — running on a fallback (in-memory store or in-process runner)
 * HTTP 200 in both cases so platform health checks don't restart a working
 * fallback; 503 only when the app cannot serve at all.
 */
export async function GET() {
  const startTime = performance.now();

  let database: CheckStatus = "not_configured";
  let dbLatencyMs: number | null = null;
  if (getDbCircuitState().configured) {
    const t0 = performance.now();
    try {
      await Promise.race([
        prisma.$queryRaw`SELECT 1`,
        new Promise((_, reject) => setTimeout(() => reject(new Error("Database health check timed out")), 1500)),
      ]);
      database = "up";
      dbLatencyMs = Math.round(performance.now() - t0);
    } catch (err) {
      database = "down";
      if (isConnectivityError(err) || (err instanceof Error && err.message.includes("timed out"))) recordDbFailure(err);
    }
  }

  let redis: CheckStatus = isRedisConfigured() ? "down" : "not_configured";
  let queueDepth: number | null = null;
  if (isRedisConfigured() && (await checkRedisHealth())) {
    redis = "up";
    queueDepth = await getQueueDepth();
  }

  const degraded = database !== "up" || redis !== "up";
  const memory = process.memoryUsage();

  return NextResponse.json(
    {
      status: degraded ? "degraded" : "healthy",
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || "0.2.0",
      checks: {
        database: {
          status: database,
          latencyMs: dbLatencyMs,
          fallback: database === "up" ? null : "in-memory store (not durable)",
        },
        queue: {
          status: redis,
          driver: redis === "up" ? "BullMQ / Redis" : "in-process runner",
          waitingJobs: queueDepth,
        },
        api: { status: "up", latencyMs: Math.round(performance.now() - startTime) },
      },
      system: {
        uptimeSeconds: Math.round(process.uptime()),
        heapUsedMb: Math.round(memory.heapUsed / 1024 / 1024),
        rssMb: Math.round(memory.rss / 1024 / 1024),
      },
    },
    { status: 200, headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } }
  );
}

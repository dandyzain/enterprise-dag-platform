import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { runSchedulerTick } from "@/lib/queue/scheduler";

export const dynamic = "force-dynamic";

/**
 * Serverless scheduler entry point (e.g. Vercel Cron, GitHub Actions, any
 * external cron hitting this URL every minute). Requires
 * `Authorization: Bearer $CRON_SECRET`.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET is not configured." }, { status: 503 });

  const provided = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const a = crypto.createHash("sha256").update(provided).digest();
  const b = crypto.createHash("sha256").update(secret).digest();
  if (!crypto.timingSafeEqual(a, b)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const result = await runSchedulerTick();
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}

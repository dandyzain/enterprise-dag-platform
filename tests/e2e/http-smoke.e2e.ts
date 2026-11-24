/**
 * HTTP smoke tests against a running NexusFlow server (dev or production build).
 *
 *   pnpm dev                       # or: pnpm build && pnpm start
 *   TEST_APP_URL=http://localhost:3000 pnpm test:e2e
 *
 * The server must run with DEMO_MODE enabled (default outside production) and
 * the same SESSION_SECRET as this process (both default to the dev key), so
 * the test can mint a session cookie for the demo owner.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { DEMO_USERS, getAuthCookieName, signSessionToken } from "@/lib/services/auth-service";

const BASE_URL = (process.env.TEST_APP_URL || "http://localhost:3000").replace(/\/+$/, "");
let ownerCookie = "";
let viewerCookie = "";

async function get(path: string, cookie?: string) {
  return fetch(`${BASE_URL}${path}`, { redirect: "manual", headers: cookie ? { cookie } : {} });
}

beforeAll(async () => {
  ownerCookie = `${getAuthCookieName()}=${signSessionToken(DEMO_USERS["admin@enterprise.io"].session)}`;
  viewerCookie = `${getAuthCookieName()}=${signSessionToken(DEMO_USERS["viewer@enterprise.io"].session)}`;
  const health = await fetch(`${BASE_URL}/api/health`).catch(() => null);
  if (!health) throw new Error(`No server reachable at ${BASE_URL}. Start it first (pnpm dev).`);
});

describe("Health & security headers", () => {
  it("reports real dependency status", async () => {
    const res = await fetch(`${BASE_URL}/api/health`);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(["healthy", "degraded"]).toContain(json.status);
    expect(json.checks.database).toHaveProperty("status");
    expect(json.checks.queue).toHaveProperty("status");
  });

  it("sends CSP and anti-framing headers", async () => {
    const res = await get("/en/login");
    expect(res.headers.get("content-security-policy")).toContain("frame-ancestors 'none'");
    expect(res.headers.get("x-frame-options")).toBe("DENY");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
  });

  it("serves robots.txt and sitemap.xml", async () => {
    expect((await get("/robots.txt")).status).toBe(200);
    expect((await get("/sitemap.xml")).status).toBe(200);
  });
});

describe("Authentication gates", () => {
  it.each(["/en", "/id", "/en/credentials", "/en/executions", "/en/settings", "/en/workflows/wf-enterprise-1"])(
    "redirects anonymous visitors of %s to the login page",
    async (path) => {
      const res = await get(path);
      expect([302, 303, 307, 308]).toContain(res.status);
      expect(res.headers.get("location")).toMatch(/\/(en|id)\/login/);
    }
  );

  it("renders the login page publicly", async () => {
    const res = await get("/id/login");
    expect(res.status).toBe(200);
  });

  it.each(["/en", "/id/credentials", "/en/executions", "/en/settings", "/en/workflows/wf-enterprise-1"])(
    "renders %s for a signed-in member",
    async (path) => {
      const res = await get(path, ownerCookie);
      expect(res.status).toBe(200);
      expect((await res.text()).length).toBeGreaterThan(500);
    }
  );

  it("rejects anonymous access to execution history (401)", async () => {
    const res = await get("/api/workflows/wf-enterprise-1/executions");
    expect(res.status).toBe(401);
  });

  it("rejects forged session cookies", async () => {
    const forged = `${getAuthCookieName()}=${Buffer.from(JSON.stringify({ id: "x", role: "OWNER" })).toString("base64url")}.bad`;
    const res = await get("/api/workflows/wf-enterprise-1/executions", forged);
    expect(res.status).toBe(401);
  });
});

describe("Webhook ingestion & live telemetry", () => {
  let executionId = "";

  it("accepts a webhook for a published workflow with HTTP 202", async () => {
    const res = await fetch(`${BASE_URL}/api/workflows/wh/customer-signup-hook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customerId: "cust_e2e", tier: "enterprise" }),
    });
    expect(res.status).toBe(202);
    const data = await res.json();
    expect(data.accepted).toBe(true);
    executionId = data.executionId;
  });

  it("returns 404 for unknown webhook paths", async () => {
    const res = await fetch(`${BASE_URL}/api/workflows/wh/unknown-invalid-slug-999`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    expect(res.status).toBe(404);
  });

  it("rejects malformed JSON with 400", async () => {
    const res = await fetch(`${BASE_URL}/api/workflows/wh/customer-signup-hook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{not json",
    });
    expect(res.status).toBe(400);
  });

  it("streams execution telemetry over SSE for workspace members", async () => {
    const res = await fetch(`${BASE_URL}/api/workflows/wf-enterprise-1/executions/${executionId}/stream`, {
      headers: { Accept: "text/event-stream", cookie: viewerCookie },
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/event-stream");
    const reader = res.body!.getReader();
    const { value } = await reader.read();
    expect(new TextDecoder().decode(value)).toContain(executionId);
    await reader.cancel();
  });

  it("refuses SSE without a session", async () => {
    const res = await fetch(`${BASE_URL}/api/workflows/wf-enterprise-1/executions/${executionId}/stream`);
    expect(res.status).toBe(401);
  });
});

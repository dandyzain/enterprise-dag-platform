import { describe, it, expect, beforeAll, vi } from "vitest";
import crypto from "node:crypto";

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined, set: () => undefined, delete: () => undefined }),
  headers: async () => new Headers(),
}));

import { NextRequest } from "next/server";
import { POST, GET } from "@/app/api/workflows/wh/[path]/route";
import { saveWorkflow, setWorkflowStatus } from "@/lib/services/workflow-service";
import { createCredential } from "@/lib/services/credential-service";
import { setExecutionDbAvailability } from "@/lib/services/execution-service";

const WS = "ws_webhook_tests";
const SHARED = "whsec_correct_horse_battery_staple";
const SIGNING = "github_signing_secret_value";

function post(path: string, body: string, headers: Record<string, string> = {}) {
  return POST(
    new NextRequest(`http://localhost/api/workflows/wh/${path}`, {
      method: "POST",
      body,
      headers: { "content-type": "application/json", "x-forwarded-for": `198.51.100.${Math.floor(Math.random() * 200)}`, ...headers },
    }),
    { params: Promise.resolve({ path }) }
  );
}

describe("Webhook ingestion route", () => {
  beforeAll(async () => {
    setExecutionDbAvailability(false);
    await createCredential({ workspaceId: WS, userId: "usr_wh", name: "GH_SIGNING", type: "webhook_secret", value: SIGNING });

    const mk = (id: string, path: string, config: Record<string, unknown>) =>
      saveWorkflow({
        id,
        name: id,
        workspaceId: WS,
        userId: "usr_wh",
        status: "DRAFT",
        nodes: [{ id: "w", data: { label: "Hook", type: "webhook", config: { path, ...config } } }],
        edges: [],
      });

    await mk("wf_wh_secret", "secret-hook", { secretHeader: SHARED });
    await mk("wf_wh_signed", "signed-hook", { signatureProvider: "github", signingSecretCredential: "GH_SIGNING" });
    await mk("wf_wh_draft", "draft-hook", {});
    await setWorkflowStatus("wf_wh_secret", WS, "PUBLISHED");
    await setWorkflowStatus("wf_wh_signed", WS, "PUBLISHED");
  });

  it("refuses deliveries to unpublished workflows from anonymous callers", async () => {
    const res = await post("draft-hook", "{}");
    expect(res.status).toBe(409);
    expect((await GET(new NextRequest("http://localhost/x"), { params: Promise.resolve({ path: "draft-hook" }) })).status).toBe(404);
  });

  it("requires the exact shared secret (no substring matches)", async () => {
    expect((await post("secret-hook", "{}")).status).toBe(401);
    expect((await post("secret-hook", "{}", { "x-webhook-secret": "whsec" })).status).toBe(401);
    expect((await post("secret-hook", "{}", { authorization: `Bearer prefix-${SHARED}-suffix` })).status).toBe(401);
    expect((await post("secret-hook", "{}", { "x-webhook-secret": SHARED })).status).toBe(202);
    expect((await post("secret-hook", "{}", { authorization: `Bearer ${SHARED}` })).status).toBe(202);
  });

  it("verifies provider signatures over the raw body", async () => {
    const body = JSON.stringify({ action: "opened" });
    const good = `sha256=${crypto.createHmac("sha256", SIGNING).update(body).digest("hex")}`;
    expect((await post("signed-hook", body)).status).toBe(401);
    expect((await post("signed-hook", body, { "x-hub-signature-256": "sha256=deadbeef" })).status).toBe(401);
    expect((await post("signed-hook", `${body} `, { "x-hub-signature-256": good })).status).toBe(401);
    expect((await post("signed-hook", body, { "x-hub-signature-256": good })).status).toBe(202);
  });

  it("rejects oversized and malformed payloads", async () => {
    const big = JSON.stringify({ blob: "x".repeat(1024 * 1024 + 10) });
    expect((await post("secret-hook", big, { "x-webhook-secret": SHARED })).status).toBe(413);
    expect((await post("secret-hook", "{broken", { "x-webhook-secret": SHARED })).status).toBe(400);
  });

  it("validates the path format", async () => {
    expect((await post("../etc", "{}")).status).toBe(400);
  });
});

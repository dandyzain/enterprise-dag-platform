import dns from "node:dns";
import { Agent, fetch as undiciFetch } from "undici";
import { isBlockedAddress, validateSafeUrl } from "@/lib/security/anti-ssrf";

/**
 * Outbound HTTP client for workflow steps.
 *
 * - Every hop (initial URL and each redirect) passes `validateSafeUrl`.
 * - DNS answers are checked *inside the socket connect* (custom `lookup`), so
 *   a public-looking hostname resolving to 10.0.0.5 / 169.254.169.254 — or a
 *   DNS-rebinding answer that changes between check and use — is refused.
 * - Redirects are followed manually (max 5) and credentials are dropped when
 *   a redirect leaves the original origin.
 * - Response bodies are capped (default 1 MiB) and requests time out.
 */

export class EgressBlockedError extends Error {
  constructor(reason: string) {
    super(`Anti-SSRF Security Alert: ${reason}`);
    this.name = "EgressBlockedError";
  }
}

export class ResponseTooLargeError extends Error {
  constructor(limit: number) {
    super(`Response body exceeded the ${Math.round(limit / 1024)} KiB limit.`);
    this.name = "ResponseTooLargeError";
  }
}

type LookupCallback = (err: NodeJS.ErrnoException | null, address?: string | dns.LookupAddress[], family?: number) => void;

function guardedLookup(hostname: string, options: dns.LookupOptions, callback: LookupCallback): void {
  dns.lookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return callback(err);
    const list = addresses as dns.LookupAddress[];
    if (list.length === 0) return callback(Object.assign(new Error(`No addresses for ${hostname}`), { code: "ENOTFOUND" }));
    const blocked = list.find((a) => isBlockedAddress(a.address));
    if (blocked) {
      return callback(
        Object.assign(new EgressBlockedError(`'${hostname}' resolves to a private/internal address (${blocked.address}).`), {
          code: "EBLOCKED",
        })
      );
    }
    if (options.all) return callback(null, list);
    return callback(null, list[0].address, list[0].family);
  });
}

const globalForAgent = globalThis as unknown as { __nfEgressAgent?: Agent };
const egressAgent: Agent =
  globalForAgent.__nfEgressAgent ??
  (globalForAgent.__nfEgressAgent = new Agent({
    connect: { lookup: guardedLookup as never, timeout: 5_000 },
    headersTimeout: 30_000,
    bodyTimeout: 30_000,
    connections: 64,
  }));

type Transport = (url: string, init: Record<string, unknown>) => Promise<{
  status: number;
  statusText: string;
  ok: boolean;
  headers: { get(name: string): string | null; forEach(cb: (value: string, key: string) => void): void };
  body: ReadableStream<Uint8Array> | null;
}>;

const defaultTransport: Transport = (url, init) => undiciFetch(url, { ...init, dispatcher: egressAgent } as never) as never;
let transport: Transport = defaultTransport;

/** Test hook: replace the network transport (e.g. return `new Response(...)`). */
export function setHttpTransportForTesting(fn: Transport | null): void {
  transport = fn ?? defaultTransport;
}

export interface SafeFetchOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  timeoutMs?: number;
  maxBytes?: number;
  maxRedirects?: number;
  signal?: AbortSignal;
}

export interface SafeFetchResult {
  status: number;
  ok: boolean;
  statusText: string;
  url: string;
  headers: Record<string, string>;
  data: unknown;
}

const SENSITIVE_HEADERS = ["authorization", "cookie", "proxy-authorization", "x-api-key"];

async function readCapped(body: ReadableStream<Uint8Array> | null, maxBytes: number): Promise<string> {
  if (!body) return "";
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => undefined);
      throw new ResponseTooLargeError(maxBytes);
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks.map((c) => Buffer.from(c))).toString("utf8");
}

export async function safeFetch(targetUrl: string, options: SafeFetchOptions = {}): Promise<SafeFetchResult> {
  const timeoutMs = Math.min(Math.max(options.timeoutMs ?? 8_000, 500), 60_000);
  const maxBytes = options.maxBytes ?? 1024 * 1024;
  const maxRedirects = options.maxRedirects ?? 5;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error(`HTTP request timed out after ${timeoutMs}ms`)), timeoutMs);
  const onOuterAbort = () => controller.abort(options.signal?.reason ?? new Error("Execution aborted"));
  options.signal?.addEventListener("abort", onOuterAbort, { once: true });

  let url = targetUrl;
  let method = (options.method || "GET").toUpperCase();
  let body = method === "GET" || method === "HEAD" ? undefined : options.body;
  let headers = { ...(options.headers ?? {}) };
  const originalOrigin = new URL(targetUrl).origin;

  try {
    for (let hop = 0; ; hop++) {
      const check = validateSafeUrl(url);
      if (!check.isSafe) throw new EgressBlockedError(check.reason ?? "Blocked destination");

      let res;
      try {
        res = await transport(url, { method, headers, body, redirect: "manual", signal: controller.signal });
      } catch (err) {
        const cause = (err as { cause?: unknown }).cause;
        if (cause instanceof EgressBlockedError) throw cause;
        if (controller.signal.aborted) {
          const reason = controller.signal.reason;
          throw reason instanceof Error ? reason : new Error("HTTP request aborted");
        }
        // undici reports "fetch failed"; surface the underlying network error (ENOTFOUND, ECONNREFUSED...).
        const detail = cause && typeof cause === "object" ? (cause as { code?: string; message?: string }) : null;
        if (detail?.code || detail?.message) {
          throw new Error(`Request to ${new URL(url).host} failed: ${detail.code ?? detail.message}`);
        }
        throw err;
      }

      const location = res.headers.get("location");
      if (res.status >= 300 && res.status < 400 && location) {
        await res.body?.cancel().catch(() => undefined);
        if (hop >= maxRedirects) throw new Error(`Too many redirects (>${maxRedirects}).`);
        const next = new URL(location, url);
        if (res.status === 303 || ((res.status === 301 || res.status === 302) && method === "POST")) {
          method = "GET";
          body = undefined;
        }
        if (next.origin !== originalOrigin) {
          headers = Object.fromEntries(Object.entries(headers).filter(([k]) => !SENSITIVE_HEADERS.includes(k.toLowerCase())));
        }
        url = next.toString();
        continue;
      }

      const text = method === "HEAD" ? "" : await readCapped(res.body, maxBytes);
      const contentType = res.headers.get("content-type") || "";
      let data: unknown = text;
      if (contentType.includes("json") && text.length > 0) {
        try {
          data = JSON.parse(text);
        } catch {
          data = text;
        }
      }

      const responseHeaders: Record<string, string> = {};
      res.headers.forEach((value, key) => {
        if (key !== "set-cookie") responseHeaders[key] = value;
      });

      return { status: res.status, ok: res.ok, statusText: res.statusText, url, headers: responseHeaders, data };
    }
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener("abort", onOuterAbort);
  }
}

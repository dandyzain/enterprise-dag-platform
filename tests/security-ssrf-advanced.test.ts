import { describe, it, expect, afterEach, vi } from "vitest";
import { validateSafeUrl, isBlockedAddress } from "@/lib/security/anti-ssrf";
import { safeFetch, setHttpTransportForTesting, ResponseTooLargeError } from "@/lib/security/safe-fetch";

describe("Anti-SSRF: address classification", () => {
  it.each([
    "127.0.0.1",
    "10.1.2.3",
    "172.20.0.5",
    "192.168.1.10",
    "169.254.169.254",
    "100.64.0.1",
    "0.0.0.0",
    "224.0.0.1",
    "::1",
    "::",
    "fc00::1",
    "fd12:3456::1",
    "fe80::1",
    "::ffff:127.0.0.1",
    "::ffff:7f00:1",
  ])("blocks %s", (ip) => {
    expect(isBlockedAddress(ip)).toBe(true);
  });

  it.each(["93.184.216.34", "1.1.1.1", "8.8.8.8", "2606:4700:4700::1111"])("allows public address %s", (ip) => {
    expect(isBlockedAddress(ip)).toBe(false);
  });
});

describe("Anti-SSRF: URL validation bypass attempts", () => {
  it.each([
    "http://2130706433/", // decimal 127.0.0.1
    "http://0x7f000001/", // hex
    "http://0177.0.0.1/", // octal
    "http://127.1/",
    "http://[::ffff:127.0.0.1]/",
    "http://[::1]:8080/",
    "http://100.100.100.200/latest/meta-data", // Alibaba metadata (CGNAT range)
    "http://metadata.google.internal/computeMetadata/v1/",
    "http://service.internal/",
    "http://printer.local/",
    "http://db/",
    "http://user:pass@example.com/",
    "file:///etc/passwd",
    "gopher://example.com/",
  ])("rejects %s", (url) => {
    expect(validateSafeUrl(url).isSafe).toBe(false);
  });

  it("accepts public HTTPS endpoints", () => {
    expect(validateSafeUrl("https://api.stripe.com/v1/charges").isSafe).toBe(true);
    expect(validateSafeUrl("https://jsonplaceholder.typicode.com/users/1").isSafe).toBe(true);
  });
});

describe("safeFetch", () => {
  afterEach(() => setHttpTransportForTesting(null));

  it("refuses redirects to internal addresses", async () => {
    setHttpTransportForTesting(
      vi.fn().mockResolvedValue(new Response(null, { status: 302, headers: { location: "http://169.254.169.254/latest/meta-data" } }))
    );
    await expect(safeFetch("https://example.com/redirect")).rejects.toThrow(/Anti-SSRF/);
  });

  it("drops credentials when a redirect leaves the original origin", async () => {
    const transport = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 307, headers: { location: "https://other.example.org/landing" } }))
      .mockResolvedValueOnce(new Response("ok", { status: 200, headers: { "content-type": "text/plain" } }));
    setHttpTransportForTesting(transport);

    const res = await safeFetch("https://example.com/start", { headers: { Authorization: "Bearer secret", "X-Trace": "1" } });
    expect(res.status).toBe(200);
    const secondHeaders = transport.mock.calls[1][1].headers as Record<string, string>;
    expect(secondHeaders.Authorization).toBeUndefined();
    expect(secondHeaders["X-Trace"]).toBe("1");
  });

  it("caps response bodies", async () => {
    setHttpTransportForTesting(vi.fn().mockResolvedValue(new Response("x".repeat(2048), { status: 200 })));
    await expect(safeFetch("https://example.com/big", { maxBytes: 1024 })).rejects.toBeInstanceOf(ResponseTooLargeError);
  });

  it("stops after too many redirects", async () => {
    setHttpTransportForTesting(
      vi.fn().mockImplementation(async () => new Response(null, { status: 302, headers: { location: "https://example.com/loop" } }))
    );
    await expect(safeFetch("https://example.com/loop", { maxRedirects: 3 })).rejects.toThrow(/Too many redirects/);
  });

  it("parses JSON responses", async () => {
    setHttpTransportForTesting(
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: 1 }), { status: 201, headers: { "content-type": "application/json" } }))
    );
    const res = await safeFetch("https://example.com/json", { method: "POST", body: "{}" });
    expect(res.status).toBe(201);
    expect(res.data).toEqual({ ok: 1 });
  });
});

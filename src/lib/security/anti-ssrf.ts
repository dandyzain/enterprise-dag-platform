import { BlockList, isIP } from "node:net";

/**
 * Enterprise Anti-SSRF Guard
 *
 * Two layers:
 *  1. `validateSafeUrl` — synchronous check of the URL itself (protocol,
 *     internal hostnames, literal IPs in any notation the WHATWG URL parser
 *     normalises: decimal, hex, IPv4-mapped IPv6...).
 *  2. `isBlockedAddress` — used at *connect time* by the safe HTTP client on
 *     every resolved address, so DNS names that point inside the network
 *     (or DNS-rebinding tricks) and redirects to internal hosts are refused.
 */

const blockList = new BlockList();

// IPv4 special-purpose ranges (RFC 6890 and friends)
const IPV4_BLOCKED: [string, number][] = [
  ["0.0.0.0", 8], // "this" network
  ["10.0.0.0", 8], // private
  ["100.64.0.0", 10], // carrier-grade NAT
  ["127.0.0.0", 8], // loopback
  ["169.254.0.0", 16], // link-local / cloud metadata
  ["172.16.0.0", 12], // private
  ["192.0.0.0", 24], // IETF protocol assignments
  ["192.0.2.0", 24], // TEST-NET-1
  ["192.88.99.0", 24], // 6to4 relay anycast
  ["192.168.0.0", 16], // private
  ["198.18.0.0", 15], // benchmarking
  ["198.51.100.0", 24], // TEST-NET-2
  ["203.0.113.0", 24], // TEST-NET-3
  ["224.0.0.0", 4], // multicast
  ["240.0.0.0", 4], // reserved + broadcast
];
for (const [net, prefix] of IPV4_BLOCKED) blockList.addSubnet(net, prefix, "ipv4");

// IPv6 special-purpose ranges
const IPV6_BLOCKED: [string, number][] = [
  ["::", 128], // unspecified
  ["::1", 128], // loopback
  // NOTE: no ::ffff:0:0/96 rule — Node's BlockList also applies IPv6 rules to IPv4
  // addresses (as mapped addresses), which would block every IPv4 host. Mapped
  // addresses are rejected explicitly in isBlockedAddress instead.
  ["64:ff9b::", 96], // NAT64
  ["100::", 64], // discard
  ["2001:db8::", 32], // documentation
  ["fc00::", 7], // unique local
  ["fe80::", 10], // link-local
  ["ff00::", 8], // multicast
];
for (const [net, prefix] of IPV6_BLOCKED) blockList.addSubnet(net, prefix, "ipv6");

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "localhost.localdomain",
  "metadata",
  "metadata.google.internal",
  "metadata.goog",
  "instance-data",
  "instance-data.ec2.internal",
  "metadata.internal",
  "kubernetes.default",
  "kubernetes.default.svc",
]);

const BLOCKED_SUFFIXES = [".localhost", ".local", ".internal", ".lan", ".home.arpa", ".svc.cluster.local"];

export interface SSRFValidationResult {
  isSafe: boolean;
  reason?: string;
}

function extractMappedIPv4(address: string): string | null {
  // ::ffff:7f00:1 or ::ffff:127.0.0.1
  const lower = address.toLowerCase();
  const dotted = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (dotted) return dotted[1];
  const hex = lower.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (hex) {
    const hi = Number.parseInt(hex[1], 16);
    const lo = Number.parseInt(hex[2], 16);
    return `${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`;
  }
  return null;
}

/** True for any loopback, private, link-local, reserved or otherwise non-public address. */
export function isBlockedAddress(address: string): boolean {
  const bare = address.replace(/^\[|\]$/g, "");
  const family = isIP(bare);
  if (family === 4) return blockList.check(bare, "ipv4");
  if (family === 6) {
    // IPv4-mapped/compatible addresses are never needed for legitimate egress and are a
    // classic filter bypass (::ffff:127.0.0.1), so they are always refused.
    if (extractMappedIPv4(bare)) return true;
    return blockList.check(bare, "ipv6");
  }
  return true; // not an IP at all: refuse
}

export function validateSafeUrl(targetUrl: string): SSRFValidationResult {
  let parsed: URL;
  try {
    parsed = new URL(targetUrl);
  } catch (err) {
    return { isSafe: false, reason: `Malformed URL: ${err instanceof Error ? err.message : "Invalid URL format"}` };
  }

  // 1. Enforce HTTP or HTTPS protocol only
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { isSafe: false, reason: `Forbidden protocol '${parsed.protocol}'. Only http: and https: are permitted.` };
  }

  if (parsed.username || parsed.password) {
    return { isSafe: false, reason: "Credentials embedded in the URL are not allowed; use a header instead." };
  }

  const hostname = parsed.hostname.toLowerCase().replace(/\.$/, "");
  const bareHost = hostname.replace(/^\[|\]$/g, "");

  // 2. Internal hostnames
  if (BLOCKED_HOSTNAMES.has(bareHost) || BLOCKED_SUFFIXES.some((s) => bareHost.endsWith(s))) {
    return { isSafe: false, reason: `Target hostname '${hostname}' is an internal domain and cannot be accessed.` };
  }

  // 3. Literal IP addresses (the URL parser already normalised 2130706433, 0x7f.1, etc.)
  if (isIP(bareHost)) {
    if (isBlockedAddress(bareHost)) {
      return {
        isSafe: false,
        reason: `Target IP address '${hostname}' belongs to a private/internal network subnet.`,
      };
    }
    return { isSafe: true };
  }

  if (!bareHost.includes(".")) {
    return { isSafe: false, reason: `Single-label hostname '${hostname}' is not a public domain.` };
  }

  return { isSafe: true };
}

import { URL } from "node:url";

/**
 * Enterprise Anti-SSRF Guard
 * Protects public worker nodes from probing internal infrastructure, cloud metadata, or private IP spaces.
 */

// Private & reserved IPv4 blocks
const BLOCKED_IP_PREFIXES = [
  "127.",         // Loopback
  "10.",          // Class A Private
  "192.168.",     // Class C Private
  "169.254.",     // Link-local / Cloud Provider Metadata (AWS/GCP/Azure)
  "0.0.0.0",      // All interfaces
];

const BLOCKED_HOSTNAMES = [
  "localhost",
  "metadata.google.internal",
  "instance-data",
  "metadata.internal",
];

export interface SSRFValidationResult {
  isSafe: boolean;
  reason?: string;
}

export function validateSafeUrl(targetUrl: string): SSRFValidationResult {
  try {
    const parsed = new URL(targetUrl);

    // 1. Enforce HTTP or HTTPS protocol only
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return {
        isSafe: false,
        reason: `Forbidden protocol '${parsed.protocol}'. Only http: and https: are permitted.`,
      };
    }

    const hostname = parsed.hostname.toLowerCase();

    // 2. Block loopback and local hostnames
    if (BLOCKED_HOSTNAMES.includes(hostname)) {
      return {
        isSafe: false,
        reason: `Target hostname '${hostname}' is an internal domain and cannot be accessed.`,
      };
    }

    // 3. Block IPv6 loopback
    if (hostname === "::1" || hostname === "[::1]") {
      return {
        isSafe: false,
        reason: "IPv6 loopback [::1] is prohibited.",
      };
    }

    // 4. Block Private IPv4 prefixes
    for (const prefix of BLOCKED_IP_PREFIXES) {
      if (hostname.startsWith(prefix)) {
        return {
          isSafe: false,
          reason: `Target IP address '${hostname}' belongs to a private/internal network subnet.`,
        };
      }
    }

    // 5. Block Class B private range 172.16.0.0 - 172.31.255.255
    const classBMatch = hostname.match(/^172\.(\d+)\./);
    if (classBMatch) {
      const secondOctet = parseInt(classBMatch[1], 10);
      if (secondOctet >= 16 && secondOctet <= 31) {
        return {
          isSafe: false,
          reason: `Target IP '${hostname}' belongs to Class B private range (172.16.0.0/12).`,
        };
      }
    }

    return { isSafe: true };
  } catch (err) {
    return {
      isSafe: false,
      reason: `Malformed URL: ${err instanceof Error ? err.message : "Invalid URL format"}`,
    };
  }
}

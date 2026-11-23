/**
 * Centralised, validated access to runtime configuration.
 *
 * Secrets never fall back to a value that is committed to the repository in
 * production: a missing secret makes the server refuse to start the feature
 * instead of silently running with a publicly known key.
 */
import { logger } from "@/lib/logger";

const isProduction = process.env.NODE_ENV === "production";

/** Development-only signing key. Never used when NODE_ENV=production. */
const DEV_SESSION_SECRET = "nexusflow-dev-only-session-secret-do-not-use-in-production";

let warnedDevSecret = false;

export function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET || process.env.ENCRYPTION_SECRET_KEY;
  if (secret && secret.length >= 32) return secret;

  if (secret && secret.length < 32) {
    throw new Error("SESSION_SECRET must be at least 32 characters long.");
  }

  if (isProduction) {
    throw new Error(
      "SESSION_SECRET is not set. Generate one with `openssl rand -hex 32` and add it to the environment."
    );
  }

  if (!warnedDevSecret) {
    warnedDevSecret = true;
    logger.warn("SESSION_SECRET is not set; using an insecure development key.");
  }
  return DEV_SESSION_SECRET;
}

/** Master key for the credential vault (AES-256-GCM). */
export function getEncryptionMasterKey(): string | undefined {
  return process.env.ENCRYPTION_MASTER_KEY || process.env.CREDENTIAL_ENCRYPTION_KEY || undefined;
}

/**
 * Demo mode enables the three public demo accounts and the role switcher.
 * On by default in development; in production it must be enabled explicitly
 * with DEMO_MODE=true (demo users are confined to the demo workspace).
 */
export function isDemoMode(): boolean {
  const flag = process.env.DEMO_MODE?.trim().toLowerCase();
  if (flag === "true" || flag === "1") return true;
  if (flag === "false" || flag === "0") return false;
  return !isProduction;
}

export function isDatabaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

export function getAppUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/+$/, "");
}

/** Whether the in-process cron scheduler should run in this process. */
export function isSchedulerEnabled(): boolean {
  const flag = process.env.SCHEDULER_ENABLED?.trim().toLowerCase();
  if (flag === "true" || flag === "1") return true;
  if (flag === "false" || flag === "0") return false;
  return true;
}

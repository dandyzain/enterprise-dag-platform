/**
 * Database circuit breaker.
 *
 * The platform can run without PostgreSQL (in-memory fallback for demos and
 * tests). Previously a single failed query flipped a module-level flag to
 * "offline" forever, silently moving every later write into memory. This
 * breaker only opens on *connectivity* errors and closes again after a
 * cool-down, so a transient outage no longer turns into permanent data loss.
 */
import { isDatabaseConfigured } from "@/lib/config/env";
import { logger } from "@/lib/logger";

const COOLDOWN_MS = 15_000;

interface CircuitState {
  openUntil: number;
  forcedOffline: boolean;
  lastError: string | null;
}

const globalForCircuit = globalThis as unknown as { __nfDbCircuit?: CircuitState };
const state: CircuitState =
  globalForCircuit.__nfDbCircuit ?? (globalForCircuit.__nfDbCircuit = { openUntil: 0, forcedOffline: false, lastError: null });

/** True when a query should be attempted against PostgreSQL. */
export function isDbAvailable(): boolean {
  if (state.forcedOffline) return false;
  if (!isDatabaseConfigured()) return false;
  return Date.now() >= state.openUntil;
}

/** Tests and tooling can force the in-memory store. */
export function forceDbOffline(offline: boolean): void {
  state.forcedOffline = offline;
  if (!offline) state.openUntil = 0;
}

export function getDbCircuitState(): { open: boolean; lastError: string | null; configured: boolean } {
  return { open: !isDbAvailable(), lastError: state.lastError, configured: isDatabaseConfigured() };
}

const CONNECTIVITY_CODES = new Set(["P1000", "P1001", "P1002", "P1003", "P1008", "P1010", "P1011", "P1017", "P2024"]);

/** Distinguishes "database unreachable" from ordinary query errors (constraint violations, bad input...). */
export function isConnectivityError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { name?: string; code?: string; message?: string };
  if (e.name === "PrismaClientInitializationError" || e.name === "PrismaClientRustPanicError") return true;
  if (e.code && CONNECTIVITY_CODES.has(e.code)) return true;
  const msg = e.message ?? "";
  return /Can't reach database|ECONNREFUSED|ENOTFOUND|ETIMEDOUT|Connection terminated|connection closed/i.test(msg);
}

export function recordDbFailure(err: unknown): void {
  const message = err instanceof Error ? err.message.split("\n")[0] : String(err);
  if (Date.now() >= state.openUntil) {
    logger.warn("Database unreachable; using in-memory fallback", { cooldownMs: COOLDOWN_MS, error: message });
  }
  state.openUntil = Date.now() + COOLDOWN_MS;
  state.lastError = message;
}

export class DbUnavailableError extends Error {
  constructor() {
    super("Database unavailable");
    this.name = "DbUnavailableError";
  }
}

/**
 * Runs `fn` against the database. Connectivity failures open the breaker and
 * resolve to `{ ok: false }` so the caller can use its fallback; any other
 * error is re-thrown (it is a real bug or a constraint violation).
 */
export async function tryDb<T>(fn: () => Promise<T>): Promise<{ ok: true; value: T } | { ok: false }> {
  if (!isDbAvailable()) return { ok: false };
  try {
    const value = await fn();
    state.lastError = null;
    return { ok: true, value };
  } catch (err) {
    if (isConnectivityError(err)) {
      recordDbFailure(err);
      return { ok: false };
    }
    throw err;
  }
}

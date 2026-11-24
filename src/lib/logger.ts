/**
 * Minimal structured logger.
 *
 * Production: one JSON object per line (ready for Loki/Datadog/CloudWatch).
 * Development: readable single-line output. No dependencies, safe in any runtime.
 */
type Level = "debug" | "info" | "warn" | "error";

const LEVELS: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

function minLevel(): number {
  const env = (process.env.LOG_LEVEL || "").toLowerCase() as Level;
  if (env in LEVELS) return LEVELS[env];
  if (process.env.NODE_ENV === "test") return LEVELS.error;
  return process.env.NODE_ENV === "production" ? LEVELS.info : LEVELS.debug;
}

function serializeError(err: unknown): unknown {
  if (err instanceof Error) {
    return { name: err.name, message: err.message, stack: process.env.NODE_ENV === "production" ? undefined : err.stack };
  }
  return err;
}

function write(level: Level, message: string, fields?: Record<string, unknown>) {
  if (LEVELS[level] < minLevel()) return;
  const normalized: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(fields ?? {})) {
    normalized[k] = k === "err" || k === "error" ? serializeError(v) : v;
  }

  const out = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
  if (process.env.NODE_ENV === "production") {
    out(JSON.stringify({ ts: new Date().toISOString(), level, msg: message, ...normalized }));
  } else {
    const extra = Object.keys(normalized).length > 0 ? ` ${JSON.stringify(normalized)}` : "";
    out(`[${level}] ${message}${extra}`);
  }
}

export const logger = {
  debug: (msg: string, fields?: Record<string, unknown>) => write("debug", msg, fields),
  info: (msg: string, fields?: Record<string, unknown>) => write("info", msg, fields),
  warn: (msg: string, fields?: Record<string, unknown>) => write("warn", msg, fields),
  error: (msg: string, fields?: Record<string, unknown>) => write("error", msg, fields),
};

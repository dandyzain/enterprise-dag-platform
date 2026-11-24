/**
 * Next.js server start-up hook. Starts the cron scheduler inside the web
 * server's Node.js runtime (long-lived deployments: Docker, Railway, Render).
 * Set SCHEDULER_ENABLED=false when a separate worker runs the scheduler or on
 * serverless hosts, which should call /api/cron/tick instead.
 *
 * The `NEXT_RUNTIME === "nodejs"` check must wrap the import directly so the
 * Node-only modules are removed from the edge bundle at compile time.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./instrumentation-node");
  }
}

/**
 * Unit-test environment: in-memory stores only (no PostgreSQL / Redis),
 * deterministic secrets, demo accounts enabled.
 */
process.env.ENCRYPTION_MASTER_KEY = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
process.env.SESSION_SECRET = "unit-test-session-secret-0123456789abcdef";
process.env.DEMO_MODE = "true";
process.env.SCHEDULER_ENABLED = "false";
delete process.env.DATABASE_URL;
delete process.env.REDIS_URL;
delete process.env.REDIS_HOST;

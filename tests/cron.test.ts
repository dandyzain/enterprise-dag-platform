import { describe, it, expect } from "vitest";
import { parseCron, cronMatches, nextCronRun, validateCron } from "@/lib/dag/cron";

const at = (iso: string) => new Date(iso);

describe("Cron scheduler expressions", () => {
  it("matches weekday mornings", () => {
    const s = parseCron("0 9 * * 1-5");
    expect(cronMatches(s, at("2026-11-23T09:00:00Z"))).toBe(true); // Monday
    expect(cronMatches(s, at("2026-11-22T09:00:00Z"))).toBe(false); // Sunday
    expect(cronMatches(s, at("2026-11-23T09:01:00Z"))).toBe(false);
  });

  it("supports steps, lists and shorthands", () => {
    expect(cronMatches(parseCron("*/15 * * * *"), at("2026-01-01T10:45:00Z"))).toBe(true);
    expect(cronMatches(parseCron("*/15 * * * *"), at("2026-01-01T10:46:00Z"))).toBe(false);
    expect(cronMatches(parseCron("0 8,20 * * *"), at("2026-01-01T20:00:00Z"))).toBe(true);
    expect(cronMatches(parseCron("@daily"), at("2026-01-01T00:00:00Z"))).toBe(true);
    expect(cronMatches(parseCron("0 0 * * 7"), at("2026-11-22T00:00:00Z"))).toBe(true); // 7 = Sunday
  });

  it("uses OR semantics when both day fields are restricted", () => {
    const s = parseCron("0 0 1 * 1"); // 1st of the month OR Mondays
    expect(cronMatches(s, at("2026-11-23T00:00:00Z"))).toBe(true); // Monday
    expect(cronMatches(s, at("2026-12-01T00:00:00Z"))).toBe(true); // 1st (Tuesday)
    expect(cronMatches(s, at("2026-11-25T00:00:00Z"))).toBe(false);
  });

  it("computes the next run", () => {
    expect(nextCronRun("30 14 * * *", at("2026-11-23T14:30:00Z"))?.toISOString()).toBe("2026-11-24T14:30:00.000Z");
    expect(nextCronRun("0 * * * *", at("2026-11-23T10:15:00Z"))?.toISOString()).toBe("2026-11-23T11:00:00.000Z");
  });

  it.each(["", "* * * *", "60 * * * *", "* 24 * * *", "*/0 * * * *", "a b c d e", "5-1 * * * *"])("rejects '%s'", (expr) => {
    expect(validateCron(expr)).not.toBeNull();
  });
});

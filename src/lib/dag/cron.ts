/**
 * Minimal 5-field cron parser (minute hour day-of-month month day-of-week),
 * evaluated in UTC. Supports `*`, numbers, ranges `a-b`, lists `a,b`, steps
 * `*\/n` and `a-b/n`, plus the shorthands @hourly, @daily, @weekly, @monthly.
 * Day-of-week accepts 0–7 (0 and 7 are Sunday).
 */

export interface CronSchedule {
  minute: Set<number>;
  hour: Set<number>;
  dayOfMonth: Set<number>;
  month: Set<number>;
  dayOfWeek: Set<number>;
  domRestricted: boolean;
  dowRestricted: boolean;
}

const SHORTHANDS: Record<string, string> = {
  "@hourly": "0 * * * *",
  "@daily": "0 0 * * *",
  "@midnight": "0 0 * * *",
  "@weekly": "0 0 * * 0",
  "@monthly": "0 0 1 * *",
};

function parseField(field: string, min: number, max: number, name: string): Set<number> {
  const values = new Set<number>();
  for (const part of field.split(",")) {
    const [rangePart, stepPart] = part.split("/");
    const step = stepPart === undefined ? 1 : Number(stepPart);
    if (!Number.isInteger(step) || step < 1) throw new Error(`Invalid step in ${name}: '${part}'`);

    let start: number;
    let end: number;
    if (rangePart === "*") {
      start = min;
      end = max;
    } else if (rangePart.includes("-")) {
      const [a, b] = rangePart.split("-").map(Number);
      start = a;
      end = b;
    } else {
      start = Number(rangePart);
      end = stepPart === undefined ? start : max;
    }

    if (!Number.isInteger(start) || !Number.isInteger(end) || start < min || end > max || start > end) {
      throw new Error(`Invalid ${name} value: '${part}' (allowed ${min}-${max})`);
    }
    for (let v = start; v <= end; v += step) values.add(v);
  }
  return values;
}

export function parseCron(expression: string): CronSchedule {
  const normalized = SHORTHANDS[expression.trim().toLowerCase()] ?? expression.trim();
  const fields = normalized.split(/\s+/);
  if (fields.length !== 5) throw new Error("A cron expression needs 5 fields: minute hour day month weekday.");
  const [m, h, dom, mon, dow] = fields;
  const dayOfWeek = parseField(dow, 0, 7, "day-of-week");
  if (dayOfWeek.has(7)) {
    dayOfWeek.delete(7);
    dayOfWeek.add(0);
  }
  return {
    minute: parseField(m, 0, 59, "minute"),
    hour: parseField(h, 0, 23, "hour"),
    dayOfMonth: parseField(dom, 1, 31, "day-of-month"),
    month: parseField(mon, 1, 12, "month"),
    dayOfWeek,
    domRestricted: dom !== "*",
    dowRestricted: dow !== "*",
  };
}

export function validateCron(expression: string): string | null {
  try {
    parseCron(expression);
    return null;
  } catch (err) {
    return err instanceof Error ? err.message : "Invalid cron expression";
  }
}

/** Whether the schedule fires in the minute containing `date` (UTC). */
export function cronMatches(schedule: CronSchedule, date: Date): boolean {
  if (!schedule.minute.has(date.getUTCMinutes())) return false;
  if (!schedule.hour.has(date.getUTCHours())) return false;
  if (!schedule.month.has(date.getUTCMonth() + 1)) return false;
  const domOk = schedule.dayOfMonth.has(date.getUTCDate());
  const dowOk = schedule.dayOfWeek.has(date.getUTCDay());
  // Classic cron semantics: when both day fields are restricted, either may match.
  if (schedule.domRestricted && schedule.dowRestricted) return domOk || dowOk;
  return domOk && dowOk;
}

/** Next firing time strictly after `from` (searches up to ~1 year ahead). */
export function nextCronRun(expression: string, from = new Date()): Date | null {
  const schedule = parseCron(expression);
  const cursor = new Date(from.getTime());
  cursor.setUTCSeconds(0, 0);
  cursor.setUTCMinutes(cursor.getUTCMinutes() + 1);
  for (let i = 0; i < 366 * 24 * 60; i++) {
    if (cronMatches(schedule, cursor)) return new Date(cursor.getTime());
    cursor.setUTCMinutes(cursor.getUTCMinutes() + 1);
  }
  return null;
}

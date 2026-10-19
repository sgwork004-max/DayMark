import { fromISODate, toISODate, addDays } from "./dates.js";

export interface RecurrenceRule {
  interval: number;
  unit: "day" | "week" | "month" | "year";
}

const UNIT_MAP: Record<string, RecurrenceRule["unit"]> = {
  day: "day", days: "day", daily: "day",
  week: "week", weeks: "week", weekly: "week",
  month: "month", months: "month", monthly: "month",
  year: "year", years: "year", yearly: "year", annually: "year",
};

/**
 * Parse @repeat(...) rule string.
 * Accepts: "1 week", "2 days", "week", "daily", "monthly", "every 2 weeks"
 */
export function parseRecurrence(raw: string): RecurrenceRule | null {
  const s = raw.toLowerCase().replace(/^every\s+/, "").trim();

  // "2 weeks", "1 day"
  const numbered = /^(\d+)\s+(\w+)$/.exec(s);
  if (numbered) {
    const unit = UNIT_MAP[numbered[2] ?? ""];
    const interval = parseInt(numbered[1] ?? "1", 10);
    if (unit && interval > 0) return { interval, unit };
  }

  // "week", "daily", "monthly"
  const unit = UNIT_MAP[s];
  if (unit) return { interval: 1, unit };

  return null;
}

/** Given a base date and rule, return the next occurrence date */
export function nextOccurrence(baseDate: string, rule: RecurrenceRule): string {
  const d = fromISODate(baseDate);
  switch (rule.unit) {
    case "day":
      return toISODate(addDays(d, rule.interval));
    case "week":
      return toISODate(addDays(d, rule.interval * 7));
    case "month": {
      const next = new Date(d);
      next.setMonth(next.getMonth() + rule.interval);
      return toISODate(next);
    }
    case "year": {
      const next = new Date(d);
      next.setFullYear(next.getFullYear() + rule.interval);
      return toISODate(next);
    }
  }
}

/** Human-readable label for a recurrence rule */
export function recurrenceLabel(raw: string): string {
  const rule = parseRecurrence(raw);
  if (!rule) return raw;
  if (rule.interval === 1) return `every ${rule.unit}`;
  return `every ${rule.interval} ${rule.unit}s`;
}

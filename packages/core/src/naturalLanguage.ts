import { addDays, fromISODate, toISODate } from "./dates.js";

export interface NaturalTaskResult {
  title: string;
  priority: "P1" | "P2" | "P3" | "Misc";
  scheduledDate?: string;
  scheduledTime?: string;
  dueDate?: string;
  reminderDate?: string;
  reminderTime?: string;
  markdown: string;
}

function shortDate(iso: string): string {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
}

function nextWeekday(referenceDate: string, weekday: number): string {
  const date = fromISODate(referenceDate);
  let delta = (weekday - date.getDay() + 7) % 7;
  if (delta === 0) delta = 7;
  return toISODate(addDays(date, delta));
}

function normalizeTime(hourRaw: string, minuteRaw: string | undefined, meridiem: string | undefined): string {
  let hour = Number(hourRaw);
  const minute = Number(minuteRaw ?? "0");
  if (meridiem?.toLowerCase() === "pm" && hour < 12) hour += 12;
  if (meridiem?.toLowerCase() === "am" && hour === 12) hour = 0;
  return `${String(Math.min(23, hour)).padStart(2, "0")}:${String(Math.min(59, minute)).padStart(2, "0")}`;
}

export function parseNaturalTaskInput(raw: string, referenceDate: string): NaturalTaskResult {
  let text = raw.trim();
  let priority: NaturalTaskResult["priority"] = "P1";
  let scheduledDate: string | undefined;
  let scheduledTime: string | undefined;
  let dueDate: string | undefined;
  let reminderDate: string | undefined;
  let reminderTime: string | undefined;

  const explicitDate = (day: string, month: string): string =>
    `${referenceDate.slice(0, 4)}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;

  text = text.replace(/\b(?:p|priority\s*)([1-4])\b/gi, (_match, value: string) => {
    priority = value === "1" ? "P1" : value === "2" ? "P2" : value === "3" ? "P3" : "Misc";
    return "";
  });

  text = text.replace(/\b(?:due|deadline)\s+(\d{1,2})\/(\d{1,2})\b/gi, (_m, day: string, month: string) => {
    dueDate = explicitDate(day, month);
    return "";
  });

  text = text.replace(/\b(?:schedule|scheduled|on)\s+(\d{1,2})\/(\d{1,2})\b/gi, (_m, day: string, month: string) => {
    scheduledDate = explicitDate(day, month);
    return "";
  });

  text = text.replace(/\bin\s+(\d+)\s+days?\b/gi, (_m, count: string) => {
    scheduledDate = toISODate(addDays(fromISODate(referenceDate), Number(count)));
    return "";
  });

  text = text.replace(/\b(today|tomorrow)\b/gi, (value: string) => {
    scheduledDate = value.toLowerCase() === "today"
      ? referenceDate
      : toISODate(addDays(fromISODate(referenceDate), 1));
    return "";
  });

  const weekdays: Record<string, number> = {
    sun: 0, sunday: 0,
    mon: 1, monday: 1,
    tue: 2, tues: 2, tuesday: 2,
    wed: 3, wednesday: 3,
    thu: 4, thur: 4, thurs: 4, thursday: 4,
    fri: 5, friday: 5,
    sat: 6, saturday: 6,
  };
  text = text.replace(/\b(sun(?:day)?|mon(?:day)?|tue(?:s|sday)?|wed(?:nesday)?|thu(?:r|rs|rsday)?|fri(?:day)?|sat(?:urday)?)\b/gi, (value: string) => {
    scheduledDate = nextWeekday(referenceDate, weekdays[value.toLowerCase()] ?? 1);
    return "";
  });

  text = text.replace(/\bremind(?:\s+me)?(?:\s+at)?\s+(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)?\b/gi,
    (_m, hour: string, minute: string | undefined, meridiem: string | undefined) => {
      reminderTime = normalizeTime(hour, minute, meridiem);
      reminderDate = scheduledDate ?? referenceDate;
      return "";
    });

  text = text.replace(/\b(?:at\s+)?(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)\b/gi,
    (_m, hour: string, minute: string | undefined, meridiem: string | undefined) => {
      scheduledTime = normalizeTime(hour, minute, meridiem);
      scheduledDate ??= referenceDate;
      if (!reminderTime) {
        reminderTime = scheduledTime;
        reminderDate = scheduledDate ?? referenceDate;
      }
      return "";
    });

  text = text.replace(/\bat\s+([01]?\d|2[0-3])[:.]([0-5]\d)\b/gi,
    (_m, hour: string, minute: string) => {
      scheduledTime = normalizeTime(hour, minute, undefined);
      scheduledDate ??= referenceDate;
      if (!reminderTime) {
        reminderTime = scheduledTime;
        reminderDate = scheduledDate;
      }
      return "";
    });

  const title = text.replace(/\s+/g, " ").replace(/\s+[,.;:]$/g, "").trim() || raw.trim();
  const tokens: string[] = [];
  if (scheduledDate) tokens.push(`>${shortDate(scheduledDate)}`);
  if (dueDate) tokens.push(`@due(${shortDate(dueDate)})`);
  if (reminderTime) tokens.push(`@remind(${shortDate(reminderDate ?? referenceDate)} ${reminderTime})`);

  const result: NaturalTaskResult = {
    title,
    priority,
    markdown: `- [ ] ${title}${tokens.length ? ` ${tokens.join(" ")}` : ""}`,
  };
  if (scheduledDate) result.scheduledDate = scheduledDate;
  if (scheduledTime) result.scheduledTime = scheduledTime;
  if (dueDate) result.dueDate = dueDate;
  if (reminderDate) result.reminderDate = reminderDate;
  if (reminderTime) result.reminderTime = reminderTime;
  return result;
}

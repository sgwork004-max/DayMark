/** Pad a number to 2 digits */
export const pad = (n: number) => String(n).padStart(2, "0");

/** Format a Date as YYYY-MM-DD */
export function toISODate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Parse YYYY-MM-DD → Date (local timezone) */
export function fromISODate(str: string): Date {
  const [y, m, d] = str.split("-").map(Number) as [number, number, number];
  return new Date(y, m - 1, d);
}

/** Add n days to a Date */
export function addDays(date: Date, n: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + n);
  return result;
}

/** Today as YYYY-MM-DD */
export function today(): string {
  return toISODate(new Date());
}

/** Format a daily note filename: YYYYMMDD.md */
export function dailyNoteFilename(date: string): string {
  return `${date.replace(/-/g, "")}.md`;
}

/** Format a daily note title: "Friday, June 13, 2025" */
export function dailyNoteTitle(date: string): string {
  const d = fromISODate(date);
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/** Returns ISO date string for the monday of the week containing `date` */
export function weekStart(date: string, firstDay: 0 | 1 = 1): string {
  const d = fromISODate(date);
  const day = d.getDay();
  const diff = (day - firstDay + 7) % 7;
  return toISODate(addDays(d, -diff));
}

/** Weekly note filename: YYYY-Www.md (ISO week) */
export function weeklyNoteFilename(date: string): string {
  const d = fromISODate(date);
  const week = getISOWeek(d);
  return `${d.getFullYear()}-W${pad(week)}.md`;
}

/** Monthly note filename: YYYY-MM.md */
export function monthlyNoteFilename(date: string): string {
  return `${date.slice(0, 7)}.md`;
}

/** Quarterly note filename: YYYY-Q1.md etc */
export function quarterlyNoteFilename(date: string): string {
  const month = Number(date.slice(5, 7));
  const q = Math.ceil(month / 3);
  return `${date.slice(0, 4)}-Q${q}.md`;
}

/** Yearly note filename: YYYY.md */
export function yearlyNoteFilename(date: string): string {
  return `${date.slice(0, 4)}.md`;
}

/** Human-readable relative label: "Today", "Yesterday", "Tomorrow", or the date */
export function relativeLabel(date: string): string {
  const t = today();
  if (date === t) return "Today";
  const d = fromISODate(date);
  const todayDate = fromISODate(t);
  const diff = Math.round((d.getTime() - todayDate.getTime()) / 86400000);
  if (diff === -1) return "Yesterday";
  if (diff === 1) return "Tomorrow";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** ISO week number (1–53) */
function getISOWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

export function isValidDate(str: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str);
  if (!match?.[1] || !match[2] || !match[3]) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

export function isValidShortDate(str: string, year = new Date().getFullYear()): boolean {
  const match = /^(\d{2})\/(\d{2})$/.exec(str);
  if (!match?.[1] || !match[2]) return false;
  return isValidDate(`${year}-${match[2]}-${match[1]}`);
}

export function isValidTime(str: string): boolean {
  const match = /^(\d{2}):(\d{2})$/.exec(str);
  if (!match?.[1] || !match[2]) return false;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59;
}

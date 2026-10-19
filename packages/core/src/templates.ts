import { today, dailyNoteTitle, toISODate } from "./dates.js";

export interface TemplateVars {
  date?: string;
  title?: string;
  time?: string;
  week?: string;
  month?: string;
  year?: string;
  [key: string]: string | undefined;
}

const VAR_RE = /\{\{(\w+)(?::([^}]+))?\}\}/g;

/** Substitute {{variable}} placeholders in template content */
export function applyTemplate(template: string, vars: TemplateVars = {}): string {
  const now = new Date();
  const dateStr = vars.date ?? today();

  const builtins: Record<string, string> = {
    date:  dateStr,
    title: vars.title ?? dailyNoteTitle(dateStr),
    time:  vars.time  ?? `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`,
    week:  vars.week  ?? String(getISOWeek(now)),
    month: vars.month ?? now.toLocaleDateString("en-US", { month: "long" }),
    year:  vars.year  ?? String(now.getFullYear()),
    ...vars,
  };

  return template.replace(VAR_RE, (_, key: string, fallback?: string) => {
    return builtins[key] ?? fallback ?? `{{${key}}}`;
  });
}

/** Extract list of variable names used in a template */
export function templateVars(template: string): string[] {
  const vars = new Set<string>();
  for (const m of template.matchAll(VAR_RE)) vars.add(m[1] as string);
  return [...vars];
}

function getISOWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

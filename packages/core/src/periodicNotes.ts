import { today, fromISODate, weekStart, pad } from "./dates.js";

export type PeriodicType = "daily" | "weekly" | "monthly" | "quarterly" | "yearly";

/** Return the ISO date string that identifies a periodic note */
export function periodicNoteDate(type: PeriodicType, referenceDate?: string): string {
  const date = referenceDate ?? today();
  const d = fromISODate(date);

  switch (type) {
    case "daily":     return date;
    case "weekly":    return weekStart(date);
    case "monthly":   return `${date.slice(0, 7)}-01`;
    case "quarterly": {
      const month = d.getMonth();
      const qStartMonth = Math.floor(month / 3) * 3;
      return `${d.getFullYear()}-${pad(qStartMonth + 1)}-01`;
    }
    case "yearly":    return `${d.getFullYear()}-01-01`;
  }
}

/** Folder name for a periodic note type */
export function periodicFolder(type: PeriodicType): string {
  switch (type) {
    case "daily":     return "Daily";
    case "weekly":    return "Weekly";
    case "monthly":   return "Monthly";
    case "quarterly": return "Quarterly";
    case "yearly":    return "Yearly";
  }
}

/** File name for a periodic note */
export function periodicFilename(type: PeriodicType, referenceDate?: string): string {
  const date = referenceDate ?? today();
  const d = fromISODate(date);

  switch (type) {
    case "daily":     return `${date.replace(/-/g, "")}.md`;
    case "weekly": {
      const ws = weekStart(date);
      const wd = fromISODate(ws);
      const week = getISOWeek(wd);
      return `${wd.getFullYear()}-W${pad(week)}.md`;
    }
    case "monthly":   return `${date.slice(0, 7)}.md`;
    case "quarterly": {
      const month = d.getMonth();
      const q = Math.floor(month / 3) + 1;
      return `${d.getFullYear()}-Q${q}.md`;
    }
    case "yearly":    return `${d.getFullYear()}.md`;
  }
}

/** Human-readable title for a periodic note */
export function periodicNoteTitle(type: PeriodicType, referenceDate?: string): string {
  const date = referenceDate ?? today();
  const d = fromISODate(date);

  switch (type) {
    case "daily":
      return d.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
    case "weekly": {
      const ws = fromISODate(weekStart(date));
      const we = new Date(ws); we.setDate(we.getDate() + 6);
      return `Week ${getISOWeek(ws)}, ${ws.getFullYear()} (${ws.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${we.toLocaleDateString("en-US", { month: "short", day: "numeric" })})`;
    }
    case "monthly":
      return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    case "quarterly": {
      const q = Math.floor(d.getMonth() / 3) + 1;
      return `Q${q} ${d.getFullYear()}`;
    }
    case "yearly":
      return String(d.getFullYear());
  }
}

/** Default template content for a periodic note */
export function periodicDefaultContent(type: PeriodicType, referenceDate?: string): string {
  const title = periodicNoteTitle(type, referenceDate);
  switch (type) {
    case "daily":
      return `# ${title}\n\n## Today's Agenda\n### P1\n- [ ] \n\n### P2\n- [ ] \n\n### P3\n- [ ] \n\n### Misc\n- [ ] \n\n## Notes\n\n`;
    case "weekly":
      return `# ${title}\n\n## Goals This Week\n\n## Reflection\n\n## Tasks\n\n`;
    case "monthly":
      return `# ${title}\n\n## Monthly Goals\n\n## Projects\n\n## Reflection\n\n`;
    case "quarterly":
      return `# ${title}\n\n## Quarterly Goals\n\n## Key Results\n\n## Review\n\n`;
    case "yearly":
      return `# ${title}\n\n## Year Goals\n\n## Themes\n\n## Review\n\n`;
  }
}

function getISOWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

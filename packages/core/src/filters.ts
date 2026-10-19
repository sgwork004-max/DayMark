import type { Task, Note } from "./types.js";
import type { TaskResult } from "./taskQueries.js";
import { today } from "./dates.js";

export interface FilterToken {
  kind: "tag" | "mention" | "state" | "due" | "content" | "title" | "recurrence";
  value: string;
  negate: boolean;
}

const DUE_KEYWORDS: Record<string, () => boolean> = {};

/** Parse a filter string into tokens.
 *
 * Grammar:
 *   #tag         filter by tag (exact)
 *   @mention     filter by mention
 *   state:open|done|cancelled
 *   due:today|week|overdue
 *   content:text full-text match in task content
 *   title:text   note title match
 *   ↻ / repeat:  has recurrence
 *   Prefix with - to negate: -#tag
 */
export function parseFilter(raw: string): FilterToken[] {
  const tokens: FilterToken[] = [];
  const parts = raw.trim().split(/\s+/);

  for (const part of parts) {
    if (!part) continue;
    let negate = false;
    let p = part;
    if (p.startsWith("-")) { negate = true; p = p.slice(1); }

    if (p.startsWith("#")) {
      tokens.push({ kind: "tag", value: p.slice(1).toLowerCase(), negate });
    } else if (p.startsWith("@")) {
      tokens.push({ kind: "mention", value: p.slice(1).toLowerCase(), negate });
    } else if (p.startsWith("state:")) {
      tokens.push({ kind: "state", value: p.slice(6).toLowerCase(), negate });
    } else if (p.startsWith("due:")) {
      tokens.push({ kind: "due", value: p.slice(4).toLowerCase(), negate });
    } else if (p.startsWith("content:")) {
      tokens.push({ kind: "content", value: p.slice(8).toLowerCase(), negate });
    } else if (p.startsWith("title:")) {
      tokens.push({ kind: "title", value: p.slice(6).toLowerCase(), negate });
    } else if (p === "repeat:" || p === "↻") {
      tokens.push({ kind: "recurrence", value: "true", negate });
    } else if (p.length > 1) {
      // bare word → content search
      tokens.push({ kind: "content", value: p.toLowerCase(), negate });
    }
  }

  return tokens;
}

function matchesDue(task: Task, value: string): boolean {
  const d = task.dueDate ?? task.scheduledDate;
  if (!d) return false;
  const t = today();
  if (value === "today")   return d === t;
  if (value === "overdue") return d < t;
  if (value === "week") {
    const weekEnd = new Date();
    weekEnd.setDate(weekEnd.getDate() + 7);
    return d >= t && d <= weekEnd.toISOString().slice(0, 10);
  }
  // exact date
  return d === value;
}

function matchesToken(token: FilterToken, task: Task, note: Note): boolean {
  let match: boolean;
  switch (token.kind) {
    case "tag":
      match = task.tags.some((t) => t.toLowerCase() === token.value) ||
              note.tags.some((t) => t.toLowerCase() === token.value);
      break;
    case "mention":
      match = task.mentions.some((m) => m.toLowerCase() === token.value) ||
              note.mentions.some((m) => m.toLowerCase() === token.value);
      break;
    case "state":
      match = task.state === token.value;
      break;
    case "due":
      match = matchesDue(task, token.value);
      break;
    case "content":
      match = task.content.toLowerCase().includes(token.value) ||
              task.raw.toLowerCase().includes(token.value);
      break;
    case "title":
      match = note.title.toLowerCase().includes(token.value);
      break;
    case "recurrence":
      match = !!task.recurrence;
      break;
    default:
      match = false;
  }
  return token.negate ? !match : match;
}

export function applyFilter(results: TaskResult[], filterStr: string): TaskResult[] {
  const tokens = parseFilter(filterStr);
  if (tokens.length === 0) return results;
  return results.filter(({ task, note }) =>
    tokens.every((token) => matchesToken(token, task, note))
  );
}

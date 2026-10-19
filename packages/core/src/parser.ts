import type { Task, TaskState } from "./types.js";
import { isValidDate } from "./dates.js";

const TAG_RE = /#([\w/-]+)/g;
const MENTION_RE = /@(?!done|due|repeat|start|remind)([\w-]+)/g;
const DATE_TOKEN_RE = /\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}/;

// >YYYY-MM-DD or >DD/MM → scheduledDate
const SCHEDULED_RE = />\s*(\d{4}-\d{2}-\d{2}|\d{2}\/\d{2})/;
// @due(YYYY-MM-DD) or @due(DD/MM)
const DUE_RE = /@due\((\d{4}-\d{2}-\d{2}|\d{2}\/\d{2})\)/;
// @remind(YYYY-MM-DD HH:mm) or @remind(DD/MM HH:mm)
const REMIND_RE = /@remind\(([^)]+)\)/;
// @done(YYYY-MM-DD), @done(DD/MM), or @done
const DONE_RE = /@done(?:\((\d{4}-\d{2}-\d{2}|\d{2}\/\d{2})\))?/;
// @repeat(N unit) or @repeat(unit)
const REPEAT_RE = /@repeat\(([^)]+)\)/i;

const TASK_LINE_RE = /^(\s*)-\s+\[([\ xX\-\>])\]\s*(.*)$/;

function stateFromChar(ch: string): TaskState {
  switch (ch.toLowerCase()) {
    case "x": return "done";
    case "-": return "cancelled";
    case ">": return "scheduled";
    default:  return "open";
  }
}

let _idCounter = 0;
function uid() { return `task-${++_idCounter}`; }

function yearFromContext(noteDate?: string): string {
  return noteDate?.slice(0, 4) ?? String(new Date().getFullYear());
}

function normalizeDateToken(raw: string | undefined, noteDate?: string): string | undefined {
  if (!raw) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

  const short = /^(\d{2})\/(\d{2})$/.exec(raw);
  if (!short?.[1] || !short[2]) return undefined;

  const normalized = `${yearFromContext(noteDate)}-${short[2]}-${short[1]}`;
  return isValidDate(normalized) ? normalized : undefined;
}

function normalizeReminderToken(raw: string | undefined, noteDate?: string): string | undefined {
  const trimmed = raw?.trim();
  if (!trimmed) return undefined;

  const m = new RegExp(`^(${DATE_TOKEN_RE.source})(?:[ T](\\d{1,2}:\\d{2}))?$`).exec(trimmed);
  if (!m?.[1]) return trimmed;

  const date = normalizeDateToken(m[1], noteDate);
  if (!date) return trimmed;
  return m[2] ? `${date}T${m[2]}` : date;
}

export function parseTasks(content: string, noteDate?: string): Task[] {
  const lines = content.split("\n");
  const tasks: Task[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    const m = TASK_LINE_RE.exec(line);
    if (!m) continue;

    const stateChar = m[2] ?? " ";
    const body = m[3] ?? "";
    const state = stateFromChar(stateChar);

    const tags: string[] = [];
    const mentions: string[] = [];

    for (const t of body.matchAll(TAG_RE))      tags.push(t[1] as string);
    for (const mt of body.matchAll(MENTION_RE)) mentions.push(mt[1] as string);

    const scheduledMatch = SCHEDULED_RE.exec(body);
    const dueMatch       = DUE_RE.exec(body);
    const remindMatch    = REMIND_RE.exec(body);
    const doneMatch      = DONE_RE.exec(body);
    const repeatMatch    = REPEAT_RE.exec(body);

    // Strip all metadata tokens from display content
    const cleanContent = body
      .replace(SCHEDULED_RE, "")
      .replace(DUE_RE, "")
      .replace(REMIND_RE, "")
      .replace(DONE_RE, "")
      .replace(REPEAT_RE, "")
      .trim();

    // Blank template checkboxes are typing affordances, not real tasks.
    if (!cleanContent) continue;

    const task: Task = {
      id: uid(),
      content: cleanContent,
      state,
      tags,
      mentions,
      lineIndex: i,
      raw: line,
    };

    const scheduledDate = normalizeDateToken(scheduledMatch?.[1], noteDate);
    const dueDate       = normalizeDateToken(dueMatch?.[1], noteDate);
    const reminderDate  = normalizeReminderToken(remindMatch?.[1], noteDate);
    const doneDate      = normalizeDateToken(doneMatch?.[1], noteDate);

    if (scheduledDate) task.scheduledDate = scheduledDate;
    if (dueDate)       task.dueDate       = dueDate;
    if (reminderDate)  task.reminderDate  = reminderDate;
    if (noteDate)            task.noteDate       = noteDate;
    if (doneDate)            task.completionDate = doneDate;
    if (repeatMatch?.[1])    task.recurrence     = repeatMatch[1].trim();

    tasks.push(task);
  }

  return tasks;
}

export function extractTags(content: string): string[] {
  const tags = new Set<string>();
  for (const m of content.matchAll(TAG_RE)) tags.add(m[1] as string);
  return [...tags];
}

export function extractMentions(content: string): string[] {
  const mentions = new Set<string>();
  for (const m of content.matchAll(MENTION_RE)) mentions.add(m[1] as string);
  return [...mentions];
}

/** Toggle a task's checkbox state in raw markdown. Returns updated content. */
export function toggleTask(content: string, lineIndex: number): string {
  const lines = content.split("\n");
  const line = lines[lineIndex];
  if (!line) return content;
  const updated = /\[ \]/.test(line)
    ? line.replace("[ ]", "[x]")
    : line.replace(/\[x\]/i, "[ ]");
  lines[lineIndex] = updated;
  return lines.join("\n");
}

/** Schedule a task to a specific date — inserts or replaces >YYYY-MM-DD on a line */
export function scheduleTask(content: string, lineIndex: number, date: string): string {
  const lines = content.split("\n");
  const line = lines[lineIndex];
  if (!line) return content;
  const updated = SCHEDULED_RE.test(line)
    ? line.replace(SCHEDULED_RE, `>${date}`)
    : line.trimEnd() + ` >${date}`;
  lines[lineIndex] = updated;
  return lines.join("\n");
}

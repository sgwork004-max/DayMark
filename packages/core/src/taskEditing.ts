import type { Task } from "./types.js";

export interface TaskMetadataUpdate {
  scheduled?: string;
  deadline?: string;
  reminderDate?: string;
  reminderTime?: string;
  project?: string;
}

function shortDate(value: string | undefined): string {
  if (!value) return "";
  if (/^\d{2}\/\d{2}$/.test(value)) return value;
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  return iso?.[2] && iso[3] ? `${iso[3]}/${iso[2]}` : value;
}

function projectToken(value: string | undefined): string {
  const slug = value
    ?.trim()
    .replace(/^#?project\//i, "")
    .replace(/[^\w-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug ? `#project/${slug}` : "";
}

export function taskProject(task: Task): string | null {
  const tag = task.tags.find((value) => value.toLowerCase().startsWith("project/"));
  if (!tag) return null;
  return tag.slice("project/".length).replace(/-/g, " ");
}

export function taskDisplayContent(task: Task): string {
  return task.content.replace(/(?:^|\s)#project\/[\w-]+/gi, "").replace(/\s+/g, " ").trim();
}

export function updateTaskMetadata(
  content: string,
  lineIndex: number,
  metadata: TaskMetadataUpdate,
): string {
  const lines = content.split("\n");
  const line = lines[lineIndex];
  if (!line) return content;

  let updated = line
    .replace(/\s*>\s*(?:\d{4}-\d{2}-\d{2}|\d{2}\/\d{2})/g, "")
    .replace(/\s*@due\([^)]+\)/g, "")
    .replace(/\s*@remind\([^)]+\)/g, "")
    .replace(/\s*#project\/[\w-]+/gi, "")
    .trimEnd();

  const tokens: string[] = [];
  const scheduled = shortDate(metadata.scheduled);
  const deadline = shortDate(metadata.deadline);
  const reminderDate = shortDate(metadata.reminderDate || metadata.scheduled);
  if (scheduled) tokens.push(`>${scheduled}`);
  if (deadline) tokens.push(`@due(${deadline})`);
  if (reminderDate && metadata.reminderTime) {
    tokens.push(`@remind(${reminderDate} ${metadata.reminderTime})`);
  }
  const project = projectToken(metadata.project);
  if (project) tokens.push(project);

  lines[lineIndex] = `${updated}${tokens.length ? ` ${tokens.join(" ")}` : ""}`;
  return lines.join("\n");
}

export function setTaskCompleted(
  content: string,
  lineIndex: number,
  completed: boolean,
  date: string,
): string {
  const lines = content.split("\n");
  const line = lines[lineIndex];
  if (!line) return content;
  lines[lineIndex] = completed
    ? `${line.replace(/\[[ >-]\]/, "[x]").replace(/\s*@done(?:\([^)]+\))?/, "").trimEnd()} @done(${date})`
    : line.replace(/\[x\]/i, "[ ]").replace(/\s*@done(?:\([^)]+\))?/, "");
  return lines.join("\n");
}

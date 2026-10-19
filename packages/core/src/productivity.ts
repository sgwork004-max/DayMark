import { parseTasks } from "./parser.js";

export interface DailyMetrics {
  total: number;
  completed: number;
  open: number;
  p1Total: number;
  p1Completed: number;
  score: number;
}

export interface CarryoverInsight {
  content: string;
  occurrences: number;
}

function normalizeTask(value: string): string {
  return value
    .replace(/\s+>(?:\d{4}-\d{2}-\d{2}|\d{2}\/\d{2})/g, "")
    .replace(/\s+@(done|due|remind|repeat)\([^)]*\)/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function calculateDailyMetrics(content: string, noteDate?: string): DailyMetrics {
  const tasks = parseTasks(content, noteDate);
  const lines = content.split("\n");
  let lane = "";
  const p1Lines = new Set<number>();
  lines.forEach((line, index) => {
    const heading = /^###\s+(P1|P2|P3|Misc)\s*$/i.exec(line.trim());
    if (heading?.[1]) lane = heading[1].toUpperCase();
    else if (/^#{1,3}\s+/.test(line.trim())) lane = "";
    if (lane === "P1" && /^\s*-\s+\[[ xX>\-]\]/.test(line)) p1Lines.add(index);
  });

  const completed = tasks.filter((task) => task.state === "done").length;
  const p1 = tasks.filter((task) => p1Lines.has(task.lineIndex));
  const p1Completed = p1.filter((task) => task.state === "done").length;
  const completionRatio = tasks.length ? completed / tasks.length : 0;
  const p1Ratio = p1.length ? p1Completed / p1.length : completionRatio;
  const score = tasks.length
    ? Math.round(Math.min(100, completionRatio * 70 + p1Ratio * 25 + (completed > 0 ? 5 : 0)))
    : 0;

  return {
    total: tasks.length,
    completed,
    open: tasks.filter((task) => task.state === "open").length,
    p1Total: p1.length,
    p1Completed,
    score,
  };
}

export function findCarryoverInsights(
  currentContent: string,
  priorNotes: Array<{ date: string; content: string }>,
  noteDate?: string,
): CarryoverInsight[] {
  const priorCounts = new Map<string, number>();
  for (const note of priorNotes) {
    const seen = new Set<string>();
    for (const task of parseTasks(note.content, note.date)) {
      if (task.state === "done" || !task.content) continue;
      seen.add(normalizeTask(task.content));
    }
    for (const key of seen) priorCounts.set(key, (priorCounts.get(key) ?? 0) + 1);
  }

  return parseTasks(currentContent, noteDate)
    .filter((task) => task.state === "open" && task.content)
    .map((task) => ({ content: task.content, occurrences: priorCounts.get(normalizeTask(task.content)) ?? 0 }))
    .filter((item) => item.occurrences >= 2)
    .sort((a, b) => b.occurrences - a.occurrences);
}

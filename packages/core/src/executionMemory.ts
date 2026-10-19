import { parseTasks } from "./parser.js";

export interface MemoryNote {
  date: string;
  content: string;
}

export interface MemorySignal {
  text: string;
  date: string;
}

export interface RecurringLoop extends MemorySignal {
  occurrences: number;
}

export interface ExecutionMemoryBrief {
  handoff: MemorySignal | null;
  wins: MemorySignal[];
  learnings: MemorySignal[];
  recurringLoops: RecurringLoop[];
}

function reviewValue(content: string, label: "Win" | "Learned" | "Tomorrow"): string | null {
  const pattern = new RegExp(`^\\s*-\\s+\\*\\*${label}:\\*\\*\\s+(.+)$`, "im");
  return pattern.exec(content)?.[1]?.trim() ?? null;
}

function cleanTaskContent(raw: string): string {
  return raw
    .replace(/^\s*-\s+\[[ xX>\-]\]\s+/, "")
    .replace(/\s+>\s*(?:\d{4}-\d{2}-\d{2}|\d{2}\/\d{2})/g, "")
    .replace(/\s+@(due|remind|done|repeat)\([^)]*\)/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizedTask(raw: string): string {
  return cleanTaskContent(raw)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function buildExecutionMemory(notes: MemoryNote[], beforeDate?: string): ExecutionMemoryBrief {
  const history = notes
    .filter((note) => !beforeDate || note.date < beforeDate)
    .sort((a, b) => b.date.localeCompare(a.date));

  const wins: MemorySignal[] = [];
  const learnings: MemorySignal[] = [];
  const loops = new Map<string, RecurringLoop>();
  let handoff: MemorySignal | null = null;

  for (const note of history) {
    const tomorrow = reviewValue(note.content, "Tomorrow");
    if (!handoff && tomorrow) handoff = { text: tomorrow, date: note.date };

    const win = reviewValue(note.content, "Win");
    if (win && wins.length < 3) wins.push({ text: win, date: note.date });

    const learned = reviewValue(note.content, "Learned");
    if (learned && learnings.length < 3) learnings.push({ text: learned, date: note.date });

    for (const task of parseTasks(note.content, note.date)) {
      if (task.state === "done" || task.state === "cancelled") continue;
      const key = normalizedTask(task.raw);
      if (!key) continue;
      const existing = loops.get(key);
      if (existing) {
        existing.occurrences += 1;
      } else {
        loops.set(key, {
          text: cleanTaskContent(task.raw),
          date: note.date,
          occurrences: 1,
        });
      }
    }
  }

  const recurringLoops = [...loops.values()]
    .filter((loop) => loop.occurrences >= 2)
    .sort((a, b) => b.occurrences - a.occurrences || b.date.localeCompare(a.date))
    .slice(0, 4);

  return { handoff, wins, learnings, recurringLoops };
}

import type { Note, Task } from "./types.js";
import { today, fromISODate } from "./dates.js";

export interface TaskResult {
  task: Task;
  note: Note;
}

export interface SearchResult {
  type: "note" | "task";
  note: Note;
  task?: Task;
  /** Snippet of matched text with surrounding context */
  snippet: string;
  score: number;
}

function allTasks(notes: Map<string, Note>): TaskResult[] {
  const results: TaskResult[] = [];
  for (const note of notes.values()) {
    for (const task of note.tasks) {
      results.push({ task, note });
    }
  }
  return results;
}

/** Tasks that are open and whose scheduledDate or noteDate is before today */
export function getOverdueTasks(notes: Map<string, Note>): TaskResult[] {
  const t = today();
  return allTasks(notes).filter(({ task }) => {
    if (task.state !== "open") return false;
    const date = task.scheduledDate ?? task.noteDate;
    if (!date) return false;
    return date < t;
  }).sort((a, b) => {
    const da = a.task.scheduledDate ?? a.task.noteDate ?? "";
    const db = b.task.scheduledDate ?? b.task.noteDate ?? "";
    return da.localeCompare(db);
  });
}

/** Open tasks scheduled for today */
export function getTodayTasks(notes: Map<string, Note>): TaskResult[] {
  const t = today();
  return allTasks(notes).filter(({ task }) => {
    if (task.state !== "open") return false;
    const date = task.scheduledDate ?? task.noteDate;
    return date === t;
  });
}

/** Open tasks scheduled within the next `days` days (not overdue) */
export function getUpcomingTasks(notes: Map<string, Note>, days = 7): TaskResult[] {
  const t = today();
  const todayMs = fromISODate(t).getTime();
  const limitMs = todayMs + days * 86400000;

  return allTasks(notes).filter(({ task }) => {
    if (task.state !== "open") return false;
    const date = task.scheduledDate ?? task.dueDate;
    if (!date) return false;
    const ms = fromISODate(date).getTime();
    return ms >= todayMs && ms <= limitMs;
  }).sort((a, b) => {
    const da = a.task.scheduledDate ?? a.task.dueDate ?? "";
    const db = b.task.scheduledDate ?? b.task.dueDate ?? "";
    return da.localeCompare(db);
  });
}

/** All tasks with a given #tag */
export function getTasksByTag(notes: Map<string, Note>, tag: string): TaskResult[] {
  return allTasks(notes).filter(({ task }) =>
    task.tags.some((t) => t.toLowerCase() === tag.toLowerCase()),
  );
}

/** All tasks with a given @mention */
export function getTasksByMention(notes: Map<string, Note>, mention: string): TaskResult[] {
  return allTasks(notes).filter(({ task }) =>
    task.mentions.some((m) => m.toLowerCase() === mention.toLowerCase()),
  );
}

/** All unique tags across all notes, with counts */
export function getAllTags(notes: Map<string, Note>): { tag: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const note of notes.values()) {
    for (const tag of note.tags) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count);
}

/** All unique @mentions across all notes, with counts */
export function getAllMentions(notes: Map<string, Note>): { mention: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const note of notes.values()) {
    for (const m of note.mentions) {
      counts.set(m, (counts.get(m) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([mention, count]) => ({ mention, count }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Simple full-text fuzzy search across notes + tasks.
 * Returns results sorted by relevance score.
 */
export function searchNotes(notes: Map<string, Note>, query: string): SearchResult[] {
  if (!query.trim()) return [];
  const q = query.toLowerCase().trim();
  const words = q.split(/\s+/).filter(Boolean);
  const results: SearchResult[] = [];

  for (const note of notes.values()) {
    // Score the note title
    const titleLower = note.title.toLowerCase();
    let titleScore = 0;
    if (titleLower === q) titleScore = 100;
    else if (titleLower.startsWith(q)) titleScore = 80;
    else if (words.every((w) => titleLower.includes(w))) titleScore = 60;
    else if (words.some((w) => titleLower.includes(w))) titleScore = 20;

    if (titleScore > 0) {
      results.push({
        type: "note",
        note,
        snippet: note.title,
        score: titleScore,
      });
    }

    // Score tasks
    for (const task of note.tasks) {
      const contentLower = task.content.toLowerCase();
      let taskScore = 0;
      if (contentLower === q) taskScore = 90;
      else if (words.every((w) => contentLower.includes(w))) taskScore = 50;
      else if (words.some((w) => contentLower.includes(w))) taskScore = 15;

      if (taskScore > 0) {
        results.push({
          type: "task",
          note,
          task,
          snippet: task.content,
          score: taskScore,
        });
      }
    }

    // Score note body (lower weight)
    if (titleScore === 0) {
      const bodyLower = note.content.toLowerCase();
      if (words.every((w) => bodyLower.includes(w))) {
        const idx = bodyLower.indexOf(words[0] ?? "");
        const snippet = note.content.slice(Math.max(0, idx - 20), idx + 80).trim();
        results.push({
          type: "note",
          note,
          snippet,
          score: 10,
        });
      }
    }
  }

  return results
    .sort((a, b) => b.score - a.score)
    .slice(0, 30);
}

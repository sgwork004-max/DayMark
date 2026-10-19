import { parseTasks } from "./parser.js";

export const TODAY_AGENDA_HEADING = "## Today's Agenda";
export const TODAY_AGENDA_PRIORITIES = ["P1", "P2", "P3", "Misc"] as const;
export type TodayAgendaPriority = typeof TODAY_AGENDA_PRIORITIES[number];

export interface AgendaTaskInsertResult {
  content: string;
  lineIndex: number;
  lane: TodayAgendaPriority;
  inserted: boolean;
}

function laneForExternalPriority(priority?: number): TodayAgendaPriority {
  if (priority === 4) return "P1";
  if (priority === 3) return "P2";
  if (priority === 2) return "P3";
  return "Misc";
}

function taskify(line: string): string | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  if (/^-\s+\[[ xX>\-]\]\s*/.test(trimmed)) return trimmed;
  const text = trimmed.replace(/^[-*+]\s+/, "").trim();
  return text && !/^[-*+]$/.test(text) ? `- [ ] ${text}` : null;
}

function cleanEmptyAgendaTasks(content: string): string {
  const lines = content
    .split("\n")
    .map((line) => /^\s*-\s+\[ \]\s*[-*+]\s*$/.test(line) ? "- [ ] " : line);
  const agendaStart = headingIndex(lines, TODAY_AGENDA_HEADING);
  const nextSectionOffset = agendaStart === -1
    ? -1
    : lines.slice(agendaStart + 1).findIndex((line) => /^##\s+/.test(line));
  const agendaEnd = agendaStart === -1 || nextSectionOffset === -1
    ? lines.length
    : agendaStart + 1 + nextSectionOffset;
  if (agendaStart !== -1) {
    for (let index = agendaStart + 1; index < agendaEnd; index++) {
      const label = /^(P1|P2|P3|Misc)\s*$/i.exec(lines[index]?.trim() ?? "")?.[1];
      const canonical = label && TODAY_AGENDA_PRIORITIES.find((priority) => priority.toLowerCase() === label.toLowerCase());
      if (canonical) lines[index] = `### ${canonical}`;
    }
  }
  return lines
    .join("\n")
    .replace(/(## Today's Agenda)\n+(### P1)/i, "$1\n$2");
}

function headingRange(lines: string[], heading: string): { start: number; end: number } | null {
  const start = headingIndex(lines, heading);
  return start === -1 ? null : { start, end: nextHeadingIndex(lines, start) };
}

function priorityBlock(label: string, tasks: string[]): string[] {
  return [`### ${label}`, ...(tasks.length > 0 ? tasks : ["- [ ] "]), ""];
}

/** Upgrade the old Focus + Agenda layout without losing existing text. */
export function migrateDailyAgenda(content: string): string {
  if (headingIndex(content.split("\n"), TODAY_AGENDA_HEADING) !== -1) return cleanEmptyAgendaTasks(content);

  const lines = content.split("\n");
  const focus = headingRange(lines, "## Day's Focus");
  const agenda = headingRange(lines, "## Agenda");
  if (!focus && !agenda) return content;

  const collect = (range: { start: number; end: number } | null) => range
    ? lines.slice(range.start + 1, range.end).map(taskify).filter((line): line is string => line !== null)
    : [];
  const focusTasks = collect(focus);
  const agendaTasks = collect(agenda);
  const insertion = Math.min(focus?.start ?? Number.MAX_SAFE_INTEGER, agenda?.start ?? Number.MAX_SAFE_INTEGER);

  const ranges = [focus, agenda]
    .filter((range): range is { start: number; end: number } => range !== null)
    .sort((a, b) => b.start - a.start);
  for (const range of ranges) lines.splice(range.start, range.end - range.start);

  const block = [
    TODAY_AGENDA_HEADING,
    ...priorityBlock("P1", focusTasks),
    ...priorityBlock("P2", agendaTasks),
    ...priorityBlock("P3", []),
    ...priorityBlock("Misc", []),
  ];
  lines.splice(insertion, 0, ...block);
  return lines.join("\n").replace(/\n{4,}/g, "\n\n\n");
}

/** Insert an external task into the priority lane under the drop position. */
export function insertExternalAgendaTask(
  content: string,
  taskTitle: string,
  externalPriority?: number,
  targetLine?: number,
): AgendaTaskInsertResult {
  const title = taskTitle.replace(/\s+/g, " ").trim();
  const lines = migrateDailyAgenda(content).split("\n");
  const agendaStart = headingIndex(lines, TODAY_AGENDA_HEADING);
  if (!title || agendaStart === -1) {
    return { content: lines.join("\n"), lineIndex: -1, lane: laneForExternalPriority(externalPriority), inserted: false };
  }

  const nextH2 = lines.slice(agendaStart + 1).findIndex((line) => /^##\s+/.test(line));
  const agendaEnd = nextH2 === -1 ? lines.length : agendaStart + 1 + nextH2;
  let lane: TodayAgendaPriority | undefined;
  if (targetLine !== undefined && targetLine >= agendaStart && targetLine < agendaEnd) {
    for (let index = targetLine; index > agendaStart; index--) {
      const match = /^###\s+(P1|P2|P3|Misc)\s*$/i.exec(lines[index]?.trim() ?? "");
      const candidate = match?.[1];
      if (candidate) {
        lane = TODAY_AGENDA_PRIORITIES.find((value) => value.toLowerCase() === candidate.toLowerCase());
        if (lane) break;
      }
    }
  }
  lane ??= laneForExternalPriority(externalPriority);

  const duplicate = lines.findIndex((line) =>
    /^\s*-\s+\[[ xX>\-]\]\s+/.test(line)
    && line.replace(/^\s*-\s+\[[ xX>\-]\]\s+/, "").trim() === title,
  );
  if (duplicate !== -1) return { content: lines.join("\n"), lineIndex: duplicate, lane, inserted: false };

  const laneIndex = lines.findIndex((line, index) =>
    index > agendaStart && index < agendaEnd && line.trim().toLowerCase() === `### ${lane}`.toLowerCase(),
  );
  if (laneIndex === -1) return { content: lines.join("\n"), lineIndex: -1, lane, inserted: false };

  let laneEnd = laneIndex + 1;
  while (laneEnd < agendaEnd && !/^#{1,3}\s+/.test(lines[laneEnd] ?? "")) laneEnd++;
  const placeholder = lines.findIndex((line, index) =>
    index > laneIndex && index < laneEnd && /^\s*-\s+\[ \]\s*$/.test(line),
  );
  const taskLine = `- [ ] ${title}`;
  let insertedAt = placeholder;
  if (placeholder !== -1) {
    lines[placeholder] = taskLine;
  } else {
    insertedAt = laneEnd;
    while (insertedAt > laneIndex + 1 && !(lines[insertedAt - 1] ?? "").trim()) insertedAt--;
    lines.splice(insertedAt, 0, taskLine);
  }
  return { content: lines.join("\n"), lineIndex: insertedAt, lane, inserted: true };
}

function headingIndex(lines: string[], heading: string): number {
  const expected = heading.trim().toLowerCase();
  return lines.findIndex((line) => line.trim().toLowerCase() === expected);
}

function nextHeadingIndex(lines: string[], start: number): number {
  for (let index = start + 1; index < lines.length; index++) {
    if (/^#{1,6}\s+/.test(lines[index] ?? "")) return index;
  }
  return lines.length;
}

export function sectionLines(content: string, heading: string): string[] {
  const lines = content.split("\n");
  const start = headingIndex(lines, heading);
  if (start === -1) return [];
  return lines.slice(start + 1, nextHeadingIndex(lines, start)).filter((line) => line.trim());
}

export function replaceSection(content: string, heading: string, body: string[]): string {
  const lines = content.split("\n");
  const start = headingIndex(lines, heading);
  const cleanBody = body.map((line) => line.trimEnd()).filter(Boolean);

  if (start === -1) {
    return `${content.trimEnd()}\n\n${heading}\n${cleanBody.join("\n")}\n`;
  }

  const end = nextHeadingIndex(lines, start);
  lines.splice(start + 1, end - start - 1, "", ...cleanBody, "");
  return lines.join("\n").replace(/\n{4,}/g, "\n\n\n");
}

export function setDailyFocus(content: string, outcomes: string[]): string {
  const lines = outcomes
    .map((outcome) => outcome.trim())
    .filter(Boolean)
    .slice(0, 3)
    .map((outcome) => `- ${outcome}`);
  return replaceSection(content, "## Day's Focus", lines);
}

export interface DailyReview {
  win: string;
  learned: string;
  tomorrow: string;
  completedAt: string;
}

export function appendDailyReview(content: string, review: DailyReview): string {
  const body = [
    review.win.trim() ? `- **Win:** ${review.win.trim()}` : "",
    review.learned.trim() ? `- **Learned:** ${review.learned.trim()}` : "",
    review.tomorrow.trim() ? `- **Tomorrow:** ${review.tomorrow.trim()}` : "",
    `- **Closed:** ${review.completedAt}`,
  ].filter(Boolean);
  return replaceSection(content, "## Daily Review", body);
}

function stripSchedule(raw: string): string {
  return raw
    .replace(/^([ \t]*)-\s+\[[ xX\->]\]\s+/, "$1- [ ] ")
    .replace(/\s*>\s*(?:\d{4}-\d{2}-\d{2}|\d{2}\/\d{2})/, "")
    .replace(/\s*@done(?:\([^)]*\))?/, "")
    .trimEnd();
}

function insertAgendaTasks(content: string, tasks: string[], lane: TodayAgendaPriority = "P1"): string {
  if (tasks.length === 0) return content;
  const migrated = migrateDailyAgenda(content);
  const heading = `### ${lane}`;
  const currentAgenda = sectionLines(migrated, heading).filter((line) => line.trim() && taskify(line)?.trim() !== "- [ ]");
  const existing = new Set(currentAgenda.map((line) => stripSchedule(line).toLowerCase()));
  const unique = tasks.filter((line) => !existing.has(stripSchedule(line).toLowerCase()));
  return replaceSection(migrated, heading, [...unique, ...currentAgenda]);
}

export interface RolloverResult {
  sourceContent: string;
  targetContent: string;
  count: number;
}

export function rolloverOpenTasks(
  sourceContent: string,
  targetContent: string,
  sourceDate: string,
  targetDate: string,
): RolloverResult {
  const tasks = parseTasks(sourceContent, sourceDate).filter((task) => task.state === "open");
  if (tasks.length === 0) return { sourceContent, targetContent, count: 0 };

  const sourceLines = sourceContent.split("\n");
  for (const task of tasks) {
    const raw = sourceLines[task.lineIndex];
    if (!raw) continue;
    const scheduled = raw.replace("[ ]", "[>]");
    sourceLines[task.lineIndex] = /(?:^|\s)>\s*(?:\d{4}-\d{2}-\d{2}|\d{2}\/\d{2})/.test(scheduled)
      ? scheduled.replace(/>\s*(?:\d{4}-\d{2}-\d{2}|\d{2}\/\d{2})/, `>${targetDate}`)
      : `${scheduled.trimEnd()} >${targetDate}`;
  }

  const copied = tasks.map((task) => stripSchedule(task.raw));
  return {
    sourceContent: sourceLines.join("\n"),
    targetContent: insertAgendaTasks(targetContent, copied, "Misc"),
    count: copied.length,
  };
}

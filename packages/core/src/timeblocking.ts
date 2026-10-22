import type { TimeBlock } from "./types.js";

// Matches: "10am", "10:30am", "10:30 am", "14:00", "2pm"
const TIME_RE = /\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i;

// Full time-block line: "10am - Write report" or "10:30-11:00 Call with John"
// DayMark syntax: line starting with a time or containing "at HH:MM"
const TIMEBLOCK_LINE_RE =
  /^(?:\s*-?\s*)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*(?:-\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?)?\s*[-–]?\s*(.+)$/i;

function parseHour(h: number, m: string | undefined): number {
  const period = (m ?? "").toLowerCase();
  if (period === "pm" && h !== 12) return h + 12;
  if (period === "am" && h === 12) return 0;
  return h;
}

/** Parse time-block annotations from note content */
export function parseTimeBlocks(content: string): TimeBlock[] {
  const blocks: TimeBlock[] = [];
  const lines = content.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    if (!line.trim()) continue;

    const m = TIMEBLOCK_LINE_RE.exec(line);
    if (!m) continue;

    const startH = parseInt(m[1] ?? "0", 10);
    const startMin = parseInt(m[2] ?? "0", 10);
    const startPeriod = m[3];
    const endH = m[4] !== undefined ? parseInt(m[4], 10) : undefined;
    const endMin = m[5] !== undefined ? parseInt(m[5], 10) : undefined;
    const endPeriod = m[6];
    const textContent = (m[7] ?? "").trim();

    if (startH > 23 || startMin > 59) continue;
    if (!textContent) continue;

    const block: TimeBlock = {
      startHour:   parseHour(startH, startPeriod),
      startMinute: startMin,
      content: textContent,
      lineIndex: i,
    };

    if (endH !== undefined && endMin !== undefined) {
      block.endHour   = parseHour(endH, endPeriod);
      block.endMinute = endMin;
    } else {
      // Default duration: 30 minutes
      const totalMin = block.startHour * 60 + block.startMinute + 30;
      block.endHour   = Math.floor(totalMin / 60) % 24;
      block.endMinute = totalMin % 60;
    }

    blocks.push(block);
  }

  return blocks;
}

/** Format a TimeBlock as a string for display */
export function formatTimeBlock(block: TimeBlock): string {
  const fmt = (h: number, m: number) => {
    const period = h >= 12 ? "pm" : "am";
    const displayH = h === 0 ? 12 : h > 12 ? h - 12 : h;
    const displayM = m === 0 ? "" : `:${String(m).padStart(2, "0")}`;
    return `${displayH}${displayM}${period}`;
  };
  const start = fmt(block.startHour, block.startMinute);
  const end   = block.endHour !== undefined && block.endMinute !== undefined
    ? ` – ${fmt(block.endHour, block.endMinute)}`
    : "";
  return `${start}${end}`;
}

/** Insert or update a time annotation on a specific line */
export function addTimeToTask(content: string, lineIndex: number, hour: number, minute: number): string {
  const lines = content.split("\n");
  const line = lines[lineIndex];
  if (!line) return content;

  const period = hour >= 12 ? "pm" : "am";
  const displayH = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  const displayM = minute === 0 ? "" : `:${String(minute).padStart(2, "0")}`;
  const timeStr = `${displayH}${displayM}${period}`;

  // If line already has a time, replace it; otherwise prepend
  const updated = TIME_RE.test(line)
    ? line.replace(TIME_RE, timeStr)
    : line.replace(/^(\s*-\s+\[[\ x\-\>]\]\s+)/, `$1${timeStr} `);

  lines[lineIndex] = updated;
  return lines.join("\n");
}

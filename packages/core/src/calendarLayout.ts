import type { CalendarEvent } from "./types.js";

export interface CalendarEventLayout {
  event: CalendarEvent;
  top: number;
  height: number;
  leftPct: number;
  widthPct: number;
  startsAt: Date;
  endsAt: Date;
  column: number;
  columnCount: number;
}

interface WorkingEvent {
  event: CalendarEvent;
  startsAt: Date;
  endsAt: Date;
  start: number;
  end: number;
  column: number;
  columnCount: number;
}

function minutesIntoStartDay(startsAt: Date, endsAt: Date): number {
  const startMidnight = new Date(startsAt.getFullYear(), startsAt.getMonth(), startsAt.getDate()).getTime();
  return Math.round((endsAt.getTime() - startMidnight) / 60_000);
}

/**
 * Lay out timed events into non-overlapping columns. Every connected collision
 * cluster uses the same column count, preventing wider events from covering a
 * neighbouring event later in the same cluster.
 */
export function layoutCalendarEvents(
  events: CalendarEvent[],
  dayStartMinutes = 7 * 60,
  dayEndMinutes = 22 * 60,
  pixelsPerHour = 52,
): CalendarEventLayout[] {
  const working: WorkingEvent[] = events
    .flatMap((event) => {
      const startsAt = new Date(event.startISO);
      const endsAt = new Date(event.endISO);
      if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) return [];
      const start = startsAt.getHours() * 60 + startsAt.getMinutes();
      const end = Math.max(start + 15, minutesIntoStartDay(startsAt, endsAt));
      return [{ event, startsAt, endsAt, start, end, column: 0, columnCount: 1 }];
    })
    .filter((item) => item.end > dayStartMinutes && item.start < dayEndMinutes)
    .sort((a, b) => a.start - b.start || b.end - a.end);

  const clusters: WorkingEvent[][] = [];
  let current: WorkingEvent[] = [];
  let clusterEnd = -Infinity;

  for (const item of working) {
    if (current.length === 0 || item.start < clusterEnd) {
      current.push(item);
      clusterEnd = Math.max(clusterEnd, item.end);
    } else {
      clusters.push(current);
      current = [item];
      clusterEnd = item.end;
    }
  }
  if (current.length > 0) clusters.push(current);

  for (const cluster of clusters) {
    const columnEnds: number[] = [];
    for (const item of cluster) {
      let column = columnEnds.findIndex((end) => end <= item.start);
      if (column < 0) column = columnEnds.length;
      item.column = column;
      columnEnds[column] = item.end;
    }
    for (const item of cluster) item.columnCount = Math.max(1, columnEnds.length);
  }

  return working.map((item) => {
    const visibleStart = Math.max(item.start, dayStartMinutes);
    const visibleEnd = Math.min(item.end, dayEndMinutes);
    const widthPct = 100 / item.columnCount;
    return {
      event: item.event,
      startsAt: item.startsAt,
      endsAt: item.endsAt,
      top: ((visibleStart - dayStartMinutes) / 60) * pixelsPerHour,
      height: Math.max(24, ((visibleEnd - visibleStart) / 60) * pixelsPerHour),
      leftPct: item.column * widthPct,
      widthPct,
      column: item.column,
      columnCount: item.columnCount,
    };
  });
}

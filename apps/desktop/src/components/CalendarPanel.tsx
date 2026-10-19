import React, { useEffect, useState, useMemo, useCallback } from "react";
import { CalendarPlus, ChevronLeft, ChevronRight, X } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { today, toISODate, fromISODate, layoutCalendarEvents } from "@daymark/core";
import { parseTimeBlocks, formatTimeBlock, addTimeToTask } from "@daymark/core";
import type { CalendarEvent, TimeBlock } from "@daymark/core";
import { useNotesStore } from "../store/notesStore.js";
import {
  EventComposer,
  type CalendarChoice,
  type EventDraft,
} from "./EventComposer.js";

const HOURS = Array.from({ length: 16 }, (_, i) => i + 7); // 7am – 10pm
const HOUR_H = 52; // px per hour
const DAY_NAMES = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(message)), ms);
    promise
      .then((value) => resolve(value))
      .catch((error) => reject(error))
      .finally(() => window.clearTimeout(timer));
  });
}

function hourLabel(h: number) {
  if (h === 0)  return "12 AM";
  if (h < 12)  return `${h} AM`;
  if (h === 12) return "12 PM";
  return `${h - 12} PM`;
}

function blockTop(startH: number, startM: number): number {
  return ((startH - 7) * 60 + startM) * (HOUR_H / 60);
}

function blockHeight(startH: number, startM: number, endH: number, endM: number): number {
  const dur = (endH * 60 + endM) - (startH * 60 + startM);
  return Math.max(28, dur * (HOUR_H / 60));
}

/** ISO week number (Mon-based) for a date */
function isoWeekNum(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

// ─── Mini Month Calendar ─────────────────────────────────────────────────────

interface MonthCalProps {
  year: number;
  month: number; // 0-based
  selected: string; // ISO date
  todayISO: string;
  eventDates: Set<string>;
  onSelectDay: (iso: string) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onTodayClick: () => void;
}

function MiniMonthCal({
  year, month, selected, todayISO, eventDates,
  onSelectDay, onPrevMonth, onNextMonth, onTodayClick,
}: MonthCalProps) {
  const monthName = new Date(year, month, 1).toLocaleString("en-US", {
    month: "long", year: "numeric",
  });

  // Build calendar grid: 6 weeks × 7 days
  const firstDate = new Date(year, month, 1);
  const startDow = firstDate.getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Pad start with days from previous month
  const calDays: Date[] = [];
  for (let i = 0; i < startDow; i++) {
    calDays.push(new Date(year, month, 1 - (startDow - i)));
  }
  for (let d = 1; d <= daysInMonth; d++) {
    calDays.push(new Date(year, month, d));
  }
  // Pad to full 6 weeks
  while (calDays.length < 42) {
    const last = calDays[calDays.length - 1]!;
    calDays.push(new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1));
  }

  // Split into weeks
  const weeks: Date[][] = [];
  for (let i = 0; i < 42; i += 7) {
    weeks.push(calDays.slice(i, i + 7));
  }

  return (
    <div className="cal-month">
      {/* Month nav */}
      <div className="cal-month-header">
        <button className="cal-nav-btn" onClick={onPrevMonth} aria-label="Previous month"><ChevronLeft size={14} strokeWidth={2} /></button>
        <button className="cal-month-title" onClick={onTodayClick}>{monthName}</button>
        <button className="cal-nav-btn" onClick={onNextMonth} aria-label="Next month"><ChevronRight size={14} strokeWidth={2} /></button>
      </div>

      {/* Weekday headers */}
      <div className="cal-month-grid">
        <div className="cal-cw-header">CW</div>
        {DAY_NAMES.map((d) => (
          <div key={d} className="cal-dow-header">{d}</div>
        ))}

        {/* Weeks */}
        {weeks.map((week, wi) => (
          <React.Fragment key={wi}>
            <div className="cal-cw-num">{isoWeekNum(week[0]!)}</div>
            {week.map((date) => {
              const iso = toISODate(date);
              const isCurMonth = date.getMonth() === month;
              const isToday = iso === todayISO;
              const isSelected = iso === selected;
              const hasEvents = eventDates.has(iso);
              return (
                <button
                  key={iso}
                  className={[
                    "cal-day-cell",
                    isCurMonth ? "" : "other-month",
                    isToday ? "today" : "",
                    isSelected ? "selected" : "",
                  ].filter(Boolean).join(" ")}
                  onClick={() => onSelectDay(iso)}
                  aria-label={iso}
                >
                  <span className="cal-day-num">{date.getDate()}</span>
                  {hasEvents && <span className="cal-dot" />}
                </button>
              );
            })}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

// ─── Day Timeline ─────────────────────────────────────────────────────────────

interface DayTimelineProps {
  date: string;
  events: CalendarEvent[];
  blocks: TimeBlock[];
  onDropTime: (hour: number, minute: number) => void;
  onDragStart: (lineIndex: number) => void;
  onCreateAtTime: (hour: number, minute: number) => void;
  loading: boolean;
}

function DayTimeline({ date, events, blocks, onDropTime, onDragStart, onCreateAtTime, loading }: DayTimelineProps) {
  const d = fromISODate(date);
  const dayLabel = d.toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric",
  });
  const todayISO = today();
  const isToday = date === todayISO;

  const timedEvents = events.filter((e) => !e.isAllDay);
  const allDayEvents = events.filter((e) => e.isAllDay);
  const timedEventLayouts = useMemo(
    () => layoutCalendarEvents(timedEvents, 7 * 60, 22 * 60, HOUR_H),
    [timedEvents],
  );

  // Current time line
  const [nowMinutes, setNowMinutes] = useState(() => {
    const n = new Date();
    return n.getHours() * 60 + n.getMinutes();
  });
  useEffect(() => {
    if (!isToday) return;
    const timer = setInterval(() => {
      const n = new Date();
      setNowMinutes(n.getHours() * 60 + n.getMinutes());
    }, 60000);
    return () => clearInterval(timer);
  }, [isToday]);

  const nowTop = ((nowMinutes - 7 * 60) / 60) * HOUR_H;
  const showNowLine = isToday && nowMinutes >= 7 * 60 && nowMinutes <= 22 * 60;

  return (
    <div className="cal-timeline">
      {/* Timeline header */}
      <div className="cal-timeline-header">
        <span className="cal-timeline-label">
          {isToday ? "Today" : dayLabel}
          {!isToday && <span className="cal-timeline-full-date"> — {dayLabel}</span>}
        </span>
        {loading && <span className="cal-loading-dot" title="Loading…" />}
      </div>

      {/* All-day events */}
      {allDayEvents.length > 0 && (
        <div className="cal-allday-strip">
          <div className="cal-allday-tag">All-day</div>
          <div className="cal-allday-events">
            {allDayEvents.map((ev) => (
              <div key={ev.id} className="cal-allday-chip">{ev.title}</div>
            ))}
          </div>
        </div>
      )}

      {/* Scrollable hour grid */}
      <div className="cal-grid-scroll">
        <div className="cal-grid-inner" style={{ height: `${HOURS.length * HOUR_H}px` }}>
          {/* Hour rows */}
          {HOURS.map((h) => (
            <div
              key={h}
              className="cal-hour-row"
              style={{ top: `${(h - 7) * HOUR_H}px`, height: `${HOUR_H}px` }}
            >
              <span className="cal-hour-label">{hourLabel(h)}</span>
              <div className="cal-hour-line" />
            </div>
          ))}

          {/* Current time line */}
          {showNowLine && (
            <div className="cal-now-line" style={{ top: `${nowTop}px` }}>
              <div className="cal-now-dot" />
            </div>
          )}

          {/* Drop zone */}
          <div
            className="cal-drop-zone"
            onDragOver={(e) => e.preventDefault()}
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const offsetY = e.clientY - rect.top;
              const totalMinutes = (offsetY / HOUR_H) * 60 + 7 * 60;
              const hour = Math.floor(totalMinutes / 60);
              const minute = Math.round((totalMinutes % 60) / 15) * 15;
              onCreateAtTime(Math.min(hour, 23), Math.min(minute, 45));
            }}
            onDrop={(e) => {
              e.preventDefault();
              const rect = e.currentTarget.getBoundingClientRect();
              const offsetY = e.clientY - rect.top;
              const totalMinutes = (offsetY / HOUR_H) * 60 + 7 * 60;
              const hour   = Math.floor(totalMinutes / 60);
              const minute = Math.round((totalMinutes % 60) / 15) * 15;
              onDropTime(Math.min(hour, 23), Math.min(minute, 45));
            }}
          />

          {/* Calendar events */}
          <div className="cal-events-layer">
            {timedEventLayouts.map((item) => {
              const ev = item.event;
              const timeStr = item.startsAt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
                + " – " + item.endsAt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
              const compact = item.widthPct <= 34 || item.height < 42;
              return (
                <div
                  key={ev.id}
                  className={`cal-event ${compact ? "compact" : ""}`}
                  style={{
                    top: `${item.top}px`,
                    height: `${item.height}px`,
                    left: `${item.leftPct}%`,
                    width: `calc(${item.widthPct}% - 3px)`,
                  }}
                  title={`${ev.title}\n${ev.calendar}\n${timeStr}`}
                >
                  <span className="cal-event-title">{ev.title}</span>
                  {!compact && <span className="cal-event-time">{timeStr}</span>}
                </div>
              );
            })}
          </div>

          {/* Note time blocks */}
          {blocks.map((block) => {
            const top    = blockTop(block.startHour, block.startMinute);
            const height = blockHeight(
              block.startHour, block.startMinute,
              block.endHour ?? block.startHour,
              block.endMinute ?? block.startMinute + 30,
            );
            return (
              <div
                key={block.lineIndex}
                className="cal-timeblock"
                style={{ top: `${top}px`, height: `${height}px` }}
                draggable
                onDragStart={() => onDragStart(block.lineIndex)}
                title={block.content}
              >
                <span className="cal-block-title">{block.content}</span>
                <span className="cal-block-time">{formatTimeBlock(block)}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

export function CalendarPanel({ onClose }: { onClose: () => void }) {
  const { activeNoteId, notes, saveNote, settings, updateSettings } = useNotesStore();
  const activeNote = activeNoteId ? notes.get(activeNoteId) : null;

  const todayISO = today();

  // Selected day defaults to active daily note date or today
  const [selectedDay, setSelectedDay] = useState<string>(
    () => activeNote?.date ?? todayISO,
  );

  // Month shown in mini-calendar
  const [viewDate, setViewDate] = useState<{ year: number; month: number }>(() => {
    const d = fromISODate(selectedDay);
    return { year: d.getFullYear(), month: d.getMonth() };
  });

  const [calEvents, setCalEvents] = useState<CalendarEvent[]>([]);
  const [calendars, setCalendars] = useState<CalendarChoice[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dragTaskLine, setDragTaskLine] = useState<number | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createStart, setCreateStart] = useState(() => `${todayISO}T09:00`);
  const [createEnd, setCreateEnd] = useState(() => `${todayISO}T10:00`);

  const loadMonthEvents = useCallback(async () => {
    if (!settings.calendarEnabled) {
      setCalEvents([]);
      setLoading(false);
      setLoadError(null);
      return;
    }

    const { year, month } = viewDate;
    const from = `${year}-${String(month + 1).padStart(2, "0")}-01`;
    const lastDay = new Date(year, month + 1, 0).getDate();
    const to = `${year}-${String(month + 1).padStart(2, "0")}-${lastDay}`;

    setLoading(true);
    setLoadError(null);
    try {
      const evs = await withTimeout(
        invoke<CalendarEvent[]>("get_calendar_events", { dateFrom: from, dateTo: to }),
        9000,
        "Calendar took too long to respond.",
      );
      setCalEvents(evs);
    } catch (error) {
      setCalEvents([]);
      setLoadError(error instanceof Error ? error.message : "Calendar could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [settings.calendarEnabled, viewDate]);

  // Fetch for full month + neighbours so dot indicators are complete
  useEffect(() => {
    void loadMonthEvents();
  }, [loadMonthEvents]);

  useEffect(() => {
    if (!settings.calendarEnabled) return;
    invoke<CalendarChoice[]>("list_calendars")
      .then(setCalendars)
      .catch(() => {
        setCalendars([]);
      });
  }, [settings.calendarEnabled]);

  // Dates that have at least one event (for dot indicators)
  const eventDates = useMemo<Set<string>>(() => {
    const set = new Set<string>();
    for (const ev of calEvents) {
      const d = new Date(ev.startISO);
      const iso = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
      set.add(iso);
    }
    return set;
  }, [calEvents]);

  // Events for the selected day — compare only the date portion (ISO may include TZ offset)
  const selectedEvents = useMemo(
    () => calEvents.filter((e) => {
      const d = new Date(e.startISO);
      const iso = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
      return iso === selectedDay;
    }),
    [calEvents, selectedDay],
  );

  // Time blocks from active note (only shown if it's also the selected day)
  const timeBlocks: TimeBlock[] = useMemo(() => {
    if (!activeNote || activeNote.date !== selectedDay) return [];
    return parseTimeBlocks(activeNote.content);
  }, [activeNote, selectedDay]);

  const onDropTime = useCallback(
    (hour: number, minute: number) => {
      if (dragTaskLine === null || !activeNote || activeNote.date !== selectedDay) return;
      const updated = addTimeToTask(activeNote.content, dragTaskLine, hour, minute);
      saveNote(activeNote.id, updated);
      setDragTaskLine(null);
    },
    [dragTaskLine, activeNote, selectedDay, saveNote],
  );

  const selectDay = useCallback((iso: string) => {
    setSelectedDay(iso);
    const d = fromISODate(iso);
    setViewDate({ year: d.getFullYear(), month: d.getMonth() });
  }, []);

  const prevMonth = () =>
    setViewDate(({ year, month }) =>
      month === 0 ? { year: year - 1, month: 11 } : { year, month: month - 1 },
    );
  const nextMonth = () =>
    setViewDate(({ year, month }) =>
      month === 11 ? { year: year + 1, month: 0 } : { year, month: month + 1 },
    );
  const goToday = () => {
    const d = fromISODate(todayISO);
    setSelectedDay(todayISO);
    setViewDate({ year: d.getFullYear(), month: d.getMonth() });
  };

  // Navigate to the selected day in the editor when clicking a day that has a note
  const handleSelectDay = useCallback(
    (iso: string) => {
      selectDay(iso);
      setCreateStart(`${iso}T09:00`);
      setCreateEnd(`${iso}T10:00`);
    },
    [selectDay],
  );

  const openCreateAtTime = useCallback((hour: number, minute: number) => {
    const hh = String(hour).padStart(2, "0");
    const mm = String(minute).padStart(2, "0");
    const end = new Date(fromISODate(selectedDay));
    end.setHours(hour, minute + 45, 0, 0);
    const endIso = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, "0")}-${String(end.getDate()).padStart(2, "0")}T${String(end.getHours()).padStart(2, "0")}:${String(end.getMinutes()).padStart(2, "0")}`;
    setCreateStart(`${selectedDay}T${hh}:${mm}`);
    setCreateEnd(endIso);
    setShowCreate(true);
  }, [selectedDay]);

  const createEvent = useCallback(async (draft: EventDraft) => {
    setCreating(true);
    setLoadError(null);
    try {
      const notes = [
        draft.description,
        draft.attachmentUrl ? `Attachment: ${draft.attachmentUrl}` : "",
      ].filter(Boolean).join("\n\n");
      await invoke("create_calendar_event", {
        title: draft.title,
        startIso: draft.start,
        endIso: draft.end,
        calendarId: draft.calendarId,
        notes: notes || null,
        location: draft.location || null,
        url: draft.attachmentUrl || null,
        alarmMinutes: draft.alarmMinutes,
      });
      setShowCreate(false);
      await loadMonthEvents();
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Could not create calendar event.");
    } finally {
      setCreating(false);
    }
  }, [loadMonthEvents]);

  return (
    <div className="cal-panel">
      {/* Close button at top-right */}
      <div className="cal-top-bar">
        <button className="cal-today-pill" onClick={goToday}>Today</button>
        <div className="cal-top-actions">
          {settings.calendarEnabled && (
            <button className="cal-new-btn" onClick={() => setShowCreate((value) => !value)} aria-label="New event" title="New event">
              <CalendarPlus size={14} strokeWidth={2} />
              <span>New</span>
            </button>
          )}
          <button className="cal-close-btn" onClick={onClose} aria-label="Close"><X size={14} strokeWidth={2} /></button>
        </div>
      </div>

      {/* Month mini-calendar */}
      <MiniMonthCal
        year={viewDate.year}
        month={viewDate.month}
        selected={selectedDay}
        todayISO={todayISO}
        eventDates={eventDates}
        onSelectDay={handleSelectDay}
        onPrevMonth={prevMonth}
        onNextMonth={nextMonth}
        onTodayClick={goToday}
      />

      {/* Divider */}
      <div className="cal-divider" />

      {settings.calendarEnabled && showCreate && (
        <EventComposer
          key={`${createStart}-${createEnd}`}
          initialStart={createStart}
          initialEnd={createEnd}
          calendars={calendars}
          saving={creating}
          error={loadError}
          onClose={() => setShowCreate(false)}
          onSave={createEvent}
        />
      )}

      {!settings.calendarEnabled && (
        <div className="cal-disabled">
          <div className="cal-disabled-title">Calendar is off</div>
          <p>Enable it only when you want Apple Calendar inside this app.</p>
          <button
            className="cal-enable-btn"
            onClick={() => updateSettings({ calendarEnabled: true })}
          >
            Enable Calendar
          </button>
        </div>
      )}

      {settings.calendarEnabled && loadError && (
        <div className="cal-error">
          <span>{loadError}</span>
          <span>Check macOS Calendar permission if events do not appear.</span>
        </div>
      )}

      {/* Day timeline */}
      {settings.calendarEnabled && (
        <DayTimeline
          date={selectedDay}
          events={selectedEvents}
          blocks={timeBlocks}
          loading={loading}
          onDropTime={onDropTime}
          onDragStart={setDragTaskLine}
          onCreateAtTime={openCreateAtTime}
        />
      )}
    </div>
  );
}

import React, { useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, X } from "lucide-react";
import { fromISODate, toISODate } from "@daymark/core";

type ViewMode = "month" | "year";

interface Props {
  activityScores: Map<string, number>;
  onOpenDate: (date: string) => void;
  onClose: () => void;
}

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

export function ActivityCalendar({ activityScores, onOpenDate, onClose }: Props) {
  const entryDates = useMemo(() => new Set(activityScores.keys()), [activityScores]);
  const today = new Date();
  const [mode, setMode] = useState<ViewMode>("month");
  const [cursor, setCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const activeYear = cursor.getFullYear();
  const activeMonth = cursor.getMonth();

  const yearCount = useMemo(
    () => [...entryDates].filter((date) => fromISODate(date).getFullYear() === activeYear).length,
    [activeYear, entryDates],
  );

  function move(delta: number) {
    setCursor((current) => mode === "month"
      ? new Date(current.getFullYear(), current.getMonth() + delta, 1)
      : new Date(current.getFullYear() + delta, current.getMonth(), 1));
  }

  const heading = mode === "month"
    ? cursor.toLocaleDateString("en-US", { month: "long", year: "numeric" })
    : String(activeYear);

  return (
    <div className="activity-calendar-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className="activity-calendar" role="dialog" aria-modal="true" aria-label="Daily note activity">
        <header className="activity-calendar-header">
          <span className="activity-calendar-mark"><CalendarDays size={18} /></span>
          <div>
            <h2>Daily note history</h2>
            <p>{entryDates.size} {entryDates.size === 1 ? "day" : "days"} with entries · {yearCount} in {activeYear}</p>
          </div>
          <button onClick={onClose} aria-label="Close"><X size={16} /></button>
        </header>

        <div className="activity-calendar-toolbar">
          <div className="activity-calendar-mode">
            <button className={mode === "month" ? "active" : ""} onClick={() => setMode("month")}>Month</button>
            <button className={mode === "year" ? "active" : ""} onClick={() => setMode("year")}>Year</button>
          </div>
          <div className="activity-calendar-nav">
            <button onClick={() => move(-1)} aria-label="Previous"><ChevronLeft size={15} /></button>
            <strong>{heading}</strong>
            <button onClick={() => move(1)} aria-label="Next"><ChevronRight size={15} /></button>
          </div>
          <button className="activity-today" onClick={() => setCursor(new Date(today.getFullYear(), today.getMonth(), 1))}>Today</button>
        </div>

        <div className="activity-calendar-body">
          {mode === "month" ? (
            <MonthGrid
              year={activeYear}
              month={activeMonth}
              entryDates={entryDates}
              activityScores={activityScores}
              onOpenDate={onOpenDate}
            />
          ) : (
            <div className="activity-year-grid">
              {Array.from({ length: 12 }, (_, month) => (
                <MiniMonth
                  key={month}
                  year={activeYear}
                  month={month}
                  entryDates={entryDates}
                  activityScores={activityScores}
                  onOpenDate={onOpenDate}
                  onOpenMonth={() => {
                    setCursor(new Date(activeYear, month, 1));
                    setMode("month");
                  }}
                />
              ))}
            </div>
          )}
        </div>

        <footer className="activity-calendar-legend">
          <span><i className="score-low" /> Started</span>
          <span><i className="score-high" /> Strong day</span>
          <span><i className="today" /> Today</span>
        </footer>
      </section>
    </div>
  );
}

function monthCells(year: number, month: number): Array<Date | null> {
  const cells: Array<Date | null> = Array.from({ length: new Date(year, month, 1).getDay() }, () => null);
  const count = new Date(year, month + 1, 0).getDate();
  for (let day = 1; day <= count; day++) cells.push(new Date(year, month, day));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function scoreClass(score: number | undefined): string {
  if (score === undefined) return "";
  if (score >= 75) return "score-high";
  if (score >= 40) return "score-mid";
  return "score-low";
}

function MonthGrid({ year, month, entryDates, activityScores, onOpenDate }: {
  year: number;
  month: number;
  entryDates: Set<string>;
  activityScores: Map<string, number>;
  onOpenDate: (date: string) => void;
}) {
  const todayISO = toISODate(new Date());
  return (
    <div className="activity-month-grid">
      {WEEKDAYS.map((day, index) => <span className="activity-weekday" key={`${day}-${index}`}>{day}</span>)}
      {monthCells(year, month).map((date, index) => {
        if (!date) return <span key={`empty-${index}`} />;
        const iso = toISODate(date);
        const hasEntry = entryDates.has(iso);
        return (
          <button
            key={iso}
            className={`${hasEntry ? "has-entry" : ""} ${scoreClass(activityScores.get(iso))} ${iso === todayISO ? "today" : ""}`}
            onClick={() => onOpenDate(iso)}
            title={hasEntry ? "Open daily note" : "Open or create daily note"}
          >
            <span>{date.getDate()}</span>
            {hasEntry && <i />}
          </button>
        );
      })}
    </div>
  );
}

function MiniMonth({ year, month, entryDates, activityScores, onOpenDate, onOpenMonth }: {
  year: number;
  month: number;
  entryDates: Set<string>;
  activityScores: Map<string, number>;
  onOpenDate: (date: string) => void;
  onOpenMonth: () => void;
}) {
  return (
    <div className="activity-mini-month">
      <button className="activity-mini-title" onClick={onOpenMonth}>
        {new Date(year, month, 1).toLocaleDateString("en-US", { month: "short" })}
      </button>
      <div className="activity-mini-grid">
        {WEEKDAYS.map((day, index) => <span key={`${day}-${index}`}>{day}</span>)}
        {monthCells(year, month).map((date, index) => {
          if (!date) return <i key={`empty-${index}`} />;
          const iso = toISODate(date);
          return (
            <button
              key={iso}
              className={`${entryDates.has(iso) ? "has-entry" : ""} ${scoreClass(activityScores.get(iso))}`}
              onClick={() => onOpenDate(iso)}
              aria-label={iso}
            >
              {date.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

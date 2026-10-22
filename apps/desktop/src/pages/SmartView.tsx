import React, { useMemo, useRef, useState, useCallback } from "react";
import { CheckSquare, Square, MinusSquare, RefreshCw, SlidersHorizontal, X } from "lucide-react";
import { useNotesStore, type SmartViewId } from "../store/notesStore.js";
import {
  getOverdueTasks, getUpcomingTasks, getTodayTasks,
  applyFilter,
  type TaskResult,
} from "@daymark/core";
import { relativeLabel } from "@daymark/core";

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

const VIEW_LABELS: Record<SmartViewId, string> = {
  today:    "Today",
  overdue:  "Overdue",
  upcoming: "Upcoming",
  all:      "All Tasks",
};

function TaskRow({ result, onNoteClick }: { result: TaskResult; onNoteClick: (id: string, line: number) => void }) {
  const { task, note } = result;
  const date = task.scheduledDate ?? task.dueDate ?? task.noteDate;
  const saveNote = useNotesStore((s) => s.saveNote);

  const handleToggle = useCallback(() => {
    const lines = note.content.split("\n");
    const line = lines[task.lineIndex];
    if (!line) return;

    let updated: string;
    if (task.state === "open") {
      updated = line.replace("[ ]", "[x]");
      if (!updated.includes("@done(")) updated = updated.trimEnd() + ` @done(${todayISO()})`;
    } else {
      updated = line.replace(/\[x\]/i, "[ ]").replace(/\s*@done\([^)]*\)/, "");
    }
    lines[task.lineIndex] = updated;
    saveNote(note.id, lines.join("\n"));
  }, [task, note, saveNote]);

  return (
    <div className={`smart-task-row state-${task.state}`}>
      <button
        className={`smart-task-check ${task.state === "done" ? "checked" : ""}`}
        onClick={handleToggle}
        title={task.state === "done" ? "Mark incomplete" : "Mark complete"}
      >
        {task.state === "done"
          ? <CheckSquare size={16} strokeWidth={1.75} />
          : task.state === "cancelled"
          ? <MinusSquare size={16} strokeWidth={1.75} />
          : <Square size={16} strokeWidth={1.75} />}
      </button>
      <div className="smart-task-body">
        <span className="smart-task-content">{task.content || task.raw}</span>
        {task.tags.map((t) => (
          <span key={t} className="smart-task-tag">#{t}</span>
        ))}
        {task.mentions.map((m) => (
          <span key={m} className="smart-task-mention">@{m}</span>
        ))}
        {task.recurrence && (
          <span className="smart-task-repeat" title={task.recurrence}><RefreshCw size={11} strokeWidth={2} /></span>
        )}
        {task.dueDate && (
          <span className="smart-task-due" title={task.dueDate}>@due</span>
        )}
      </div>
      <button
        className="smart-task-note-link"
        onClick={() => onNoteClick(note.id, task.lineIndex)}
        title={note.filePath}
      >
        {date ? relativeLabel(date) : note.title}
      </button>
    </div>
  );
}

function TaskGroup({ date, results, onNoteClick }: {
  date: string;
  results: TaskResult[];
  onNoteClick: (id: string, line: number) => void;
}) {
  return (
    <div className="smart-group">
      <div className="smart-group-header">
        {relativeLabel(date)} <span className="smart-group-date">{date}</span>
      </div>
      {results.map((r) => (
        <TaskRow key={r.task.id} result={r} onNoteClick={onNoteClick} />
      ))}
    </div>
  );
}

export function SmartView() {
  const { activeSmartView, notes, openNote, openDailyNote } = useNotesStore();
  const view = activeSmartView ?? "today";

  const [filterStr, setFilterStr] = useState("");
  const filterRef = useRef<HTMLInputElement>(null);

  const rawResults = useMemo(() => {
    switch (view) {
      case "overdue":  return getOverdueTasks(notes);
      case "upcoming": return getUpcomingTasks(notes, 14);
      case "today":    return getTodayTasks(notes);
      default:         return [...getOverdueTasks(notes), ...getUpcomingTasks(notes, 30)];
    }
  }, [view, notes]);

  const results = useMemo(
    () => filterStr.trim() ? applyFilter(rawResults, filterStr) : rawResults,
    [rawResults, filterStr],
  );

  // Group by date
  const grouped = useMemo(() => {
    const map = new Map<string, TaskResult[]>();
    for (const r of results) {
      const date = r.task.scheduledDate ?? r.task.dueDate ?? r.task.noteDate ?? "no-date";
      const list = map.get(date) ?? [];
      list.push(r);
      map.set(date, list);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [results]);

  return (
    <div className="smart-view">
      <div className="smart-view-header">
        <h1 className="smart-view-title">{VIEW_LABELS[view]}</h1>
        <span className="smart-view-count">
          {results.length}{filterStr ? ` / ${rawResults.length}` : ""} task{results.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Filter bar */}
      <div className="smart-filter-bar">
        <span className="smart-filter-icon"><SlidersHorizontal size={14} strokeWidth={1.75} /></span>
        <input
          ref={filterRef}
          className="smart-filter-input"
          value={filterStr}
          onChange={(e) => setFilterStr(e.target.value)}
          placeholder="#tag  @mention  state:open  due:today  content:word"
          spellCheck={false}
        />
        {filterStr && (
          <button className="smart-filter-clear" onClick={() => setFilterStr("")} aria-label="Clear filter"><X size={13} strokeWidth={2} /></button>
        )}
      </div>

      {filterStr && (
        <div className="smart-filter-hint">
          Tip: <code>#tag</code> &nbsp; <code>@mention</code> &nbsp;
          <code>due:today|week|overdue</code> &nbsp; <code>state:done</code> &nbsp;
          <code>content:word</code> &nbsp; prefix <code>-</code> to negate
        </div>
      )}

      <div className="smart-view-body">
        {results.length === 0 ? (
          <div className="smart-view-empty">
            {filterStr
              ? `No tasks match "${filterStr}"`
              : view === "overdue" ? "No overdue tasks. You're all caught up."
              : view === "today"   ? "No tasks for today. Add one in your daily note."
              : "No upcoming tasks in the next 14 days."}
          </div>
        ) : (
          grouped.map(([date, items]) => (
            <TaskGroup
              key={date}
              date={date}
              results={items}
              onNoteClick={(id, line) => {
                const note = notes.get(id);
                const open = note?.date ? openDailyNote(note.date) : openNote(id);
                open.then(() => {
                  // Small delay for React re-render + editor mount
                  setTimeout(() => {
                    document.dispatchEvent(
                      new CustomEvent("daymark:scroll-to-line", { detail: line }),
                    );
                  }, 80);
                });
              }}
            />
          ))
        )}
      </div>
    </div>
  );
}

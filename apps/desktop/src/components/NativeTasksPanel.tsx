import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bell,
  CalendarDays,
  Check,
  ChevronRight,
  Circle,
  Clock3,
  GripHorizontal,
  ListTodo,
  Plus,
  SlidersHorizontal,
  X,
} from "lucide-react";
import {
  setTaskCompleted,
  taskDisplayContent,
  taskProject,
  updateTaskMetadata,
  isValidShortDate,
  isValidTime,
  type Task,
  type TaskResult,
} from "@daymark/core";
import { useNotesStore } from "../store/notesStore.js";
import { cancelNativeTaskReminder, scheduleNativeTaskReminder } from "../taskNotifications.js";

interface Props {
  noteDate: string;
  content: string;
  onChange: (content: string) => void;
}

type TaskMode = "today" | "upcoming" | "all";

function taskDate(task: Task): string | undefined {
  return task.scheduledDate ?? task.noteDate ?? task.dueDate;
}

function shortDate(value?: string): string {
  if (!value) return "";
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  return match?.[2] && match[3] ? `${match[3]}/${match[2]}` : value.slice(0, 5);
}

function reminderParts(value?: string): [string, string] {
  if (!value) return ["", ""];
  const [date = "", time = ""] = value.split("T");
  return [shortDate(date), time];
}

function projectLabel(result: TaskResult): string {
  return taskProject(result.task) ?? (result.note.type === "project" ? result.note.title : "Daily");
}

function NativeTaskEditor({ result, onSave, onClose }: {
  result: TaskResult;
  onSave: (content: string) => Promise<boolean>;
  onClose: () => void;
}) {
  const [scheduled, setScheduled] = useState(shortDate(result.task.scheduledDate));
  const [deadline, setDeadline] = useState(shortDate(result.task.dueDate));
  const [initialReminderDate, initialReminderTime] = reminderParts(result.task.reminderDate);
  const [reminderDate, setReminderDate] = useState(initialReminderDate);
  const [reminderTime, setReminderTime] = useState(initialReminderTime);
  const [project, setProject] = useState(taskProject(result.task) ?? "");
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);

  async function save() {
    const year = Number(result.note.date?.slice(0, 4) ?? new Date().getFullYear());
    const dateFields = [scheduled, deadline, reminderDate].filter(Boolean);
    if (dateFields.some((value) => !isValidShortDate(value, year))) {
      setError("Use a real date in DD/MM format.");
      return;
    }
    if (Boolean(reminderDate) !== Boolean(reminderTime)) {
      setError("A reminder needs both a date and time.");
      return;
    }
    if (reminderTime && !isValidTime(reminderTime)) {
      setError("Use a 24-hour time in HH:mm format.");
      return;
    }

    setWorking(true);
    setError("");
    const saved = await onSave(updateTaskMetadata(result.note.content, result.task.lineIndex, {
      scheduled,
      deadline,
      reminderDate,
      reminderTime,
      project,
    }));
    if (!saved) {
      setWorking(false);
      setError("The task could not be saved. Try again.");
      return;
    }
    const reminderStatus = await scheduleNativeTaskReminder({
      noteId: result.note.id,
      lineIndex: result.task.lineIndex,
      title: taskDisplayContent(result.task),
      ...(result.note.date ? { noteDate: result.note.date } : {}),
      reminderDate,
      reminderTime,
    });
    setWorking(false);
    if (reminderStatus === "invalid") {
      setError("The reminder must be a valid future date and time.");
      return;
    }
    if (reminderStatus === "denied") {
      setError("Notification permission is off. Enable Manager in System Settings → Notifications.");
      return;
    }
    onClose();
  }

  return (
    <div className="native-task-editor-backdrop" onMouseDown={onClose}>
      <section className="native-task-editor" onMouseDown={(event) => event.stopPropagation()}>
        <header>
          <div><ListTodo size={15} /><span>{taskDisplayContent(result.task)}</span></div>
          <button onClick={onClose} aria-label="Close"><X size={14} /></button>
        </header>
        <div className="native-task-fields">
          <label><CalendarDays size={14} /><span>Scheduled</span><input value={scheduled} onChange={(event) => setScheduled(event.target.value)} placeholder="DD/MM" /></label>
          <label><Clock3 size={14} /><span>Deadline</span><input value={deadline} onChange={(event) => setDeadline(event.target.value)} placeholder="DD/MM" /></label>
          <label className="native-reminder-field"><Bell size={14} /><span>Remind</span><input value={reminderDate} onChange={(event) => setReminderDate(event.target.value)} placeholder="DD/MM" /><input value={reminderTime} onChange={(event) => setReminderTime(event.target.value)} placeholder="HH:mm" /></label>
          <label><SlidersHorizontal size={14} /><span>Project</span><input value={project} onChange={(event) => setProject(event.target.value)} placeholder="Optional" /></label>
        </div>
        {error && <p className="native-task-error">{error}</p>}
        <footer>
          <button className="native-task-cancel" onClick={onClose} disabled={working}>Cancel</button>
          <button className="native-task-save" onClick={() => void save()} disabled={working}><Check size={13} /> {working ? "Saving…" : "Save task"}</button>
        </footer>
      </section>
    </div>
  );
}

export function NativeTasksPanel({ noteDate, content, onChange }: Props) {
  const { notes, activeNoteId, saveNote, openNote, openDailyNote, loadAllNotesWithContent } = useNotesStore();
  const [mode, setMode] = useState<TaskMode>("today");
  const [selected, setSelected] = useState<TaskResult | null>(null);
  const [panelHeight, setPanelHeight] = useState(() => {
    const saved = Number.parseInt(window.localStorage.getItem("manager.nativeTaskPanelHeight") ?? "180", 10);
    return Number.isFinite(saved) ? saved : 180;
  });
  const dragRef = useRef<{ startY: number; startHeight: number } | null>(null);

  useEffect(() => { void loadAllNotesWithContent(); }, [loadAllNotesWithContent]);
  useEffect(() => { window.localStorage.setItem("manager.nativeTaskPanelHeight", String(panelHeight)); }, [panelHeight]);

  useEffect(() => {
    function move(event: MouseEvent) {
      if (!dragRef.current) return;
      const next = dragRef.current.startHeight + dragRef.current.startY - event.clientY;
      setPanelHeight(Math.min(Math.floor(window.innerHeight * 0.58), Math.max(128, next)));
    }
    function up() { dragRef.current = null; document.body.classList.remove("native-tasks-resizing"); }
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    return () => { window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); };
  }, []);

  const results = useMemo(() => {
    const all: TaskResult[] = [];
    for (const note of notes.values()) {
      for (const task of note.tasks) {
        if (task.state !== "open") continue;
        const date = taskDate(task);
        if (mode === "today" && (!date || date > noteDate)) continue;
        if (mode === "upcoming" && (!date || date <= noteDate)) continue;
        all.push({ task, note });
      }
    }
    return all.sort((a, b) => (taskDate(a.task) ?? "9999").localeCompare(taskDate(b.task) ?? "9999"));
  }, [mode, noteDate, notes]);

  const groups = useMemo(() => {
    const grouped = new Map<string, TaskResult[]>();
    for (const result of results) {
      const label = projectLabel(result);
      grouped.set(label, [...(grouped.get(label) ?? []), result]);
    }
    return [...grouped.entries()].sort(([a], [b]) => a === "Daily" ? -1 : b === "Daily" ? 1 : a.localeCompare(b));
  }, [results]);

  async function saveResult(result: TaskResult, updated: string): Promise<boolean> {
    if (result.note.id === activeNoteId) onChange(updated);
    return saveNote(result.note.id, updated);
  }

  async function complete(result: TaskResult) {
    const source = result.note.id === activeNoteId ? content : result.note.content;
    const saved = await saveResult(result, setTaskCompleted(source, result.task.lineIndex, true, shortDate(noteDate)));
    if (saved) await cancelNativeTaskReminder(result.note.id, result.task.lineIndex);
  }

  function openQuickCapture() {
    document.dispatchEvent(new CustomEvent("daymark:quick-task"));
  }

  function openSource(result: TaskResult) {
    const opened = result.note.date ? openDailyNote(result.note.date) : openNote(result.note.id);
    opened.then(() => window.setTimeout(() => {
      document.dispatchEvent(new CustomEvent("daymark:scroll-to-line", { detail: result.task.lineIndex }));
    }, 80));
  }

  return (
    <section className="native-tasks-panel" style={{ height: panelHeight }} aria-label="Manager tasks">
      <div
        className="native-tasks-resize"
        title="Drag to resize"
        onMouseDown={(event) => {
          dragRef.current = { startY: event.clientY, startHeight: panelHeight };
          document.body.classList.add("native-tasks-resizing");
          event.preventDefault();
        }}
      ><GripHorizontal size={15} /></div>
      <header className="native-tasks-header">
        <div className="native-tasks-title"><ListTodo size={13} /><span>Tasks</span><small>{results.length}</small></div>
        <div className="native-task-modes">
          {(["today", "upcoming", "all"] as TaskMode[]).map((value) => (
            <button key={value} className={mode === value ? "active" : ""} onClick={() => setMode(value)}>{value}</button>
          ))}
        </div>
        <div className="native-tasks-actions">
          <button onClick={openQuickCapture} title="Add task with natural language"><Plus size={14} />Add</button>
        </div>
      </header>

      <div className="native-task-groups">
        {groups.length === 0 ? (
          <button className="native-tasks-empty" onClick={openQuickCapture}><Plus size={14} />Add the first task</button>
        ) : groups.map(([label, tasks]) => (
          <section className="native-task-group" key={label}>
            <div className="native-task-group-head"><span>{label}</span><small>{tasks.length}</small></div>
            <div className="native-task-list">
              {tasks.map((result) => (
                <div className="native-task-row" key={`${result.note.id}-${result.task.lineIndex}`}>
                  <button className="native-task-check" onClick={() => void complete(result)} title="Complete task"><Circle size={14} /></button>
                  <button className="native-task-copy" onClick={() => setSelected(result)} title="Edit schedule and reminder">
                    <span>{taskDisplayContent(result.task)}</span>
                    <small>
                      {taskDate(result.task) && <em>{taskDate(result.task)! < noteDate ? "Overdue" : shortDate(taskDate(result.task))}</em>}
                      {result.task.dueDate && <em>Due {shortDate(result.task.dueDate)}</em>}
                      {result.task.reminderDate && <em><Bell size={9} />{shortDate(result.task.reminderDate)} {result.task.reminderDate.split("T")[1]}</em>}
                    </small>
                  </button>
                  <button className="native-task-source" onClick={() => openSource(result)} title={`Open ${result.note.title}`}><ChevronRight size={12} /></button>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>

      {selected && (() => {
        const editorResult = selected.note.id === activeNoteId
          ? { ...selected, note: { ...selected.note, content } }
          : selected;
        return (
        <NativeTaskEditor
          result={editorResult}
          onClose={() => setSelected(null)}
          onSave={(updated) => saveResult(selected, updated)}
        />
        );
      })()}
    </section>
  );
}

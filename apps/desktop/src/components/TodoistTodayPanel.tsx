import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  AlertCircle,
  ChevronDown,
  CheckCircle2,
  ExternalLink,
  GripVertical,
  GripHorizontal,
  ListTodo,
  Plus,
  RefreshCw,
  Settings,
} from "lucide-react";
import { useNotesStore } from "../store/notesStore.js";

interface TodoistDue {
  date?: string;
  string?: string;
  datetime?: string;
}

interface TodoistTask {
  id: string;
  content: string;
  description?: string;
  priority?: number;
  labels?: string[];
  due?: TodoistDue | null;
  url?: string;
  project_id?: string;
  section_id?: string;
  parent_id?: string;
  subtasks?: TodoistTask[];
}

interface TodoistSectionGroup {
  id: string;
  name: string;
  order: number;
  tasks: TodoistTask[];
}

interface TodoistProjectBoard {
  label: string;
  project_id?: string | null;
  sections: TodoistSectionGroup[];
}

type LoadState = "idle" | "loading" | "error";

interface Props {
  onNativeOpen?: () => void;
}

async function fetchProjectBoards(token: string): Promise<TodoistProjectBoard[]> {
  return invoke<TodoistProjectBoard[]>("get_todoist_project_boards", { token });
}

async function closeTodoistTask(token: string, taskId: string) {
  return invoke<void>("close_todoist_task", { token, taskId });
}

type TodoistDueChoice = "today" | "tomorrow" | "no-date";

async function createTodoistTask(
  token: string,
  content: string,
  projectId?: string | null,
  sectionId?: string | null,
  dueString?: string,
  priority?: number,
) {
  return invoke<TodoistTask>("create_todoist_task", {
    token,
    content,
    projectId,
    sectionId,
    dueString,
    priority,
  });
}

function normalizeTodoistError(err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  if (message.includes("401") || message.includes("403")) {
    return "Todoist rejected the token. Paste your personal API token from Todoist Settings.";
  }
  if (message.includes("404")) {
    return "Todoist project or task was not found.";
  }
  if (/\b5\d\d\b/.test(message)) {
    return "Todoist is temporarily unavailable. Your last loaded tasks are still shown. Retry shortly.";
  }
  return message || "Todoist could not be loaded.";
}

function priorityColor(priority?: number): string {
  switch (priority) {
    case 4: return "#dc4c3e";
    case 3: return "#f59e0b";
    case 2: return "#3b82f6";
    default: return "#9ca3af";
  }
}

function priorityLabel(priority?: number): string {
  switch (priority) {
    case 4: return "Priority 1";
    case 3: return "Priority 2";
    case 2: return "Priority 3";
    default: return "Priority 4";
  }
}

export function TodoistTodayPanel({ onNativeOpen }: Props) {
  const { settings } = useNotesStore();
  const token = settings.todoistApiToken?.trim() ?? "";
  const [boards, setBoards] = useState<TodoistProjectBoard[]>([]);
  const [activeTab, setActiveTab] = useState("");
  const [panelHeight, setPanelHeight] = useState(() => {
    const saved = window.localStorage.getItem("daymark.todoistPanelHeight")
      ?? window.localStorage.getItem("noteplan.todoistPanelHeight");
    const parsed = saved ? Number.parseInt(saved, 10) : 188;
    return Number.isFinite(parsed) ? parsed : 188;
  });
  const dragRef = useRef<{ startY: number; startHeight: number } | null>(null);
  const [state, setState] = useState<LoadState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [closingId, setClosingId] = useState<string | null>(null);
  const [quickAdd, setQuickAdd] = useState("");
  const [targetSectionId, setTargetSectionId] = useState<string>("");
  const [quickDue, setQuickDue] = useState<TodoistDueChoice>("today");
  const [quickTime, setQuickTime] = useState("");
  const [quickPriority, setQuickPriority] = useState(1);
  const [quickReminder, setQuickReminder] = useState(true);
  const [adding, setAdding] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
  const taskDragRef = useRef<{
    id: string;
    content: string;
    priority: number;
    startX: number;
    startY: number;
    active: boolean;
  } | null>(null);
  const suppressTaskClickRef = useRef(false);

  const isConfigured = token.length > 0;
  const activeBoard = boards.find((board) => board.label === activeTab) ?? boards[0];
  const totalCount = boards.reduce(
    (sum, board) => sum + board.sections.reduce((sectionSum, section) => sectionSum + section.tasks.length, 0),
    0,
  );

  const displayBoards = boards;

  const loadBoards = useCallback(async () => {
    if (!token) {
      setBoards([]);
      setState("idle");
      setError(null);
      return;
    }
    setState("loading");
    setError(null);
    try {
      const nextBoards = await fetchProjectBoards(token);
      setBoards(nextBoards);
      if (!nextBoards.some((board) => board.label === activeTab)) {
        setActiveTab(nextBoards[0]?.label ?? "");
      }
      setState("idle");
    } catch (err) {
      setError(normalizeTodoistError(err));
      setState("error");
    }
  }, [activeTab, token]);

  useEffect(() => {
    void loadBoards();
    if (!token) return;
    const interval = window.setInterval(() => void loadBoards(), 60000);
    return () => window.clearInterval(interval);
  }, [loadBoards, token]);

  useEffect(() => {
    window.localStorage.setItem("daymark.todoistPanelHeight", String(panelHeight));
  }, [panelHeight]);

  useEffect(() => {
    setTargetSectionId(activeBoard?.sections[0]?.id ?? "");
  }, [activeBoard?.label, activeBoard?.sections]);

  useEffect(() => {
    function onMouseMove(event: MouseEvent) {
      const drag = dragRef.current;
      if (!drag) return;
      const maxHeight = Math.max(220, Math.floor(window.innerHeight * 0.58));
      const nextHeight = drag.startHeight + (drag.startY - event.clientY);
      setPanelHeight(Math.min(maxHeight, Math.max(132, nextHeight)));
    }

    function onMouseUp() {
      dragRef.current = null;
      document.body.classList.remove("todoist-resizing");
    }

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, []);

  useEffect(() => {
    const clearEditorDragState = () => {
      document.querySelectorAll(".cm-editor.cm-todoist-dragover")
        .forEach((element) => element.classList.remove("cm-todoist-dragover"));
    };

    function onPointerMove(event: PointerEvent) {
      const drag = taskDragRef.current;
      if (!drag) return;
      if (!drag.active && Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < 6) return;
      if (!drag.active) {
        drag.active = true;
        suppressTaskClickRef.current = true;
        setDraggingTaskId(drag.id);
        document.body.classList.add("todoist-task-drag-active");
      }
      event.preventDefault();
      clearEditorDragState();
      document.elementFromPoint(event.clientX, event.clientY)?.closest(".cm-editor")
        ?.classList.add("cm-todoist-dragover");
    }

    function onPointerUp(event: PointerEvent) {
      const drag = taskDragRef.current;
      if (!drag) return;
      const editor = document.elementFromPoint(event.clientX, event.clientY)?.closest(".cm-editor");
      if (drag.active && editor) {
        document.dispatchEvent(new CustomEvent("daymark:drop-todoist-task", {
          detail: {
            content: drag.content,
            priority: drag.priority,
            clientX: event.clientX,
            clientY: event.clientY,
          },
        }));
      }
      taskDragRef.current = null;
      setDraggingTaskId(null);
      document.body.classList.remove("todoist-task-drag-active");
      clearEditorDragState();
      window.setTimeout(() => { suppressTaskClickRef.current = false; }, 0);
    }

    window.addEventListener("pointermove", onPointerMove, { passive: false });
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
      clearEditorDragState();
    };
  }, []);

  async function completeTask(taskId: string) {
    if (!token) return;
    setClosingId(taskId);
    try {
      await closeTodoistTask(token, taskId);
      setBoards((current) => current.map((board) => ({
        ...board,
        sections: board.sections
          .map((section) => ({
            ...section,
            tasks: section.tasks.filter((task) => task.id !== taskId),
          }))
          .filter((section) => section.tasks.length > 0),
      })));
    } catch (err) {
      setError(normalizeTodoistError(err));
      setState("error");
    } finally {
      setClosingId(null);
    }
  }

  async function addTask() {
    if (!token || !quickAdd.trim() || !activeBoard?.project_id) return;
    setAdding(true);
    setError(null);
    try {
      const dueBase = quickDue === "no-date" ? "" : quickDue;
      const dueString = dueBase && quickTime ? `${dueBase} at ${quickTime}` : dueBase;
      await createTodoistTask(
        token,
        quickAdd.trim(),
        activeBoard.project_id,
        targetSectionId || undefined,
        dueString,
        quickPriority,
      );
      setQuickAdd("");
      setQuickTime("");
      setQuickReminder(true);
      setAddOpen(false);
      await loadBoards();
    } catch (err) {
      setError(normalizeTodoistError(err));
      setState("error");
    } finally {
      setAdding(false);
    }
  }

  return (
    <section
      className="todoist-panel"
      aria-label="Todoist tasks due today"
      style={{ height: `${panelHeight}px` }}
    >
      <div
        className="todoist-resize-handle"
        onMouseDown={(event) => {
          dragRef.current = { startY: event.clientY, startHeight: panelHeight };
          document.body.classList.add("todoist-resizing");
          event.preventDefault();
        }}
        title="Drag to resize Todoist panel"
      >
        <GripHorizontal size={16} strokeWidth={2} />
      </div>
      <div className="todoist-header">
        <div className="todoist-title-wrap">
          <span className="todoist-title">Today&apos;s Tasks</span>
          {isConfigured && <span className="todoist-count">{totalCount}</span>}
          {isConfigured && <span className="todoist-drag-hint"><GripVertical size={10} />Drag into agenda</span>}
        </div>
        <div className="todoist-actions">
          {onNativeOpen && (
            <button className="todoist-icon-btn todoist-native-switch" onClick={onNativeOpen} title="Back to Manager tasks">
              <ListTodo size={13} />
            </button>
          )}
          {isConfigured && activeBoard?.project_id && (
            <button
              className={`todoist-icon-btn todoist-add-toggle ${addOpen ? "active" : ""}`}
              onClick={() => setAddOpen((open) => !open)}
              title="Add Todoist task"
            >
              <Plus size={14} strokeWidth={2} />
            </button>
          )}
          <button
            className="todoist-icon-btn"
            onClick={() => void loadBoards()}
            disabled={!isConfigured || state === "loading"}
            title="Refresh Todoist"
          >
            <RefreshCw size={14} className={state === "loading" ? "spin" : ""} />
          </button>
        </div>
      </div>

      {!isConfigured && (
        <div className="todoist-empty">
          <Settings size={15} />
          <span>Add your Todoist API token in Settings to show today's live tasks here.</span>
        </div>
      )}

      {isConfigured && state === "error" && error && (
        <div className="todoist-error">
          <AlertCircle size={15} />
          <span>{error}</span>
        </div>
      )}

      {isConfigured && state !== "loading" && displayBoards.length === 0 && !error && (
        <div className="todoist-empty">No Todoist projects found for this account.</div>
      )}

      {isConfigured && activeBoard?.project_id && addOpen && (
        <form
          className="todoist-quick-add"
          onSubmit={(event) => {
            event.preventDefault();
            void addTask();
          }}
        >
          <input
            className="todoist-quick-input"
            value={quickAdd}
            onChange={(event) => setQuickAdd(event.target.value)}
            placeholder={`Add task to ${activeBoard.label}`}
          />
          <div className="todoist-quick-controls">
            <select
              className="todoist-section-select"
              value={targetSectionId}
              onChange={(event) => setTargetSectionId(event.target.value)}
            >
              <option value="">No section</option>
              {activeBoard.sections.map((section) => (
                <option key={section.id} value={section.id}>{section.name}</option>
              ))}
            </select>
            <select
              className="todoist-section-select"
              value={quickDue}
              onChange={(event) => setQuickDue(event.target.value as TodoistDueChoice)}
            >
              <option value="today">Today</option>
              <option value="tomorrow">Tomorrow</option>
              <option value="no-date">No date</option>
            </select>
            <input
              className="todoist-time-input"
              type="time"
              value={quickTime}
              disabled={quickDue === "no-date"}
              onChange={(event) => setQuickTime(event.target.value)}
              title="Due time"
            />
            <select
              className="todoist-priority-select"
              value={quickPriority}
              onChange={(event) => setQuickPriority(Number(event.target.value))}
              title="Priority"
            >
              <option value={1}>P4</option>
              <option value={2}>P3</option>
              <option value={3}>P2</option>
              <option value={4}>P1</option>
            </select>
            <button
              type="button"
              className={`todoist-reminder-chip ${quickReminder ? "active" : ""}`}
              disabled={quickDue === "no-date"}
              onClick={() => setQuickReminder((value) => !value)}
              title="Timed Todoist tasks use your Todoist reminder settings"
            >
              Remind
            </button>
            <button className="todoist-add-btn" disabled={adding || !quickAdd.trim()}>
              {adding ? "Adding" : "Add"}
            </button>
          </div>
        </form>
      )}

      {isConfigured && (
        <div className="todoist-lanes">
          {displayBoards.map((board) => {
            const boardCount = board.sections.reduce((sum, section) => sum + section.tasks.length, 0);
            const isActive = activeTab === board.label;
            return (
              <section className={`todoist-lane ${isActive ? "active" : ""}`} key={board.label}>
                <button className="todoist-lane-head" onClick={() => setActiveTab(board.label)}>
                  <span>{board.label}</span>
                  <span>{boardCount}</span>
                </button>

                {state !== "loading" && board.project_id === null && (
                  <div className="todoist-column-empty">Project not found</div>
                )}

                {state !== "loading" && board.project_id !== null && boardCount === 0 && (
                  <div className="todoist-column-empty">No today or overdue tasks</div>
                )}

                <div className="todoist-sections">
                  {board.sections.map((section) => (
                    <div className="todoist-section" key={section.id}>
                      <div className="todoist-section-title">
                        <span>{section.name}</span>
                        <span>{section.tasks.length}</span>
                      </div>
                      <div className="todoist-list">
                        {section.tasks.map((task) => (
                          <div
                            className={`todoist-task ${expandedTaskId === task.id ? "expanded" : ""} ${draggingTaskId === task.id ? "dragging" : ""}`}
                            key={task.id}
                            onPointerDown={(event) => {
                              if (event.button !== 0 || (event.target as HTMLElement).closest(".todoist-check, .todoist-open")) return;
                              taskDragRef.current = {
                                id: task.id,
                                content: task.content,
                                priority: task.priority ?? 1,
                                startX: event.clientX,
                                startY: event.clientY,
                                active: false,
                              };
                            }}
                            title="Drag into Today's Agenda"
                          >
                            <span className="todoist-drag-grip" aria-hidden="true"><GripVertical size={11} /></span>
                            <button
                              className="todoist-check"
                              style={{ "--todoist-priority": priorityColor(task.priority) } as CSSProperties}
                              onClick={() => void completeTask(task.id)}
                              disabled={closingId === task.id}
                              title={`Complete in Todoist · ${priorityLabel(task.priority)}`}
                            >
                              <CheckCircle2 size={15} />
                            </button>
                            <button
                              className="todoist-task-body"
                              onClick={() => {
                                if (suppressTaskClickRef.current) return;
                                if ((task.subtasks?.length ?? 0) > 0) {
                                  setExpandedTaskId((current) => current === task.id ? null : task.id);
                                }
                              }}
                              title={(task.subtasks?.length ?? 0) > 0 ? "Show subtasks" : undefined}
                            >
                              <span className="todoist-task-title">
                                {task.content}
                                {(task.subtasks?.length ?? 0) > 0 && (
                                  <ChevronDown size={11} className="todoist-expand-icon" strokeWidth={2} />
                                )}
                              </span>
                              <span className="todoist-task-meta">
                                {task.due?.string ?? task.due?.date ?? "Today"}
                                {(task.labels?.length ?? 0) > 0 && ` · ${task.labels?.map((label) => `@${label}`).join(" ")}`}
                              </span>
                              {expandedTaskId === task.id && (task.subtasks?.length ?? 0) > 0 && (
                                <span className="todoist-subtasks">
                                  {task.subtasks?.map((subtask) => (
                                    <span className="todoist-subtask" key={subtask.id}>
                                      <span
                                        className="todoist-subtask-ring"
                                        style={{ "--todoist-priority": priorityColor(subtask.priority) } as CSSProperties}
                                      />
                                      <span className="todoist-subtask-copy">
                                        <span className="todoist-subtask-title">{subtask.content}</span>
                                        <span className="todoist-subtask-meta">
                                          {subtask.due?.string ?? subtask.due?.date ?? priorityLabel(subtask.priority)}
                                        </span>
                                      </span>
                                    </span>
                                  ))}
                                </span>
                              )}
                            </button>
                            {task.url && (
                              <a className="todoist-open" href={task.url} target="_blank" rel="noreferrer" title="Open in Todoist">
                                <ExternalLink size={13} />
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </section>
  );
}

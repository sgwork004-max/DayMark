import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { CheckCircle2, Pause, Play, RotateCcw, Timer, X } from "lucide-react";
import type { Task } from "@daymark/core";
import { focusRemaining, persistFocusSession, readFocusSession, type FocusSessionState } from "../focusSession.js";

interface Props {
  tasks: Task[];
  onComplete: (lineIndex: number) => void;
  onClose: () => void;
}

function loadState(tasks: Task[]): FocusSessionState {
  const saved = readFocusSession();
  if (!saved) return { taskLine: tasks[0]?.lineIndex ?? 0, duration: 25, remaining: 1500, running: false, endAt: undefined };
  return { ...saved, running: saved.running && saved.remaining > 0 };
}

export function FocusSprint({ tasks, onComplete, onClose }: Props) {
  const openTasks = useMemo(() => tasks.filter((task) => task.state === "open"), [tasks]);
  const [state, setState] = useState(() => loadState(openTasks));
  const selected = openTasks.find((task) => task.lineIndex === state.taskLine) ?? openTasks[0];

  useEffect(() => {
    persistFocusSession(state);
    if (!state.running) return;
    const timer = window.setInterval(() => {
      setState((current) => {
        const remaining = focusRemaining(current);
        return { ...current, remaining, running: remaining > 0 };
      });
    }, 500);
    return () => window.clearInterval(timer);
  }, [state]);

  function setDuration(duration: number) {
    setState((current) => ({ ...current, duration, remaining: duration * 60, running: false, endAt: undefined }));
  }

  function toggle() {
    setState((current) => current.running
      ? { ...current, running: false, endAt: undefined }
      : { ...current, running: true, endAt: Date.now() + current.remaining * 1000 });
  }

  const minutes = Math.floor(state.remaining / 60);
  const seconds = state.remaining % 60;
  const progress = 1 - state.remaining / (state.duration * 60);

  return (
    <div className="focus-overlay" role="dialog" aria-modal="true" aria-label="Focus sprint">
      <button className="focus-close" onClick={onClose} aria-label="Close"><X size={18} /></button>
      <div className="focus-surface">
        <div className="focus-kicker"><Timer size={14} /> Focus sprint</div>
        <select
          className="focus-task-select"
          value={selected?.lineIndex ?? ""}
          onChange={(event) => setState((current) => ({ ...current, taskLine: Number(event.target.value) }))}
          disabled={openTasks.length === 0}
        >
          {openTasks.length === 0 && <option>No open tasks in this note</option>}
          {openTasks.map((task) => <option key={task.lineIndex} value={task.lineIndex}>{task.content}</option>)}
        </select>
        <div className="focus-clock" style={{ "--focus-progress": `${progress * 360}deg` } as CSSProperties}>
          <div><strong>{String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}</strong><span>{state.running ? "Stay with it" : "Ready"}</span></div>
        </div>
        <div className="focus-durations">
          {[25, 50].map((duration) => <button key={duration} className={state.duration === duration ? "active" : ""} onClick={() => setDuration(duration)}>{duration} min</button>)}
        </div>
        <div className="focus-controls">
          <button className="focus-reset" onClick={() => setDuration(state.duration)} title="Reset"><RotateCcw size={16} /></button>
          <button className="focus-start" onClick={toggle} disabled={!selected}>{state.running ? <Pause size={18} /> : <Play size={18} />}{state.running ? "Pause" : "Start"}</button>
          <button className="focus-complete" onClick={() => { if (selected) onComplete(selected.lineIndex); onClose(); }} disabled={!selected} title="Complete task"><CheckCircle2 size={17} /></button>
        </div>
      </div>
    </div>
  );
}

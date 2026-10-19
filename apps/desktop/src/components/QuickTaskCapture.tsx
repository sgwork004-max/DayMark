import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, Clock3, CornerDownLeft, Flag, X } from "lucide-react";
import { parseNaturalTaskInput } from "@daymark/core";
import { scheduleNativeTaskReminder } from "../taskNotifications.js";

interface Props {
  noteId: string;
  noteDate: string;
  content: string;
  onChange: (content: string) => void;
  onSave: (content: string) => Promise<boolean>;
}

function previewDate(iso: string): string {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${iso}T12:00:00Z`));
}

function insertUnderHeading(content: string, heading: string, line: string): { content: string; lineIndex: number } {
  const lines = content.split("\n");
  const index = lines.findIndex((item) => item.trim().toLowerCase() === heading.toLowerCase());
  if (index === -1) {
    const prefix = `${content.trimEnd()}\n\n${heading}\n`;
    return { content: `${prefix}${line}\n`, lineIndex: prefix.split("\n").length - 1 };
  }

  let insertAt = index + 1;
  while (insertAt < lines.length && lines[insertAt]?.trim() === "") insertAt++;
  if (/^-\s+\[ \]\s*$/.test(lines[insertAt] ?? "")) lines[insertAt] = line;
  else lines.splice(insertAt, 0, line);
  return { content: lines.join("\n"), lineIndex: insertAt };
}

export function QuickTaskCapture({ noteId, noteDate, content, onChange, onSave }: Props) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const parsed = useMemo(() => value.trim() ? parseNaturalTaskInput(value, noteDate) : null, [noteDate, value]);

  useEffect(() => {
    function onQuickTask() {
      setOpen(true);
      window.setTimeout(() => inputRef.current?.focus(), 30);
    }

    document.addEventListener("daymark:quick-task", onQuickTask);
    return () => document.removeEventListener("daymark:quick-task", onQuickTask);
  }, []);

  if (!open) return null;

  function close() {
    setOpen(false);
    setValue("");
    setError("");
  }

  async function submit() {
    if (!parsed || submitting) return;
    setSubmitting(true);
    setError("");
    const inserted = insertUnderHeading(content, `### ${parsed.priority}`, parsed.markdown);
    const nextContent = inserted.content;
    onChange(nextContent);
    let saved = false;
    try {
      if (!await onSave(nextContent)) {
        setError("Could not save the task. Try again.");
        return;
      }
      saved = true;
      if (parsed.reminderDate && parsed.reminderTime) {
        const reminderStatus = await scheduleNativeTaskReminder({
          noteId,
          lineIndex: inserted.lineIndex,
          title: parsed.title,
          noteDate,
          reminderDate: `${parsed.reminderDate.slice(8, 10)}/${parsed.reminderDate.slice(5, 7)}`,
          reminderTime: parsed.reminderTime,
        });
        if (reminderStatus !== "scheduled") {
          setError(reminderStatus === "denied"
            ? "Task saved, but notifications are disabled. Enable them in System Settings."
            : "Task saved, but its reminder time is invalid or has passed.");
          return;
        }
      }
      close();
    } catch (cause) {
      setError(saved
        ? `Task saved, but its reminder could not be scheduled: ${String(cause)}`
        : `Could not save the task: ${String(cause)}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="quick-task-backdrop" onClick={close}>
      <div className="quick-task-card" onClick={(event) => event.stopPropagation()}>
        <div className="quick-task-head">
          <CalendarDays size={15} strokeWidth={2} />
          <span>Capture task</span>
          <button className="quick-task-close" onClick={close} aria-label="Close">
            <X size={14} strokeWidth={2} />
          </button>
        </div>
        <input
          ref={inputRef}
          className="quick-task-input"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") close();
            if (event.key === "Enter") void submit();
          }}
          placeholder="DO XYZ mon p1 10.30am"
          spellCheck={false}
        />
        <div className="quick-task-preview">
          {parsed ? (
            <>
              <span className="quick-task-preview-title">{parsed.title}</span>
              <span className={`quick-task-token priority-${parsed.priority.toLowerCase()}`}>
                <Flag size={11} /> {parsed.priority}
              </span>
              {parsed.scheduledDate && (
                <span className="quick-task-token"><CalendarDays size={11} /> {previewDate(parsed.scheduledDate)}</span>
              )}
              {parsed.scheduledTime && (
                <span className="quick-task-token"><Clock3 size={11} /> {parsed.scheduledTime}</span>
              )}
            </>
          ) : (
            <span className="quick-task-preview-hint">Try: Write proposal fri p2 4pm</span>
          )}
        </div>
        {error && <p role="alert">{error}</p>}
        <button className="quick-task-submit" onClick={() => void submit()} disabled={!parsed || submitting}>
          <CornerDownLeft size={13} strokeWidth={2} />
          Add to {parsed?.priority ?? "agenda"}
        </button>
      </div>
    </div>
  );
}

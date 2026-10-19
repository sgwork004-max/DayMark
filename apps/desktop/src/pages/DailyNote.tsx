import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { BookOpen, Flame, Moon, Timer } from "lucide-react";
import { NoteEditor } from "@daymark/editor";
import { useNotesStore } from "../store/notesStore.js";
import { useAutoSave } from "../hooks/useAutoSave.js";
import { calculateDailyMetrics, findCarryoverInsights, insertAIResponseUnderNotes, parseTasks, resolveWikiLink, setTaskCompleted } from "@daymark/core";
import { TodoistTodayPanel } from "../components/TodoistTodayPanel.js";
import { QuickTaskCapture } from "../components/QuickTaskCapture.js";
import { PRODUCT_NAME } from "../brand.js";
import { DailyRitualModal } from "../components/DailyRitualModal.js";
import { NativeTasksPanel } from "../components/NativeTasksPanel.js";
import { FocusSprint } from "../components/FocusSprint.js";
import { CarryoverInsights } from "../components/CarryoverInsights.js";

export function NotePane() {
  const { activeNoteId, notes, settings, openDailyNote, openNote, saveNote, createNote } = useNotesStore();
  const note = activeNoteId ? notes.get(activeNoteId) : null;

  const [localContent, setLocalContent] = useState(note?.content ?? "");
  const [saveLabel, setSaveLabel]       = useState<"" | "Saving…" | "Saved" | "Save failed">("");
  const [ritualMode, setRitualMode] = useState<"review" | null>(null);
  const [taskSource, setTaskSource] = useState<"native" | "todoist">(
    () => settings.todoistApiToken ? "todoist" : "native",
  );
  const [focusOpen, setFocusOpen] = useState(false);
  const [insightsOpen, setInsightsOpen] = useState(false);
  const localContentRef = useRef(localContent);
  localContentRef.current = localContent;

  // Save old note before switching, then load new content.
  const prevNoteIdRef = useRef(activeNoteId);
  useEffect(() => {
    const prevId = prevNoteIdRef.current;
    if (prevId && prevId !== activeNoteId) {
      saveNote(prevId, localContentRef.current);
    }
    prevNoteIdRef.current = activeNoteId;
    setLocalContent(note?.content ?? "");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeNoteId]);

  // Auto-save 500ms after each keystroke.
  const autoSaveState = useAutoSave(activeNoteId ?? null, localContent);

  // ⌘S force-save — also triggered by the Mod-s binding in the CodeMirror keymap.
  useEffect(() => {
    let feedbackTimer: ReturnType<typeof setTimeout>;
    function onForceSave(event: Event) {
      if (!activeNoteId) return;
      setSaveLabel("Saving…");
      const promise = saveNote(activeNoteId, localContentRef.current).then((saved) => {
        setSaveLabel(saved ? "Saved" : "Save failed");
        clearTimeout(feedbackTimer);
        feedbackTimer = setTimeout(() => setSaveLabel(""), 2000);
        return saved;
      });
      (event as CustomEvent<{ waitUntil?: (promise: Promise<boolean>) => void }>).detail?.waitUntil?.(promise);
    }
    document.addEventListener("daymark:force-save", onForceSave);
    return () => {
      document.removeEventListener("daymark:force-save", onForceSave);
      clearTimeout(feedbackTimer);
    };
  }, [activeNoteId, saveNote]);

  useEffect(() => {
    function openReview() { if (note?.date) setRitualMode("review"); }
    function openFocus() { if (note?.date) setFocusOpen(true); }
    document.addEventListener("daymark:review-day", openReview);
    document.addEventListener("daymark:open-focus", openFocus);
    return () => {
      document.removeEventListener("daymark:review-day", openReview);
      document.removeEventListener("daymark:open-focus", openFocus);
    };
  }, [note?.date]);

  useEffect(() => {
    function insertAIResponse(event: Event) {
      const detail = (event as CustomEvent<{ response: string; prompt: string }>).detail;
      if (!detail?.response) return;
      setLocalContent((current) => insertAIResponseUnderNotes(current, detail.response, detail.prompt));
    }
    document.addEventListener("daymark:insert-ai-response", insertAIResponse);
    return () => document.removeEventListener("daymark:insert-ai-response", insertAIResponse);
  }, []);

  const handleChange = useCallback((content: string) => {
    setLocalContent(content);
  }, []);

  const handleWikiLink = useCallback(
    (target: string) => {
      const resolved = resolveWikiLink(target, notes);
      if (resolved) openNote(resolved);
      else createNote(target, "Notes");
    },
    [notes, openNote, createNote],
  );

  const parsedTasks = useMemo(() => parseTasks(localContent, note?.date), [localContent, note?.date]);
  const dailyMetrics = useMemo(() => calculateDailyMetrics(localContent, note?.date), [localContent, note?.date]);
  const carryoverInsights = useMemo(() => {
    if (!note?.date) return [];
    const prior = [...notes.values()]
      .filter((candidate) => candidate.type === "daily" && candidate.date && candidate.date < note.date!)
      .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""))
      .slice(0, 14)
      .map((candidate) => ({ date: candidate.date!, content: candidate.content }));
    return findCarryoverInsights(localContent, prior, note.date);
  }, [localContent, note?.date, notes]);

  const completeFocusedTask = useCallback((lineIndex: number) => {
    const now = new Date();
    const doneDate = `${String(now.getDate()).padStart(2, "0")}/${String(now.getMonth() + 1).padStart(2, "0")}`;
    setLocalContent((current) => setTaskCompleted(current, lineIndex, true, doneDate));
  }, []);

  if (!note) {
    return (
      <div className="empty-state">
        <div className="empty-state-inner">
          <div className="empty-state-icon"><BookOpen size={48} strokeWidth={1.25} /></div>
          <h2>{PRODUCT_NAME}</h2>
          <p>Select a note or open today's daily note to get started.</p>
          <button
            className="btn-primary"
            onClick={() => openDailyNote(new Date().toISOString().slice(0, 10))}
          >
            Open Today's Note
          </button>
        </div>
      </div>
    );
  }

  const wordCount = localContent.trim()
    ? localContent.trim().split(/\s+/).length
    : 0;

  const taskCount = parsedTasks.filter((task) => task.state === "open").length;

  return (
    <div className="note-pane">
      <NoteEditor
        content={localContent}
        onChange={handleChange}
        onWikiLinkClick={handleWikiLink}
        autoFocus
      />
      {note.date && (
        <>
          <QuickTaskCapture
            noteId={note.id}
            noteDate={note.date}
            content={localContent}
            onChange={handleChange}
            onSave={(nextContent) => saveNote(note.id, nextContent)}
          />
          {taskSource === "native" ? (
            <NativeTasksPanel
              noteDate={note.date}
              content={localContent}
              onChange={handleChange}
              todoistAvailable={Boolean(settings.todoistApiToken)}
              onTodoistOpen={() => setTaskSource("todoist")}
            />
          ) : (
            <TodoistTodayPanel onNativeOpen={() => setTaskSource("native")} />
          )}
        </>
      )}
      <div className="note-statusbar">
        <span className="note-statusbar-title">{note.title}</span>
        <span className="note-statusbar-sep">·</span>
        <span>{wordCount} word{wordCount !== 1 ? "s" : ""}</span>
        {taskCount > 0 && (
          <>
            <span className="note-statusbar-sep">·</span>
            <span>{taskCount} open task{taskCount !== 1 ? "s" : ""}</span>
          </>
        )}
        <span className="note-statusbar-sep">·</span>
        <span className={`note-statusbar-save ${autoSaveState === "error" || saveLabel === "Save failed" ? "state-error" : saveLabel || autoSaveState === "saving" ? "state-saving" : ""}`}>
          {saveLabel || (autoSaveState === "saving" ? "Saving…" : autoSaveState === "error" ? "Save failed" : "")}
        </span>
        {note.date && (
          <span className="note-statusbar-actions">
            <button onClick={() => setFocusOpen(true)} title="Start focus sprint"><Timer size={11} />Focus</button>
            <span className="daily-score" title="Daily score based on completion and P1 progress"><Flame size={11} />{dailyMetrics.score}</span>
            {carryoverInsights.length > 0 && (
              <button className="carryover-trigger" onClick={() => setInsightsOpen((open) => !open)}>{carryoverInsights.length} stuck</button>
            )}
            <button onClick={() => setRitualMode("review")} title="Close day (⌘⇧E)"><Moon size={11} />Close</button>
          </span>
        )}
      </div>
      {insightsOpen && <CarryoverInsights insights={carryoverInsights} onClose={() => setInsightsOpen(false)} />}
      {focusOpen && (
        <FocusSprint tasks={parsedTasks} onComplete={completeFocusedTask} onClose={() => setFocusOpen(false)} />
      )}
      {ritualMode && note.date && (
        <DailyRitualModal
          mode={ritualMode}
          noteDate={note.date}
          content={localContent}
          onChange={handleChange}
          onClose={() => setRitualMode(null)}
        />
      )}
    </div>
  );
}

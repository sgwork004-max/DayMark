import React, { useEffect, useState } from "react";
import {
  Menu, AlignLeft,
  Sparkles, Network, Calendar, Keyboard, Settings, Timer,
} from "lucide-react";
import { useNotesStore } from "../store/notesStore.js";
import { DayNav } from "./DayNav.js";
import { VoiceButton } from "./VoiceButton.js";
import { PRODUCT_NAME } from "../brand.js";
import { FOCUS_STATE_EVENT, focusRemaining, readFocusSession, type FocusSessionState } from "../focusSession.js";

interface Props {
  onCalendarToggle: () => void;
  onSettingsOpen: () => void;
  onAIToggle: () => void;
  onGraphOpen: () => void;
  onTOCToggle: () => void;
  onShortcutsToggle: () => void;
}

export function Titlebar({ onCalendarToggle, onSettingsOpen, onAIToggle, onGraphOpen, onTOCToggle, onShortcutsToggle }: Props) {
  const { activeNoteId, notes, sidebarOpen, setSidebarOpen, openDailyNote } = useNotesStore();
  const note = activeNoteId ? notes.get(activeNoteId) : null;
  const [focusSession, setFocusSession] = useState<FocusSessionState | null>(() => readFocusSession());
  const [focusSeconds, setFocusSeconds] = useState(() => focusSession ? focusRemaining(focusSession) : 0);

  useEffect(() => {
    function syncFocus(event?: Event) {
      const next = (event as CustomEvent<FocusSessionState> | undefined)?.detail ?? readFocusSession();
      setFocusSession(next);
      setFocusSeconds(next ? focusRemaining(next) : 0);
    }
    syncFocus();
    const timer = window.setInterval(() => syncFocus(), 500);
    document.addEventListener(FOCUS_STATE_EVENT, syncFocus);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener(FOCUS_STATE_EVENT, syncFocus);
    };
  }, []);

  async function openFocus() {
    if (!note?.date) await openDailyNote(new Date().toISOString().slice(0, 10));
    window.setTimeout(() => document.dispatchEvent(new CustomEvent("daymark:open-focus")), 40);
  }

  const wordCount = note
    ? note.content.trim().split(/\s+/).filter(Boolean).length
    : 0;

  return (
    <header className="titlebar" data-tauri-drag-region>
      <div className="titlebar-left">
        <button className="titlebar-btn" onClick={() => setSidebarOpen(!sidebarOpen)} title="Toggle sidebar (⌘\)">
          <Menu size={16} strokeWidth={1.75} />
        </button>
      </div>

      <div className="titlebar-center">
        {note?.date ? (
          <DayNav />
        ) : (
          <span className="titlebar-title">{note?.title ?? PRODUCT_NAME}</span>
        )}
      </div>

      <div className="titlebar-right">
        {focusSession?.running && focusSeconds > 0 && (
          <button className="titlebar-focus-live" onClick={() => void openFocus()} title="Open focus sprint">
            <Timer size={13} />
            <span>{String(Math.floor(focusSeconds / 60)).padStart(2, "0")}:{String(focusSeconds % 60).padStart(2, "0")}</span>
          </button>
        )}
        {note && (
          <>
            <span className="titlebar-meta">{wordCount}w</span>
            <span className="titlebar-divider" />
            <button className="titlebar-btn" onClick={onTOCToggle}        title="Table of contents (⌘⇧O)">
              <AlignLeft size={15} strokeWidth={1.75} />
            </button>
          </>
        )}
        <span className="titlebar-divider" />
        <VoiceButton />
        <button className="titlebar-btn" onClick={onAIToggle}        title="AI assistant (⌘⇧A)">
          <Sparkles size={15} strokeWidth={1.75} />
        </button>
        <button className="titlebar-btn" onClick={onGraphOpen}       title="Graph view (⌘⇧G)">
          <Network size={15} strokeWidth={1.75} />
        </button>
        <button className="titlebar-btn" onClick={onCalendarToggle}  title="Calendar (⌘⇧C)">
          <Calendar size={15} strokeWidth={1.75} />
        </button>
        <span className="titlebar-divider" />
        <button className="titlebar-btn" onClick={onShortcutsToggle} title="Keyboard shortcuts (?)">
          <Keyboard size={15} strokeWidth={1.75} />
        </button>
        <button className="titlebar-btn" onClick={onSettingsOpen}    title="Settings (⌘,)">
          <Settings size={15} strokeWidth={1.75} />
        </button>
      </div>
    </header>
  );
}

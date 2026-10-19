import React from "react";
import { useNotesStore } from "../store/notesStore.js";
import { relativeLabel } from "@daymark/core";

export function DayNav() {
  const { activeNoteId, notes, navigateDay } = useNotesStore();
  const note = activeNoteId ? notes.get(activeNoteId) : null;

  if (!note?.date) return null;

  const label = relativeLabel(note.date);

  return (
    <div className="day-nav">
      <button
        className="day-nav-btn"
        onClick={() => navigateDay(-1)}
        aria-label="Previous day"
        title="Previous day (⌘←)"
      >
        ‹
      </button>
      <span className="day-nav-label">
        <span className="day-nav-relative">{label}</span>
        <span className="day-nav-date">{note.date}</span>
      </span>
      <button
        className="day-nav-btn"
        onClick={() => navigateDay(1)}
        aria-label="Next day"
        title="Next day (⌘→)"
      >
        ›
      </button>
    </div>
  );
}

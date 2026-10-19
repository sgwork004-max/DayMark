import React, { useMemo } from "react";
import { buildBacklinkIndex, getBacklinks } from "@daymark/core";
import { useNotesStore } from "../store/notesStore.js";

export function BacklinksPanel() {
  const { activeNoteId, notes, openNote } = useNotesStore();
  const activeNote = activeNoteId ? notes.get(activeNoteId) : null;

  const backlinks = useMemo(() => {
    if (!activeNote) return [];
    const index = buildBacklinkIndex(notes);
    return getBacklinks(activeNote.id, activeNote.title, index);
  }, [activeNote, notes]);

  if (!activeNote) return null;

  return (
    <div className="backlinks-panel">
      <div className="backlinks-header">
        <span className="backlinks-title">Backlinks</span>
        <span className="backlinks-count">{backlinks.length}</span>
      </div>

      {backlinks.length === 0 ? (
        <div className="backlinks-empty">No notes link to "{activeNote.title}"</div>
      ) : (
        <ul className="backlinks-list">
          {backlinks.map((bl, i) => (
            <li key={`${bl.noteId}-${i}`} className="backlink-item">
              <button
                className="backlink-note-title"
                onClick={() => openNote(bl.noteId)}
              >
                {bl.noteTitle}
              </button>
              <p className="backlink-excerpt">{bl.excerpt}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

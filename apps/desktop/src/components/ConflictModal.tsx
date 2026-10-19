import React, { useMemo } from "react";
import { AlertTriangle } from "lucide-react";
import { useNotesStore } from "../store/notesStore.js";

export function ConflictModal() {
  const { pendingConflict, notes, resolveConflict } = useNotesStore();
  if (!pendingConflict) return null;

  const note = notes.get(pendingConflict.noteId);
  const localContent  = note?.content ?? "";
  const diskContent   = pendingConflict.diskContent;

  const localLines  = localContent.split("\n").length;
  const diskLines   = diskContent.split("\n").length;

  function keepLocal() {
    resolveConflict("keep-local");
  }

  function reloadDisk() {
    resolveConflict("reload-disk");
  }

  return (
    <div className="modal-backdrop">
      <div className="conflict-modal">
        <div className="conflict-header">
          <span className="conflict-icon"><AlertTriangle size={18} strokeWidth={2} /></span>
          <div>
            <div className="conflict-title">File changed on disk</div>
            <div className="conflict-subtitle">
              {note?.title ?? pendingConflict.noteId.split("/").pop()} was modified externally
            </div>
          </div>
        </div>

        <div className="conflict-diff">
          <div className="conflict-side">
            <div className="conflict-side-label">Your version</div>
            <div className="conflict-side-stat">{localLines} lines</div>
            <pre className="conflict-preview">{localContent.slice(0, 300)}{localContent.length > 300 ? "…" : ""}</pre>
          </div>
          <div className="conflict-divider">vs</div>
          <div className="conflict-side">
            <div className="conflict-side-label">Disk version</div>
            <div className="conflict-side-stat">{diskLines} lines</div>
            <pre className="conflict-preview">{diskContent.slice(0, 300)}{diskContent.length > 300 ? "…" : ""}</pre>
          </div>
        </div>

        <div className="conflict-actions">
          <button className="btn-ghost" onClick={keepLocal}>
            Keep My Changes
          </button>
          <button className="btn-primary" onClick={reloadDisk}>
            Reload from Disk
          </button>
        </div>
      </div>
    </div>
  );
}

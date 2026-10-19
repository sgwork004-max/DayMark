import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { useNotesStore } from "../store/notesStore.js";
import { consumeExpectedFileWrite } from "../persistence.js";

interface FileChangedPayload {
  path: string;
  kind: "created" | "modified" | "removed";
}

export function useFileWatcher() {
  const store = useNotesStore;

  useEffect(() => {
    let unlisten: (() => void) | null = null;

    listen<FileChangedPayload>("vault:file-changed", async (event) => {
      const { path, kind } = event.payload;
      const { notes, activeNoteId, settings } = store.getState();

      // Ignore events from our own writes (debounce window)
      const note = notes.get(path);
      if (!note) {
        // New file appeared — reload index
        if (kind === "created") {
          store.getState().loadAllNotes();
        }
        return;
      }

      if (kind === "removed") {
        store.setState((s) => {
          const next = new Map(s.notes);
          next.delete(path);
          return {
            notes: next,
            activeNoteId: s.activeNoteId === path ? null : s.activeNoteId,
          };
        });
        return;
      }

      // Modified — if it's the active note and we have it open, show conflict dialog
      if (kind === "modified" && path === activeNoteId) {
        try {
          const diskContent = await invoke<string>("read_note_from_disk", { path });
          if (consumeExpectedFileWrite(path, diskContent)) return;
          if (diskContent !== note.content) {
            store.setState({ pendingConflict: { noteId: path, diskContent } });
          }
        } catch {
          // ignore read errors
        }
        return;
      }

      // Background note changed — silently reload it
      if (kind === "modified") {
        try {
          const diskContent = await invoke<string>("read_note_from_disk", { path });
          if (consumeExpectedFileWrite(path, diskContent)) return;
          store.getState().reloadNoteContent(path, diskContent);
        } catch {
          // ignore
        }
      }
    }).then((fn) => {
      unlisten = fn;
    });

    return () => {
      unlisten?.();
    };
  }, [store]);
}

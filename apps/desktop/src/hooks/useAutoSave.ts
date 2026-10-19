import { useEffect, useRef, useState } from "react";
import { useNotesStore } from "../store/notesStore.js";

const DEBOUNCE_MS = 500;

export type SaveState = "saved" | "saving" | "error" | "idle";

export function useAutoSave(noteId: string | null, content: string): SaveState {
  const saveNote   = useNotesStore((s) => s.saveNote);
  const timerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSaved  = useRef(content);
  const [state, setState] = useState<SaveState>("idle");
  const previousNoteId = useRef(noteId);

  // Keep refs current so the unmount cleanup always sees the latest values.
  const noteIdRef  = useRef(noteId);
  const contentRef = useRef(content);
  noteIdRef.current  = noteId;
  contentRef.current = content;

  useEffect(() => {
    if (previousNoteId.current === noteId) return;
    previousNoteId.current = noteId;
    lastSaved.current = content;
    setState("idle");
  }, [noteId, content]);

  useEffect(() => {
    if (!noteId || content === lastSaved.current) return;

    setState("saving");
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      const saved = await saveNote(noteId, content);
      if (saved) {
        lastSaved.current = content;
        setState("saved");
        setTimeout(() => setState("idle"), 2000);
      } else {
        setState("error");
      }
    }, DEBOUNCE_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [noteId, content, saveNote]);

  // Save on unmount — uses refs so it always sees the latest values.
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      const id  = noteIdRef.current;
      const txt = contentRef.current;
      if (id && txt !== lastSaved.current) {
        void saveNote(id, txt).then((saved) => {
          if (saved) lastSaved.current = txt;
        });
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return state;
}

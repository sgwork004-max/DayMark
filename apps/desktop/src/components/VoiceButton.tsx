import React, { useEffect, useRef } from "react";
import { Mic, Square } from "lucide-react";
import { useVoiceRecorder } from "../hooks/useVoiceRecorder.js";
import { useNotesStore } from "../store/notesStore.js";

export function VoiceButton() {
  const { state, transcript, start, stop, clear, error } = useVoiceRecorder();
  const { activeNoteId, notes, saveNote } = useNotesStore();
  const appendedTranscript = useRef("");

  // When transcript updates and we stop recording, append to note
  useEffect(() => {
    if (state === "idle" && transcript && transcript !== appendedTranscript.current) {
      const note = activeNoteId ? notes.get(activeNoteId) : null;
      if (!note || !activeNoteId) return;
      appendedTranscript.current = transcript;
      const timestamp = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      const insertion = `\n\n*Voice note (${timestamp}):* ${transcript.trim()}\n`;
      void saveNote(activeNoteId, note.content + insertion).then((saved) => {
        if (saved) clear();
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  function toggle() {
    if (state === "recording") void stop();
    else if (state === "idle") {
      appendedTranscript.current = "";
      void start();
    }
  }

  return (
    <button
      className={`titlebar-btn voice-btn ${state === "recording" ? "recording" : ""}`}
      onClick={toggle}
      disabled={state === "starting" || state === "stopping"}
      title={error ?? (state === "recording" ? "Stop recording and add to note" : "Dictate into the current note")}
    >
      {state === "recording" ? <Square size={14} strokeWidth={2} fill="currentColor" /> : <Mic size={15} strokeWidth={1.75} />}
      {error && <span className="voice-error-dot" title={error} />}
    </button>
  );
}

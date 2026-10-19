import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

type RecordingState = "idle" | "starting" | "recording" | "stopping";

interface VoiceStatus {
  recording: boolean;
  transcript: string;
  error: string;
}

interface UseVoiceRecorder {
  state: RecordingState;
  transcript: string;
  start: () => Promise<void>;
  stop: () => Promise<void>;
  clear: () => void;
  error: string | null;
}

export function useVoiceRecorder(): UseVoiceRecorder {
  const [state, setState] = useState<RecordingState>("idle");
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const pollingRef = useRef<number | null>(null);

  const stopPolling = useCallback(() => {
    if (pollingRef.current !== null) window.clearInterval(pollingRef.current);
    pollingRef.current = null;
  }, []);

  const pollStatus = useCallback(async () => {
    try {
      const status = await invoke<VoiceStatus>("get_voice_dictation_status");
      setTranscript(status.transcript);
      if (status.error) setError(status.error);
      if (!status.recording) {
        stopPolling();
        setState("idle");
      }
    } catch (cause) {
      stopPolling();
      setError(cause instanceof Error ? cause.message : String(cause));
      setState("idle");
    }
  }, [stopPolling]);

  const start = useCallback(async () => {
    if (state !== "idle") return;
    setError(null);
    setTranscript("");
    setState("starting");
    try {
      await invoke("start_voice_dictation");
      setState("recording");
      pollingRef.current = window.setInterval(() => void pollStatus(), 300);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      setState("idle");
    }
  }, [pollStatus, state]);

  const stop = useCallback(async () => {
    if (state !== "recording") return;
    setState("stopping");
    stopPolling();
    try {
      const finalTranscript = await invoke<string>("stop_voice_dictation");
      setTranscript(finalTranscript);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setState("idle");
    }
  }, [state, stopPolling]);

  const clear = useCallback(() => {
    setTranscript("");
    setError(null);
  }, []);

  useEffect(() => () => stopPolling(), [stopPolling]);

  return { state, transcript, start, stop, clear, error };
}

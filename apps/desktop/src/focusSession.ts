export interface FocusSessionState {
  taskLine: number;
  duration: number;
  remaining: number;
  running: boolean;
  endAt: number | undefined;
}

export const FOCUS_STORAGE_KEY = "manager.focus-sprint";
export const FOCUS_STATE_EVENT = "manager:focus-state";

export function readFocusSession(): FocusSessionState | null {
  try {
    const session = JSON.parse(localStorage.getItem(FOCUS_STORAGE_KEY) ?? "null") as FocusSessionState | null;
    if (!session) return null;
    return { ...session, remaining: focusRemaining(session) };
  } catch {
    return null;
  }
}

export function focusRemaining(session: FocusSessionState): number {
  return session.running && session.endAt
    ? Math.max(0, Math.ceil((session.endAt - Date.now()) / 1000))
    : session.remaining;
}

export function persistFocusSession(session: FocusSessionState): void {
  localStorage.setItem(FOCUS_STORAGE_KEY, JSON.stringify(session));
  document.dispatchEvent(new CustomEvent(FOCUS_STATE_EVENT, { detail: session }));
}

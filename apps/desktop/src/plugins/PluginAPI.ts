import { useNotesStore } from "../store/notesStore.js";

export interface PluginCommand {
  pluginName: string;
  commandKey: string;
  label: string;
  run: () => void | Promise<void>;
}

export interface ManagerPluginAPI {
  getCurrentNote(): { id: string; title: string; content: string } | null;
  saveNote(id: string, content: string): Promise<void>;
  insertTextAtEnd(text: string): Promise<void>;
  insertTextAtCursor(text: string): void;
  showToast(message: string, durationMs?: number): void;
  getVaultPath(): string;
  today(): string;
}

let _toastEl: HTMLDivElement | null = null;

function showToast(message: string, durationMs = 3000) {
  if (!_toastEl) {
    _toastEl = document.createElement("div");
    _toastEl.style.cssText = `
      position:fixed;bottom:24px;left:50%;transform:translateX(-50%);
      background:#2a2a2a;color:#e8e8e8;border:1px solid #3a3a3a;
      border-radius:8px;padding:8px 16px;font-size:13px;
      box-shadow:0 8px 32px rgba(0,0,0,.4);z-index:9999;
      pointer-events:none;transition:opacity 0.2s;
    `;
    document.body.appendChild(_toastEl);
  }
  _toastEl.textContent = message;
  _toastEl.style.opacity = "1";
  clearTimeout((_toastEl as HTMLDivElement & { _timer?: ReturnType<typeof setTimeout> })._timer);
  (_toastEl as HTMLDivElement & { _timer?: ReturnType<typeof setTimeout> })._timer = setTimeout(() => {
    if (_toastEl) _toastEl.style.opacity = "0";
  }, durationMs);
}

export function buildPluginAPI(): ManagerPluginAPI {
  return {
    getCurrentNote() {
      const { activeNoteId, notes } = useNotesStore.getState();
      const note = activeNoteId ? notes.get(activeNoteId) : null;
      if (!note) return null;
      return { id: note.id, title: note.title, content: note.content };
    },

    async saveNote(id, content) {
      await useNotesStore.getState().saveNote(id, content);
    },

    async insertTextAtEnd(text) {
      const { activeNoteId, notes, saveNote } = useNotesStore.getState();
      if (!activeNoteId) return;
      const note = notes.get(activeNoteId);
      if (!note) return;
      await saveNote(activeNoteId, `${note.content}\n${text}`);
    },

    insertTextAtCursor(text) {
      // Try to insert at active CodeMirror cursor via custom event
      document.dispatchEvent(new CustomEvent("daymark:insert-text", { detail: text }));
    },

    showToast,

    getVaultPath() {
      return useNotesStore.getState().settings.vaultPath;
    },

    today() {
      return new Date().toISOString().slice(0, 10);
    },
  };
}

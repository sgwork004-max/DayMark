import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import {
  today, dailyNoteFilename, dailyNoteTitle, addDays, toISODate, fromISODate,
  periodicFilename, periodicFolder, periodicNoteTitle, periodicDefaultContent,
  migrateDailyAgenda, rolloverOpenTasks,
  type PeriodicType,
} from "@daymark/core";
import type { Note, AppSettings } from "@daymark/core";
import { parseTasks, extractTags, extractMentions } from "@daymark/core";
import { expectFileWrite } from "../persistence.js";
import { cancelNativeTaskReminder } from "../taskNotifications.js";
import { showAppNotice } from "../appNotice.js";

export interface PendingConflict {
  noteId: string;
  diskContent: string;
}

interface NoteFile {
  path: string;
  filename: string;
  content: string;
  modified_at: number;
  created_at: number;
}

interface NoteStub {
  path: string;
  filename: string;
  modified_at: number;
}

export type SmartViewId = "today" | "overdue" | "upcoming" | "all";
export interface EntityFilter { kind: "tag" | "mention"; value: string }

interface NotesState {
  settings: AppSettings;
  notes: Map<string, Note>;
  activeNoteId: string | null;
  activeSmartView: SmartViewId | null;
  activeEntityFilter: EntityFilter | null;
  recentNoteIds: string[];
  sidebarOpen: boolean;
  loading: boolean;
  initialized: boolean;
  /** ⌘K palette */
  paletteOpen: boolean;
  paletteQuery: string;
  /** iCloud / external file conflict */
  pendingConflict: PendingConflict | null;

  // Actions
  init: () => Promise<void>;
  setVaultPath: (path: string) => Promise<void>;
  updateSettings: (partial: Partial<AppSettings>) => Promise<void>;
  reloadNoteContent: (id: string, content: string) => void;
  resolveConflict: (resolution: "keep-local" | "reload-disk") => Promise<void>;
  openDailyNote: (date: string) => Promise<void>;
  navigateDay: (delta: number) => void;
  openNote: (id: string) => Promise<void>;
  openSmartView: (id: SmartViewId) => void;
  openEntityFilter: (kind: EntityFilter["kind"], value: string) => Promise<void>;
  openPeriodicNote: (type: PeriodicType, referenceDate?: string) => Promise<void>;
  saveNote: (id: string, content: string) => Promise<boolean>;
  createNote: (title: string, folder?: string) => Promise<void>;
  deleteNote: (id: string) => Promise<void>;
  renameNote: (id: string, newTitle: string) => Promise<void>;
  loadAllNotes: () => Promise<void>;
  loadAllNotesWithContent: () => Promise<void>;
  setSidebarOpen: (open: boolean) => void;
  setPaletteOpen: (open: boolean) => void;
  setPaletteQuery: (q: string) => void;
}

const DEFAULT_SETTINGS: AppSettings = {
  vaultPath: "",
  theme: "dark",
  fontSize: 15,
  fontFamily: "system-ui",
  firstDayOfWeek: 1,
  calendarEnabled: false,
  geminiApiKey: "",
  pluginsEnabled: false,
};

const SECRET_KEYS = {
  geminiApiKey: "gemini_api_key",
} as const;

const pendingNoteWrites = new Map<string, Promise<boolean>>();

function queueNoteWrite(path: string, content: string): Promise<boolean> {
  const previous = pendingNoteWrites.get(path) ?? Promise.resolve(true);
  const next = previous.then(async () => {
    expectFileWrite(path, content);
    try {
      await invoke("write_note", { path, content });
      return true;
    } catch (error) {
      console.error("Failed to save note", error);
      return false;
    }
  });
  pendingNoteWrites.set(path, next);
  void next.finally(() => {
    if (pendingNoteWrites.get(path) === next) pendingNoteWrites.delete(path);
  });
  return next;
}

export async function flushPendingNoteWrites(): Promise<boolean> {
  const results = await Promise.all([...pendingNoteWrites.values()]);
  return results.every(Boolean);
}

async function loadSecret(key: string): Promise<string> {
  return invoke<string>("get_secret", { key }).catch(() => "");
}

async function persistSettings(settings: AppSettings): Promise<void> {
  await invoke("save_settings", { settingsJson: JSON.stringify(settings) });
}

/** Derive daily note date from filename like 20250613.md */
function dateFromFilename(filename: string): string | undefined {
  const m = /^(\d{4})(\d{2})(\d{2})\.md$/.exec(filename);
  if (!m) return undefined;
  return `${m[1]}-${m[2]}-${m[3]}`;
}

function stubToNote(stub: NoteStub, content: string, date?: string): Note {
  const tasks = parseTasks(content, date);
  const note: Note = {
    id: stub.path,
    type: date ? "daily" : "project",
    title: date ? dailyNoteTitle(date) : stub.filename.replace(/\.md$/, ""),
    filePath: stub.path,
    content,
    tasks,
    tags: extractTags(content),
    mentions: extractMentions(content),
    backlinks: [],
    updatedAt: stub.modified_at * 1000,
    createdAt: stub.modified_at * 1000,
  };
  if (date !== undefined) note.date = date;
  return note;
}

function defaultDailyContent(date: string): string {
  return `# ${dailyNoteTitle(date)}

## Today's Agenda
### P1
- [ ]

### P2
- [ ]

### P3
- [ ]

### Misc
- [ ]

## Notes

`;
}

export const useNotesStore = create<NotesState>((set, get) => ({
  settings: DEFAULT_SETTINGS,
  notes: new Map(),
  activeNoteId: null,
  activeSmartView: null,
  activeEntityFilter: null,
  recentNoteIds: [],
  sidebarOpen: true,
  loading: false,
  initialized: false,
  paletteOpen: false,
  paletteQuery: "",
  pendingConflict: null,

  init: async () => {
    // Load persisted settings
    const settingsJson = await invoke<string>("load_settings");
    // Older versions also stored settings for since-removed integrations.
    let savedSettings: Partial<AppSettings> & {
      todoistApiToken?: string;
      aiGatewayUrl?: string;
      aiDeviceId?: string;
    } = {};
    try { savedSettings = JSON.parse(settingsJson); } catch { /* ignore */ }
    if (savedSettings.fontFamily?.startsWith("-apple-system")) {
      savedSettings.fontFamily = "system-ui";
    }

    const legacyGeminiKey = savedSettings.geminiApiKey?.trim() ?? "";
    if (legacyGeminiKey) {
      await invoke("set_secret", { key: SECRET_KEYS.geminiApiKey, value: legacyGeminiKey }).catch(() => {});
    }
    const geminiApiKey = await loadSecret(SECRET_KEYS.geminiApiKey);
    // Settings from removed integrations.
    delete savedSettings.geminiApiKey;
    delete savedSettings.todoistApiToken;
    delete savedSettings.aiGatewayUrl;
    delete savedSettings.aiDeviceId;

    const vaultPath: string =
      (savedSettings.vaultPath as string | undefined) ||
      (await invoke<string>("default_vault_path"));


    set((s) => ({
      settings: {
        ...s.settings,
        ...savedSettings,
        vaultPath,
        geminiApiKey,
      },
      initialized: true,
    }));
    await persistSettings(get().settings);

    // Start file watcher
    invoke("start_file_watcher", { vaultPath }).catch(() => {
      // File watching is best-effort — vault may not exist yet
    });
  },

  updateSettings: async (partial) => {
    if (partial.geminiApiKey !== undefined) {
      const value = partial.geminiApiKey.trim();
      await invoke(value ? "set_secret" : "delete_secret", {
        key: SECRET_KEYS.geminiApiKey,
        ...(value ? { value } : {}),
      });
    }
    // Persist first: the native side refuses vault folders the user did not choose.
    await persistSettings({ ...get().settings, ...partial });
    set((s) => ({ settings: { ...s.settings, ...partial } }));

    if (partial.vaultPath) {
      // Restart watcher and refresh note list
      await invoke("stop_file_watcher").catch(() => {});
      await invoke("start_file_watcher", { vaultPath: partial.vaultPath }).catch(() => {});
      set({ notes: new Map(), activeNoteId: null, activeSmartView: null });
    }
  },

  reloadNoteContent: (id, content) => {
    const note = get().notes.get(id);
    if (!note) return;
    const updated: Note = {
      ...note,
      content,
      tasks: parseTasks(content, note.date),
      tags: extractTags(content),
      mentions: extractMentions(content),
      updatedAt: Date.now(),
    };
    set((s) => {
      const next = new Map(s.notes);
      next.set(id, updated);
      return { notes: next };
    });
  },

  resolveConflict: async (resolution) => {
    const { pendingConflict } = get();
    if (!pendingConflict) return;

    if (resolution === "reload-disk") {
      get().reloadNoteContent(pendingConflict.noteId, pendingConflict.diskContent);
    } else {
      // keep-local: overwrite disk with our version
      const note = get().notes.get(pendingConflict.noteId);
      if (note) {
        const saved = await get().saveNote(note.id, note.content);
        if (!saved) return;
      }
    }
    set({ pendingConflict: null });
  },

  setVaultPath: async (path) => {
    await get().updateSettings({ vaultPath: path });
    await get().loadAllNotesWithContent();
  },

  openDailyNote: async (date: string) => {
    const { settings, notes } = get();
    const filename = dailyNoteFilename(date);
    const path = `${settings.vaultPath}/Daily/${filename}`;
    const existing = notes.get(path);

    set({ activeSmartView: null, activeEntityFilter: null });

    if (existing) {
      let migrated = migrateDailyAgenda(existing.content);
      if (date === today()) {
        const previousDate = toISODate(addDays(fromISODate(date), -1));
        const previousPath = `${settings.vaultPath}/Daily/${dailyNoteFilename(previousDate)}`;
        let previous = notes.get(previousPath);
        if (!previous) {
          try {
            const file = await invoke<NoteFile>("read_note", { path: previousPath });
            previous = stubToNote(file, file.content, previousDate);
          } catch { /* A missing previous day is normal. */ }
        }
        if (previous) {
          const rollover = rolloverOpenTasks(previous.content, migrated, previousDate, date);
          migrated = rollover.targetContent;
          if (rollover.sourceContent !== previous.content) {
            await queueNoteWrite(previousPath, rollover.sourceContent);
            const updatedPrevious = stubToNote(
              { path: previous.id, filename: dailyNoteFilename(previousDate), modified_at: Date.now() / 1000 },
              rollover.sourceContent,
              previousDate,
            );
            set((state) => ({ notes: new Map(state.notes).set(previousPath, updatedPrevious) }));
          }
        }
      }
      if (migrated !== existing.content) await get().saveNote(path, migrated);
      set({ activeNoteId: path });
      return;
    }

    set({ loading: true });
    try {
      const file = await invoke<NoteFile>("ensure_note_exists", {
        path,
        defaultContent: defaultDailyContent(date),
      });
      let migrated = migrateDailyAgenda(file.content);
      if (date === today()) {
        const previousDate = toISODate(addDays(fromISODate(date), -1));
        const previousPath = `${settings.vaultPath}/Daily/${dailyNoteFilename(previousDate)}`;
        let previous = notes.get(previousPath);
        if (!previous) {
          try {
            const previousFile = await invoke<NoteFile>("read_note", { path: previousPath });
            previous = stubToNote(previousFile, previousFile.content, previousDate);
          } catch { /* A missing previous day is normal. */ }
        }
        if (previous) {
          const rollover = rolloverOpenTasks(previous.content, migrated, previousDate, date);
          migrated = rollover.targetContent;
          if (rollover.sourceContent !== previous.content) {
            await queueNoteWrite(previousPath, rollover.sourceContent);
          }
        }
      }
      if (migrated !== file.content) await queueNoteWrite(file.path, migrated);
      const note = stubToNote(
        { path: file.path, filename: file.filename, modified_at: file.modified_at },
        migrated,
        date,
      );
      set((s) => {
        const next = new Map(s.notes);
        next.set(path, note);
        return { notes: next, activeNoteId: path, loading: false };
      });
    } catch (e) {
      console.error("Failed to open daily note", e);
      showAppNotice(`Could not open the daily note: ${String(e)}`);
      set({ loading: false });
    }
  },

  navigateDay: (delta: number) => {
    const { notes, activeNoteId } = get();
    if (!activeNoteId) {
      get().openDailyNote(today());
      return;
    }
    const active = notes.get(activeNoteId);
    const date = active?.date ?? today();
    const next = toISODate(addDays(fromISODate(date), delta));
    get().openDailyNote(next);
  },

  openNote: async (id: string) => {
    const { notes } = get();
    set({ activeSmartView: null, activeEntityFilter: null });
    if (notes.has(id)) {
      set({ activeNoteId: id });
      return;
    }
    set({ loading: true });
    try {
      const file = await invoke<NoteFile>("read_note", { path: id });
      const date = dateFromFilename(file.filename);
      const note = stubToNote(
        { path: file.path, filename: file.filename, modified_at: file.modified_at },
        file.content,
        date,
      );
      set((s) => {
        const next = new Map(s.notes);
        next.set(id, note);
        return { notes: next, activeNoteId: id, loading: false };
      });
    } catch (e) {
      console.error("Failed to open note", e);
      showAppNotice(`Could not open the note: ${String(e)}`);
      set({ loading: false });
    }
  },

  openSmartView: (id: SmartViewId) => {
    set({ activeSmartView: id, activeEntityFilter: null, activeNoteId: null });
  },

  openEntityFilter: async (kind, value) => {
    await get().loadAllNotesWithContent();
    set({ activeEntityFilter: { kind, value }, activeSmartView: null, activeNoteId: null });
  },

  openPeriodicNote: async (type: PeriodicType, referenceDate?: string) => {
    const { settings, notes } = get();
    const filename = periodicFilename(type, referenceDate);
    const folder   = periodicFolder(type);
    const path     = `${settings.vaultPath}/${folder}/${filename}`;
    const existing = notes.get(path);

    set({ activeSmartView: null, activeEntityFilter: null });

    if (existing) { set({ activeNoteId: path }); return; }

    set({ loading: true });
    try {
      const defaultContent = periodicDefaultContent(type, referenceDate);
      const file = await invoke<NoteFile>("ensure_note_exists", { path, defaultContent });
      const note: Note = {
        id: file.path,
        type,
        title: periodicNoteTitle(type, referenceDate),
        filePath: file.path,
        content: file.content,
        tasks: parseTasks(file.content),
        tags: extractTags(file.content),
        mentions: extractMentions(file.content),
        backlinks: [],
        updatedAt: file.modified_at * 1000,
        createdAt: file.modified_at * 1000,
      };
      set((s) => {
        const next = new Map(s.notes);
        next.set(path, note);
        return { notes: next, activeNoteId: path, loading: false };
      });
    } catch (e) {
      console.error("Failed to open periodic note", e);
      showAppNotice(`Could not open the periodic note: ${String(e)}`);
      set({ loading: false });
    }
  },

  saveNote: async (id: string, content: string) => {
    const { notes } = get();
    const note = notes.get(id);
    if (!note) return false;

    const updated: Note = {
      ...note,
      content,
      tasks: parseTasks(content, note.date),
      tags: extractTags(content),
      mentions: extractMentions(content),
      updatedAt: Date.now(),
    };

    set((s) => {
      const next = new Map(s.notes);
      next.set(id, updated);
      return { notes: next };
    });

    const saved = await queueNoteWrite(id, content);
    if (!saved) {
      set((state) => {
        const current = state.notes.get(id);
        if (!current || current.content !== content) return state;
        const next = new Map(state.notes);
        next.set(id, note);
        return { notes: next };
      });
    } else {
      const completedReminders = note.tasks.filter((task) => {
        if (!task.reminderDate) return false;
        const replacement = updated.tasks.find((candidate) => candidate.lineIndex === task.lineIndex);
        return !replacement || replacement.state !== "open";
      });
      await Promise.all(
        completedReminders.map((task) => cancelNativeTaskReminder(note.id, task.lineIndex)),
      );
    }
    return saved;
  },

  loadAllNotes: async () => {
    const { settings } = get();
    set({ loading: true });
    try {
      const stubs = await invoke<NoteStub[]>("list_notes", { vaultPath: settings.vaultPath });
      set({
        recentNoteIds: stubs.slice(0, 50).map((s) => s.path),
        loading: false,
      });
    } catch (e) {
      console.error("Failed to load notes", e);
      showAppNotice(`Could not read the vault: ${String(e)}`);
      set({ loading: false });
    }
  },

  /** Load ALL notes with full content into memory for smart views + search */
  loadAllNotesWithContent: async () => {
    const { settings } = get();
    try {
      const stubs = await invoke<NoteStub[]>("list_notes", { vaultPath: settings.vaultPath });
      const loaded = new Map<string, Note>(get().notes);

      // Load in parallel batches of 20
      const batchSize = 20;
      for (let i = 0; i < stubs.length; i += batchSize) {
        const batch = stubs.slice(i, i + batchSize);
        await Promise.all(
          batch.map(async (stub) => {
            const existing = loaded.get(stub.path);
            if (existing && existing.updatedAt >= stub.modified_at * 1000) return;
            try {
              const file = await invoke<NoteFile>("read_note", { path: stub.path });
              const date = dateFromFilename(file.filename);
              const note = stubToNote(stub, file.content, date);
              loaded.set(stub.path, note);
            } catch {
              // skip unreadable files
            }
          }),
        );
      }

      set({ notes: loaded, recentNoteIds: stubs.slice(0, 50).map((s) => s.path) });
    } catch (e) {
      console.error("Failed to load all notes", e);
    }
  },

  createNote: async (title: string, folder = "Notes") => {
    const { settings } = get();
    const baseTitle = title.trim() || "Untitled";
    for (let copy = 1; copy <= 999; copy += 1) {
      const candidateTitle = copy === 1 ? baseTitle : `${baseTitle} ${copy}`;
      const safeName = candidateTitle.replace(/[/\\?%*:|"<>]/g, "-").trim();
      const path = `${settings.vaultPath}/${folder}/${safeName}.md`;
      const content = `# ${candidateTitle}\n\n`;
      try {
        const file = await invoke<NoteFile>("create_note", { path, content });
        const note = stubToNote(
          { path: file.path, filename: file.filename, modified_at: file.modified_at },
          file.content,
        );
        set((state) => {
          const next = new Map(state.notes);
          next.set(path, note);
          return { notes: next, activeNoteId: path, activeSmartView: null };
        });
        return;
      } catch (error) {
        if (String(error).includes("already exists")) continue;
        console.error("Failed to create note", error);
        showAppNotice(`Could not create the note: ${String(error)}`);
        return;
      }
    }
    showAppNotice("Could not find an available filename for this note.");
  },

  deleteNote: async (id: string) => {
    const { settings } = get();
    await invoke("delete_note", { path: id });
    set((s) => {
      const next = new Map(s.notes);
      next.delete(id);
      return {
        notes: next,
        activeNoteId: s.activeNoteId === id ? null : s.activeNoteId,
        recentNoteIds: s.recentNoteIds.filter((rid) => rid !== id),
      };
    });
  },

  renameNote: async (id: string, newTitle: string) => {
    const note = get().notes.get(id);
    if (!note) return;
    // Update the title in frontmatter / first heading
    let newContent = note.content;
    const firstHeading = /^# .+/m.exec(newContent);
    if (firstHeading) {
      newContent = newContent.replace(firstHeading[0], `# ${newTitle}`);
    } else {
      newContent = `# ${newTitle}\n\n${newContent}`;
    }
    // Rename the file
    const dir = id.substring(0, id.lastIndexOf("/"));
    const safeName = newTitle.replace(/[/\\?%*:|"<>]/g, "-").trim();
    const newPath = `${dir}/${safeName}.md`;
    let file: NoteFile;
    try {
      file = await invoke<NoteFile>("rename_note", { path: id, newPath, content: newContent });
    } catch (error) {
      console.error("Failed to rename note", error);
      showAppNotice(`Could not rename the note: ${String(error)}`);
      return;
    }
    const renamed = stubToNote(
      { path: file.path, filename: file.filename, modified_at: file.modified_at },
      file.content,
      note.date,
    );
    set((s) => {
      const next = new Map(s.notes);
      next.delete(id);
      next.set(newPath, renamed);
      return {
        notes: next,
        activeNoteId: s.activeNoteId === id ? newPath : s.activeNoteId,
        recentNoteIds: s.recentNoteIds.map((rid) => rid === id ? newPath : rid),
      };
    });
  },

  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  setPaletteOpen: (open) => set({ paletteOpen: open, paletteQuery: open ? "" : get().paletteQuery }),
  setPaletteQuery: (q) => set({ paletteQuery: q }),
}));

if (import.meta.env.DEV) {
  (window as unknown as Record<string, unknown>).__notesStore = useNotesStore;
}

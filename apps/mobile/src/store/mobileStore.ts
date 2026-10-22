import { create } from "zustand";
import * as FileSystem from "expo-file-system";
import {
  today, dailyNoteFilename, dailyNoteTitle, addDays, toISODate, fromISODate,
  parseTasks, extractTags, extractMentions,
  getOverdueTasks, getTodayTasks, getUpcomingTasks,
  type Note,
} from "@daymark/core";

// On iOS the iCloud document directory is exposed when iCloud entitlements are set.
// Fall back to documentDirectory for simulator / Android.
const BASE_DIR: string =
  (FileSystem as unknown as { iCloudDirectory?: string | null }).iCloudDirectory ??
  FileSystem.documentDirectory ??
  "";

const VAULT_PATH = BASE_DIR.endsWith("/") ? `${BASE_DIR}DayMark` : `${BASE_DIR}/DayMark`;

export type SmartViewId = "today" | "overdue" | "upcoming";

interface MobileState {
  vaultPath: string;
  notes: Map<string, Note>;
  activeNoteId: string | null;
  activeSmartView: SmartViewId | null;
  recentIds: string[];
  initialized: boolean;

  init: () => Promise<void>;
  openDailyNote: (date: string) => Promise<void>;
  navigateDay: (delta: number) => void;
  openNote: (id: string) => Promise<void>;
  openSmartView: (id: SmartViewId) => void;
  saveNote: (id: string, content: string) => Promise<void>;
  loadAllNotes: () => Promise<void>;
}

async function ensureDir(dir: string) {
  const info = await FileSystem.getInfoAsync(dir);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  }
}

async function readFile(path: string): Promise<string | null> {
  try {
    const info = await FileSystem.getInfoAsync(path);
    if (!info.exists) return null;
    return await FileSystem.readAsStringAsync(path);
  } catch {
    return null;
  }
}

async function writeFile(path: string, content: string) {
  const dir = path.substring(0, path.lastIndexOf("/"));
  await ensureDir(dir);
  await FileSystem.writeAsStringAsync(path, content);
}

function buildNote(path: string, content: string, date?: string): Note {
  const filename = path.split("/").pop() ?? "";
  const note: Note = {
    id: path,
    type: date ? "daily" : "project",
    title: date ? dailyNoteTitle(date) : filename.replace(/\.md$/, ""),
    filePath: path,
    content,
    tasks: parseTasks(content, date),
    tags: extractTags(content),
    mentions: extractMentions(content),
    backlinks: [],
    updatedAt: Date.now(),
    createdAt: Date.now(),
  };
  if (date !== undefined) note.date = date;
  return note;
}

function dateFromFilename(filename: string): string | undefined {
  const m = /^(\d{4})(\d{2})(\d{2})\.md$/.exec(filename);
  if (!m) return undefined;
  return `${m[1]}-${m[2]}-${m[3]}`;
}

export const useMobileStore = create<MobileState>((set, get) => ({
  vaultPath: VAULT_PATH,
  notes: new Map(),
  activeNoteId: null,
  activeSmartView: null,
  recentIds: [],
  initialized: false,

  init: async () => {
    await ensureDir(`${VAULT_PATH}/Daily`);
    await ensureDir(`${VAULT_PATH}/Templates`);
    set({ initialized: true });
    await get().loadAllNotes();
  },

  openDailyNote: async (date) => {
    const { vaultPath, notes } = get();
    const filename = dailyNoteFilename(date);
    const path = `${vaultPath}/Daily/${filename}`;
    set({ activeSmartView: null });

    if (notes.has(path)) { set({ activeNoteId: path }); return; }

    let content = await readFile(path);
    if (content === null) {
      content = `# ${dailyNoteTitle(date)}\n\n`;
      await writeFile(path, content);
    }

    const note = buildNote(path, content, date);
    set((s) => {
      const next = new Map(s.notes);
      next.set(path, note);
      return { notes: next, activeNoteId: path };
    });
  },

  navigateDay: (delta) => {
    const { notes, activeNoteId } = get();
    const active = activeNoteId ? notes.get(activeNoteId) : null;
    const date = active?.date ?? today();
    const next = toISODate(addDays(fromISODate(date), delta));
    get().openDailyNote(next);
  },

  openNote: async (id) => {
    const { notes } = get();
    set({ activeSmartView: null });
    if (notes.has(id)) { set({ activeNoteId: id }); return; }

    const content = await readFile(id);
    if (content === null) return;
    const filename = id.split("/").pop() ?? "";
    const date = dateFromFilename(filename);
    const note = buildNote(id, content, date);
    set((s) => {
      const next = new Map(s.notes);
      next.set(id, note);
      return { notes: next, activeNoteId: id };
    });
  },

  openSmartView: (id) => set({ activeSmartView: id, activeNoteId: null }),

  saveNote: async (id, content) => {
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
    await writeFile(id, content);
  },

  loadAllNotes: async () => {
    const { vaultPath } = get();
    const dirs = ["Daily", "Weekly", "Monthly", "Quarterly", "Yearly", "Notes"];
    const loaded = new Map<string, Note>(get().notes);
    const recent: string[] = [];

    for (const dir of dirs) {
      const dirPath = `${vaultPath}/${dir}`;
      try {
        const entries = await FileSystem.readDirectoryAsync(dirPath);
        for (const filename of entries.filter((f) => f.endsWith(".md")).slice(0, 50)) {
          const path = `${dirPath}/${filename}`;
          if (loaded.has(path)) { recent.push(path); continue; }
          const content = await readFile(path);
          if (content !== null) {
            const date = dateFromFilename(filename);
            const note = buildNote(path, content, date);
            loaded.set(path, note);
            recent.push(path);
          }
        }
      } catch {
        // dir doesn't exist yet
      }
    }

    set({ notes: loaded, recentIds: recent.slice(0, 30) });
  },
}));

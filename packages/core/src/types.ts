export type NoteType = "daily" | "weekly" | "monthly" | "quarterly" | "yearly" | "project" | "template";

export type TaskState = "open" | "done" | "cancelled" | "scheduled";

export interface Task {
  id: string;
  content: string;
  state: TaskState;
  /** >YYYY-MM-DD or >DD/MM — when the task is scheduled to appear */
  scheduledDate?: string;
  /** @due(YYYY-MM-DD) or @due(DD/MM) — hard deadline */
  dueDate?: string;
  /** @remind(YYYY-MM-DD HH:mm) or @remind(DD/MM HH:mm) */
  reminderDate?: string;
  /** ISO date of the note this task lives in */
  noteDate?: string;
  /** @done(YYYY-MM-DD) */
  completionDate?: string;
  /** @repeat(...) raw rule string e.g. "1 week", "2 days" */
  recurrence?: string;
  tags: string[];
  mentions: string[];
  lineIndex: number;
  /** Raw markdown line */
  raw: string;
}

export interface Note {
  id: string;
  type: NoteType;
  title: string;
  /** ISO date string for periodic notes */
  date?: string;
  /** Absolute file path */
  filePath: string;
  content: string;
  tasks: Task[];
  tags: string[];
  mentions: string[];
  backlinks: string[];
  updatedAt: number;
  createdAt: number;
}

export interface Folder {
  name: string;
  path: string;
  children: Folder[];
  noteCount: number;
}

export interface NoteIndex {
  notes: Map<string, Note>;
  byDate: Map<string, string>;   // date → note id
  byTag: Map<string, string[]>;  // tag → note ids
  folders: Folder[];
}

export interface AppSettings {
  vaultPath: string;
  theme: "dark" | "light" | "system" | "dracula" | "nord" | "gruvbox" | "solarized";
  fontSize: number;
  fontFamily: string;
  firstDayOfWeek: 0 | 1; // 0 = Sunday, 1 = Monday
  calendarEnabled: boolean;
  claudeApiKey?: string;
  geminiApiKey?: string;
  aiGatewayUrl?: string;
  aiDeviceId?: string;
  todoistApiToken?: string;
  pluginsEnabled?: boolean;
}

export interface WikiLink {
  target: string;   // note title or path
  alias?: string;   // [[target|alias]]
  lineIndex: number;
  charStart: number;
}

export interface BacklinkEntry {
  noteId: string;
  noteTitle: string;
  excerpt: string;
  lineIndex: number;
}

export interface Frontmatter {
  title?: string;
  tags?: string[];
  created?: string;
  modified?: string;
  aliases?: string[];
  [key: string]: unknown;
}

export interface TimeBlock {
  startHour: number;    // 0–23
  startMinute: number;  // 0–59
  endHour?: number;
  endMinute?: number;
  content: string;
  lineIndex: number;
}

export interface CalendarEvent {
  id: string;
  title: string;
  startISO: string;    // ISO datetime
  endISO: string;
  calendar: string;
  color?: string;
  isAllDay: boolean;
  notes?: string;
}

export interface NoteTemplate {
  id: string;
  name: string;
  content: string;
  filePath: string;
}

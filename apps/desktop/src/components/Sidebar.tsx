import React, { useEffect, useMemo, useState, useRef } from "react";
import { useNotesStore, type SmartViewId } from "../store/notesStore.js";
import {
  getAllTags, getAllMentions,
  periodicFilename, periodicFolder,
  calculateDailyMetrics,
  type PeriodicType,
} from "@daymark/core";
import {
  CircleDot, AlertTriangle, Clock, Hash, AtSign,
  FileText, X, Plus, MoreHorizontal, Circle,
  CalendarDays,
} from "lucide-react";
import { PRODUCT_NAME } from "../brand.js";
import { confirm } from "@tauri-apps/plugin-dialog";
import { ActivityCalendar } from "./ActivityCalendar.js";

function dateFromDelta(delta: number): string {
  const d = new Date();
  d.setDate(d.getDate() + delta);
  return d.toISOString().slice(0, 10);
}

const QUICK_DATES = [
  { label: "Yesterday", delta: -1 },
  { label: "Today",     delta:  0 },
  { label: "Tomorrow",  delta:  1 },
];

const PERIODIC_TYPES: { type: PeriodicType; label: string; abbr: string }[] = [
  { type: "weekly",    label: "This Week",    abbr: "W" },
  { type: "monthly",   label: "This Month",   abbr: "M" },
  { type: "quarterly", label: "This Quarter", abbr: "Q" },
  { type: "yearly",    label: "This Year",    abbr: "Y" },
];

export function Sidebar() {
  const {
    notes, activeNoteId, activeSmartView, recentNoteIds, settings,
    openDailyNote, openNote, openSmartView, openEntityFilter, loadAllNotesWithContent, openPeriodicNote,
    createNote, deleteNote,
  } = useNotesStore();

  const [tagsExpanded, setTagsExpanded]   = useState(false);
  const [notesExpanded, setNotesExpanded] = useState(false);
  const [renamingId, setRenamingId]       = useState<string | null>(null);
  const [renameValue, setRenameValue]     = useState("");
  const [activityOpen, setActivityOpen]   = useState(false);
  const renameRef                         = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadAllNotesWithContent();
  }, [loadAllNotesWithContent]);

  const projectNotes = useMemo(() => {
    const results: Array<{ id: string; title: string }> = [];
    for (const note of notes.values()) {
      if (note.type === "project") {
        results.push({ id: note.id, title: note.title });
      }
    }
    return results.sort((a, b) => a.title.localeCompare(b.title));
  }, [notes]);

  const tags        = useMemo(() => getAllTags(notes),                   [notes]);
  const mentions    = useMemo(() => getAllMentions(notes).slice(0, 8),   [notes]);
  const visibleTags = tagsExpanded ? tags : tags.slice(0, 8);
  const activityScores = useMemo(() => {
    const scores = new Map<string, number>();
    for (const note of notes.values()) {
      if (note.type !== "daily" || !note.date) continue;
      const hasWrittenContent = note.content.split("\n").some((line) => {
        const value = line.trim();
        return Boolean(value && !/^#{1,6}\s+/.test(value) && value !== "---");
      });
      if (hasWrittenContent) scores.set(note.date, calculateDailyMetrics(note.content, note.date).score);
    }
    return scores;
  }, [notes]);

  async function confirmDelete(id: string, title: string) {
    const approved = await confirm(
      `Move “${title}” to Manager Trash? You can recover it from the hidden .manager-trash folder in your vault.`,
      { title: "Remove note", kind: "warning", okLabel: "Move to Trash", cancelLabel: "Cancel" },
    );
    if (approved) {
      try {
        await deleteNote(id);
      } catch (error) {
        window.dispatchEvent(new CustomEvent("manager:notice", {
          detail: { message: `Could not move the note to Trash: ${String(error)}`, tone: "error" },
        }));
      }
    }
  }

  function dailyPath(date: string): string {
    const filename = periodicFilename("daily", date);
    return `${settings.vaultPath}/${periodicFolder("daily")}/${filename}`;
  }

  function SmartViewItem({ id, label, icon }: {
    id: SmartViewId; label: string; icon: React.ReactNode;
  }) {
    const active = activeSmartView === id;
    return (
      <button className={`sidebar-item ${active ? "active" : ""}`} onClick={() => openSmartView(id)}>
        <span className="sidebar-item-icon">{icon}</span>
        <span className="sidebar-item-label">{label}</span>
      </button>
    );
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <span className="sidebar-logo">
          <span className="sidebar-logo-diamond" />
          {PRODUCT_NAME}
        </span>
      </div>

      {/* Smart views */}
      <nav className="sidebar-section">
        <div className="sidebar-section-title">VIEWS</div>
        <SmartViewItem id="today"    label="Today"    icon={<CircleDot size={14} strokeWidth={1.75} />} />
        <SmartViewItem id="overdue"  label="Overdue"  icon={<AlertTriangle size={14} strokeWidth={1.75} />} />
        <SmartViewItem id="upcoming" label="Upcoming" icon={<Clock size={14} strokeWidth={1.75} />} />
      </nav>

      {/* Daily notes */}
      <nav className="sidebar-section">
        <div className="sidebar-section-title">DAILY NOTES</div>
        {QUICK_DATES.map(({ label, delta }) => {
          const date = dateFromDelta(delta);
          const path = dailyPath(date);
          const isActive = activeNoteId === path && !activeSmartView;
          const isToday = delta === 0;
          return (
            <button
              key={label}
              className={`sidebar-item ${isActive ? "active" : ""}`}
              onClick={() => openDailyNote(date)}
            >
              <span className="sidebar-item-icon">
                {isToday
                  ? <Circle size={13} strokeWidth={2} fill="currentColor" />
                  : <Circle size={13} strokeWidth={1.75} />}
              </span>
              <span className="sidebar-item-label">{label}</span>
            </button>
          );
        })}
      </nav>

      {/* Periodic notes */}
      <nav className="sidebar-section">
        <div className="sidebar-section-title">PERIODIC NOTES</div>
        {PERIODIC_TYPES.map(({ type, label, abbr }) => (
          <button
            key={type}
            className="sidebar-item"
            onClick={() => openPeriodicNote(type)}
          >
            <span className="sidebar-item-icon sidebar-periodic-icon">{abbr}</span>
            <span className="sidebar-item-label">{label}</span>
          </button>
        ))}
      </nav>

      {/* Tags */}
      {tags.length > 0 && (
        <nav className="sidebar-section">
          <div className="sidebar-section-title">TAGS</div>
          {visibleTags.map(({ tag }) => (
            <button key={tag} className="sidebar-item" onClick={() => void openEntityFilter("tag", tag)}>
              <span className="sidebar-item-icon sidebar-tag-icon">
                <Hash size={13} strokeWidth={1.75} />
              </span>
              <span className="sidebar-item-label">{tag}</span>
            </button>
          ))}
          {tags.length > 8 && (
            <button className="sidebar-item sidebar-more" onClick={() => setTagsExpanded((e) => !e)}>
              <span className="sidebar-item-icon"><MoreHorizontal size={13} strokeWidth={1.75} /></span>
              <span className="sidebar-item-label">
                {tagsExpanded ? "Show less" : `${tags.length - 8} more`}
              </span>
            </button>
          )}
        </nav>
      )}

      {/* People/@mentions */}
      {mentions.length > 0 && (
        <nav className="sidebar-section">
          <div className="sidebar-section-title">PEOPLE</div>
          {mentions.map(({ mention }) => (
            <button key={mention} className="sidebar-item" onClick={() => void openEntityFilter("mention", mention)}>
              <span className="sidebar-item-icon sidebar-mention-icon">
                <AtSign size={13} strokeWidth={1.75} />
              </span>
              <span className="sidebar-item-label">{mention}</span>
            </button>
          ))}
        </nav>
      )}

      {/* Project Notes */}
      <nav className="sidebar-section">
        <div className="sidebar-section-title">
          <span>NOTES</span>
          <button
            className="sidebar-section-action"
            onClick={() => createNote("Untitled")}
            title="New note (⌘N)"
          >
            <Plus size={14} strokeWidth={2} />
          </button>
        </div>
        {(notesExpanded ? projectNotes : projectNotes.slice(0, 8)).map(({ id, title }) => {
          const isActive = activeNoteId === id && !activeSmartView;
          return (
            <div key={id} className={`sidebar-item-wrap ${isActive ? "active" : ""}`}>
              {renamingId === id ? (
                <input
                  ref={renameRef}
                  className="sidebar-rename-input"
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onBlur={() => {
                    if (renameValue.trim()) {
                      useNotesStore.getState().renameNote(id, renameValue.trim());
                    }
                    setRenamingId(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                    if (e.key === "Escape") { setRenamingId(null); }
                  }}
                  autoFocus
                />
              ) : (
                <button
                  className={`sidebar-item ${isActive ? "active" : ""}`}
                  onClick={() => openNote(id)}
                  onDoubleClick={() => { setRenamingId(id); setRenameValue(title); }}
                  title={id}
                >
                  <span className="sidebar-item-icon">
                    <FileText size={13} strokeWidth={1.75} />
                  </span>
                  <span className="sidebar-item-label">{title}</span>
                </button>
              )}
              <button
                className="sidebar-item-delete"
                onClick={(e) => { e.stopPropagation(); void confirmDelete(id, title); }}
                title="Delete note"
              >
                <X size={12} strokeWidth={2} />
              </button>
            </div>
          );
        })}
        {projectNotes.length > 8 && (
          <button className="sidebar-item sidebar-more" onClick={() => setNotesExpanded((e) => !e)}>
            <span className="sidebar-item-icon"><MoreHorizontal size={13} strokeWidth={1.75} /></span>
            <span className="sidebar-item-label">
              {notesExpanded ? "Show less" : `${projectNotes.length - 8} more notes`}
            </span>
          </button>
        )}
        {projectNotes.length === 0 && (
          <div className="sidebar-empty-note">No notes yet. Press + to create one.</div>
        )}
      </nav>

      {/* Recent */}
      {recentNoteIds.length > 0 && (
        <nav className="sidebar-section sidebar-section-scroll">
          <div className="sidebar-section-title">RECENT</div>
          {recentNoteIds.slice(0, 20).map((id) => {
            const note = notes.get(id);
            const filename = id.split("/").pop()?.replace(/\.md$/, "") ?? id;
            const isActive = activeNoteId === id && !activeSmartView;
            return (
              <button
                key={id}
                className={`sidebar-item ${isActive ? "active" : ""}`}
                onClick={() => openNote(id)}
                title={id}
              >
                <span className="sidebar-item-icon">
                  <FileText size={13} strokeWidth={1.75} />
                </span>
                <span className="sidebar-item-label">{note?.title ?? filename}</span>
              </button>
            );
          })}
        </nav>
      )}

      <div className="sidebar-footer">
        <button className="sidebar-history-button" onClick={() => setActivityOpen(true)}>
          <CalendarDays size={15} strokeWidth={1.8} />
          <span>History</span>
        </button>
      </div>

      {activityOpen && (
        <ActivityCalendar
          activityScores={activityScores}
          onClose={() => setActivityOpen(false)}
          onOpenDate={(date) => {
            void openDailyNote(date);
            setActivityOpen(false);
          }}
        />
      )}
    </aside>
  );
}

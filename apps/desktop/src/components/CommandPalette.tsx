import React, { useEffect, useRef, useState, useMemo, useCallback } from "react";
import {
  Command,
  FileText,
  Plus,
  Square,
  TerminalSquare,
  X,
  Zap,
} from "lucide-react";
import { useNotesStore } from "../store/notesStore.js";
import { searchNotes, today, type SearchResult } from "@daymark/core";
import type { PluginCommand } from "../plugins/PluginAPI.js";

// ── Built-in commands ────────────────────────────────────────────────────────
const BUILTIN_COMMANDS: Omit<PluginCommand, "pluginName">[] = [
  {
    commandKey: "openToday",
    label: "Open Today's Note",
    run: () => { useNotesStore.getState().openDailyNote(today()); },
  },
  {
    commandKey: "openWeekly",
    label: "Open This Week's Note",
    run: () => { useNotesStore.getState().openPeriodicNote("weekly"); },
  },
  {
    commandKey: "openMonthly",
    label: "Open This Month's Note",
    run: () => { useNotesStore.getState().openPeriodicNote("monthly"); },
  },
  {
    commandKey: "openOverdue",
    label: "View Overdue Tasks",
    run: () => { useNotesStore.getState().openSmartView("overdue"); },
  },
  {
    commandKey: "openUpcoming",
    label: "View Upcoming Tasks",
    run: () => { useNotesStore.getState().openSmartView("upcoming"); },
  },
  {
    commandKey: "loadAllNotes",
    label: "Reload All Notes from Disk",
    run: () => { useNotesStore.getState().loadAllNotesWithContent(); },
  },
  {
    commandKey: "newNote",
    label: "New Note",
    run: () => { useNotesStore.getState().createNote("Untitled"); },
  },
  {
    commandKey: "quickTask",
    label: "Quick Capture Task",
    run: () => { document.dispatchEvent(new CustomEvent("daymark:quick-task")); },
  },
  {
    commandKey: "reviewDay",
    label: "Close the Day",
    run: () => { document.dispatchEvent(new CustomEvent("daymark:review-day")); },
  },
  {
    commandKey: "openGraph",
    label: "Open Graph View",
    run: () => { document.dispatchEvent(new CustomEvent("daymark:open-graph")); },
  },
  {
    commandKey: "openShortcuts",
    label: "Show Keyboard Shortcuts",
    run: () => { document.dispatchEvent(new CustomEvent("daymark:open-shortcuts")); },
  },
];

export function CommandPalette() {
  const {
    paletteOpen, paletteQuery, notes,
    setPaletteOpen, setPaletteQuery, openNote, openDailyNote, createNote,
  } = useNotesStore();

  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const isCommandMode = paletteQuery.startsWith(">");
  const searchQuery   = isCommandMode ? paletteQuery.slice(1).trim() : paletteQuery.trim();

  const searchResults = useMemo(
    () => (!isCommandMode && searchQuery ? searchNotes(notes, searchQuery) : []),
    [paletteQuery, notes, isCommandMode, searchQuery],
  );

  const commandResults = useMemo(() => {
    const all = [
      ...BUILTIN_COMMANDS.map((c) => ({ ...c, pluginName: "Built-in" })),
    ];
    if (!searchQuery) return all;
    const q = searchQuery.toLowerCase();
    return all.filter(
      (c) => c.label.toLowerCase().includes(q) || c.pluginName.toLowerCase().includes(q),
    );
  }, [searchQuery]);

  const totalItems = isCommandMode ? commandResults.length : searchResults.length;

  useEffect(() => { setSelectedIndex(0); }, [totalItems]);

  useEffect(() => {
    if (paletteOpen) setTimeout(() => inputRef.current?.focus(), 10);
  }, [paletteOpen]);

  const acceptNote = useCallback(
    (result: SearchResult) => {
      if (result.note.date) openDailyNote(result.note.date);
      else openNote(result.note.id);
      setPaletteOpen(false);
    },
    [openNote, openDailyNote, setPaletteOpen],
  );

  const acceptCommand = useCallback(
    (cmd: PluginCommand & { pluginName: string }) => {
      setPaletteOpen(false);
      Promise.resolve(cmd.run()).catch(console.error);
    },
    [setPaletteOpen],
  );

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") { setPaletteOpen(false); return; }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, totalItems - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        if (isCommandMode) {
          const cmd = commandResults[selectedIndex];
          if (cmd) acceptCommand(cmd);
        } else {
          const r = searchResults[selectedIndex];
          if (r) {
            acceptNote(r);
          } else if (!isCommandMode && paletteQuery.trim() && searchResults.length === 0) {
            // No results → create note
            setPaletteOpen(false);
            createNote(paletteQuery.trim());
          }
        }
      }
    },
    [totalItems, selectedIndex, isCommandMode, commandResults, searchResults, acceptNote, acceptCommand, setPaletteOpen],
  );

  if (!paletteOpen) return null;

  return (
    <div className="palette-backdrop" onClick={() => setPaletteOpen(false)}>
      <div className="palette" onClick={(e) => e.stopPropagation()}>
        <div className="palette-input-wrap">
          <span className="palette-icon">
            {isCommandMode ? <Zap size={15} /> : <Command size={15} />}
          </span>
          <input
            ref={inputRef}
            className="palette-input"
            placeholder={isCommandMode ? "Search commands… (type > for commands)" : "Search notes… (> for commands)"}
            value={paletteQuery}
            onChange={(e) => setPaletteQuery(e.target.value)}
            onKeyDown={onKeyDown}
            spellCheck={false}
          />
          {paletteQuery && (
            <button className="palette-clear" onClick={() => setPaletteQuery("")}>
              <X size={14} strokeWidth={2} />
            </button>
          )}
        </div>

        {/* Note results */}
        {!isCommandMode && searchResults.length > 0 && (
          <ul className="palette-results">
            {searchResults.map((r, i) => (
              <li
                key={`${r.note.id}-${r.task?.id ?? "note"}-${i}`}
                className={`palette-item ${i === selectedIndex ? "selected" : ""}`}
                onMouseEnter={() => setSelectedIndex(i)}
                onClick={() => acceptNote(r)}
              >
                <span className="palette-item-icon">
                  {r.type === "task" ? <Square size={14} /> : <FileText size={14} />}
                </span>
                <div className="palette-item-body">
                  <span className="palette-item-text">{r.snippet}</span>
                  <span className="palette-item-source">{r.note.title}</span>
                </div>
                <span className="palette-item-type">{r.type}</span>
              </li>
            ))}
          </ul>
        )}

        {/* Command results */}
        {isCommandMode && (
          <ul className="palette-results">
            {commandResults.map((cmd, i) => (
              <li
                key={`${cmd.pluginName}-${cmd.commandKey}`}
                className={`palette-cmd-item ${i === selectedIndex ? "selected" : ""}`}
                onMouseEnter={() => setSelectedIndex(i)}
                onClick={() => acceptCommand(cmd)}
              >
                <span className="palette-cmd-icon">
                  {cmd.pluginName === "Built-in" ? <Zap size={14} /> : <TerminalSquare size={14} />}
                </span>
                <span className="palette-cmd-label">{cmd.label}</span>
                <span className="palette-cmd-plugin">{cmd.pluginName}</span>
              </li>
            ))}
            {commandResults.length === 0 && (
              <div className="palette-empty">No commands match "{searchQuery}"</div>
            )}
          </ul>
        )}

        {!paletteQuery && !isCommandMode && (
          <div className="palette-hints">
            <span>↑↓ navigate</span>
            <span>↵ open</span>
            <span>&gt; commands</span>
            <span>esc close</span>
          </div>
        )}

        {!isCommandMode && paletteQuery && searchResults.length === 0 && (
          <ul className="palette-results">
            <li
              className="palette-item selected"
              onClick={() => {
                setPaletteOpen(false);
                createNote(paletteQuery);
              }}
            >
              <span className="palette-item-icon"><Plus size={14} /></span>
              <div className="palette-item-body">
                <span className="palette-item-text">Create note</span>
                <span className="palette-item-source">"{paletteQuery}"</span>
              </div>
              <span className="palette-item-type">new</span>
            </li>
          </ul>
        )}
      </div>
    </div>
  );
}

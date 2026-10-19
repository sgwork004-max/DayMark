import { useMemo } from "react";
import { AtSign, FileText, Hash } from "lucide-react";
import { useNotesStore } from "../store/notesStore.js";

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function EntityResultsView() {
  const { activeEntityFilter, notes, openDailyNote, openNote } = useNotesStore();
  const results = useMemo(() => {
    if (!activeEntityFilter) return [];
    const prefix = activeEntityFilter.kind === "tag" ? "#" : "@";
    const matcher = new RegExp(`(^|\\s)${escapeRegExp(prefix + activeEntityFilter.value)}(?=$|\\s|[.,;:!?()[\\]{}])`, "i");
    const matches: Array<{ noteId: string; noteTitle: string; noteDate?: string; line: number; text: string }> = [];
    for (const note of notes.values()) {
      note.content.split("\n").forEach((line, index) => {
        if (!matcher.test(line)) return;
        const match = { noteId: note.id, noteTitle: note.title, line: index, text: line.trim() };
        if (note.date) Object.assign(match, { noteDate: note.date });
        matches.push(match);
      });
    }
    return matches.sort((a, b) => (b.noteDate ?? "").localeCompare(a.noteDate ?? ""));
  }, [activeEntityFilter, notes]);

  if (!activeEntityFilter) return null;
  const Icon = activeEntityFilter.kind === "tag" ? Hash : AtSign;
  const prefix = activeEntityFilter.kind === "tag" ? "#" : "@";

  function openResult(result: (typeof results)[number]) {
    const opening = result.noteDate ? openDailyNote(result.noteDate) : openNote(result.noteId);
    void opening.then(() => window.setTimeout(() => {
      document.dispatchEvent(new CustomEvent("daymark:scroll-to-line", { detail: result.line }));
    }, 80));
  }

  return (
    <div className="entity-view">
      <header className="entity-view-header">
        <span className="entity-view-icon"><Icon size={18} /></span>
        <div>
          <h1>{prefix}{activeEntityFilter.value}</h1>
          <p>{results.length} mention{results.length === 1 ? "" : "s"} across your notes</p>
        </div>
      </header>
      <div className="entity-view-results">
        {results.length === 0 ? (
          <div className="smart-view-empty">No matching notes found.</div>
        ) : results.map((result) => (
          <button
            key={`${result.noteId}-${result.line}`}
            className="entity-result"
            onClick={() => openResult(result)}
          >
            <FileText size={14} />
            <span className="entity-result-copy">
              <strong>{result.noteTitle}</strong>
              <span>{result.text}</span>
            </span>
            {result.noteDate && <time>{result.noteDate}</time>}
          </button>
        ))}
      </div>
    </div>
  );
}

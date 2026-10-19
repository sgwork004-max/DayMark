import React, { useMemo } from "react";
import { X } from "lucide-react";
import { useNotesStore } from "../store/notesStore.js";

interface Heading {
  level: number;
  text: string;
  line: number;
}

function parseHeadings(content: string): Heading[] {
  const headings: Heading[] = [];
  const lines = content.split("\n");
  lines.forEach((line, i) => {
    const m = line.match(/^(#{1,6})\s+(.+)/);
    if (m && m[1] && m[2]) {
      headings.push({ level: m[1].length, text: m[2].trim(), line: i });
    }
  });
  return headings;
}

export function TableOfContents({ onClose }: { onClose: () => void }) {
  const { notes, activeNoteId } = useNotesStore();
  const activeNote = activeNoteId ? notes.get(activeNoteId) : null;

  const headings = useMemo(
    () => parseHeadings(activeNote?.content ?? ""),
    [activeNote?.content]
  );

  if (!activeNote) {
    return (
      <div className="toc-panel">
        <div className="toc-header">
          <span>Table of Contents</span>
          <button onClick={onClose}><X size={14} strokeWidth={2} /></button>
        </div>
        <div className="toc-empty">No note open</div>
      </div>
    );
  }

  if (headings.length === 0) {
    return (
      <div className="toc-panel">
        <div className="toc-header">
          <span>Table of Contents</span>
          <button onClick={onClose}><X size={14} strokeWidth={2} /></button>
        </div>
        <div className="toc-empty">No headings found</div>
      </div>
    );
  }

  const minLevel = headings.reduce((min, h) => Math.min(min, h.level), headings[0]?.level ?? 1);

  return (
    <div className="toc-panel">
      <div className="toc-header">
        <span>Table of Contents</span>
        <button onClick={onClose}><X size={14} strokeWidth={2} /></button>
      </div>
      <div className="toc-title">{activeNote.title}</div>
      <nav className="toc-nav">
        {headings.map((h, i) => (
          <a
            key={i}
            className={`toc-item toc-level-${h.level - minLevel}`}
            href={`#heading-${h.line}`}
            onClick={(e) => {
              e.preventDefault();
              // Scroll CodeMirror to line — dispatch a custom event
              document.dispatchEvent(
                new CustomEvent("daymark:scroll-to-line", { detail: h.line })
              );
            }}
          >
            {h.text}
          </a>
        ))}
      </nav>
    </div>
  );
}

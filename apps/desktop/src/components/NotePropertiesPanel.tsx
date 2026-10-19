import React, { useMemo, useCallback } from "react";
import { parseFrontmatter, serializeFrontmatter } from "@daymark/core";
import { useNotesStore } from "../store/notesStore.js";

export function NotePropertiesPanel() {
  const { activeNoteId, notes, saveNote } = useNotesStore();
  const note = activeNoteId ? notes.get(activeNoteId) : null;

  const { frontmatter, body } = useMemo(
    () => (note ? parseFrontmatter(note.content) : { frontmatter: {}, body: "" }),
    [note],
  );

  const setField = useCallback(
    (key: string, value: string) => {
      if (!note) return;
      const updated = { ...frontmatter, [key]: value };
      saveNote(note.id, serializeFrontmatter(updated, body));
    },
    [note, frontmatter, body, saveNote],
  );

  const addTag = useCallback(
    (tag: string) => {
      if (!note || !tag.trim()) return;
      const existing = (frontmatter["tags"] as string[] | undefined) ?? [];
      if (!existing.includes(tag)) {
        const updated = { ...frontmatter, tags: [...existing, tag] };
        saveNote(note.id, serializeFrontmatter(updated, body));
      }
    },
    [note, frontmatter, body, saveNote],
  );

  if (!note) return null;

  const tags = (frontmatter["tags"] as string[] | undefined) ?? [];
  const created = note.createdAt ? new Date(note.createdAt).toLocaleDateString() : "—";
  const modified = note.updatedAt ? new Date(note.updatedAt).toLocaleDateString() : "—";

  return (
    <div className="props-panel">
      <div className="props-header">Properties</div>

      <div className="props-row">
        <span className="props-label">Title</span>
        <input
          className="props-input"
          defaultValue={note.title}
          onBlur={(e) => setField("title", e.target.value)}
        />
      </div>

      <div className="props-row">
        <span className="props-label">Tags</span>
        <div className="props-tags">
          {tags.map((t) => (
            <span key={t} className="props-tag">#{t}</span>
          ))}
          <input
            className="props-tag-input"
            placeholder="+ add tag"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                addTag((e.target as HTMLInputElement).value.replace(/^#/, ""));
                (e.target as HTMLInputElement).value = "";
              }
            }}
          />
        </div>
      </div>

      <div className="props-row">
        <span className="props-label">Created</span>
        <span className="props-value">{created}</span>
      </div>

      <div className="props-row">
        <span className="props-label">Modified</span>
        <span className="props-value">{modified}</span>
      </div>

      <div className="props-row">
        <span className="props-label">Words</span>
        <span className="props-value">
          {note.content.trim().split(/\s+/).filter(Boolean).length}
        </span>
      </div>

      <div className="props-row">
        <span className="props-label">Tasks</span>
        <span className="props-value">
          {note.tasks.filter((t) => t.state === "open").length} open / {note.tasks.length} total
        </span>
      </div>
    </div>
  );
}

import React, { useEffect, useState } from "react";
import { X } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { applyTemplate } from "@daymark/core";
import { useNotesStore } from "../store/notesStore.js";

interface TemplateFile {
  name: string;
  path: string;
  content: string;
}

interface Props {
  onClose: () => void;
  targetDate?: string;
}

export function TemplateModal({ onClose, targetDate }: Props) {
  const { settings, activeNoteId, saveNote } = useNotesStore();
  const [templates, setTemplates] = useState<TemplateFile[]>([]);
  const [selected, setSelected] = useState<TemplateFile | null>(null);

  useEffect(() => {
    const templatesPath = `${settings.vaultPath}/Templates`;
    invoke<{ path: string; filename: string; content: string }[]>("list_notes", {
      vaultPath: templatesPath,
    })
      .then(async (stubs) => {
        const loaded = await Promise.all(
          stubs.map(async (s) => {
            const file = await invoke<{ content: string }>("read_note", { path: s.path });
            return {
              name: s.filename.replace(/\.md$/, ""),
              path: s.path,
              content: file.content,
            };
          }),
        );
        setTemplates(loaded);
        if (loaded[0]) setSelected(loaded[0]);
      })
      .catch(() => {
        // No templates folder yet
        setTemplates([]);
      });
  }, [settings.vaultPath]);

  function applySelected() {
    if (!selected || !activeNoteId) return;
    const rendered = applyTemplate(selected.content, { ...(targetDate ? { date: targetDate } : {}) });
    saveNote(activeNoteId, rendered);
    onClose();
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">Apply Template</span>
          <button className="modal-close" onClick={onClose}>
            <X size={14} strokeWidth={2} />
          </button>
        </div>

        {templates.length === 0 ? (
          <div className="modal-empty">
            <p>No templates found.</p>
            <p className="modal-hint">
              Create <code>.md</code> files in <code>{settings.vaultPath}/Templates/</code> to use them here.
              Use <code>{"{{date}}"}</code>, <code>{"{{title}}"}</code>, <code>{"{{time}}"}</code> as variables.
            </p>
          </div>
        ) : (
          <>
            <div className="modal-body">
              <div className="template-list">
                {templates.map((t) => (
                  <button
                    key={t.path}
                    className={`template-item ${selected?.path === t.path ? "selected" : ""}`}
                    onClick={() => setSelected(t)}
                  >
                    {t.name}
                  </button>
                ))}
              </div>
              {selected && (
                <pre className="template-preview">{selected.content.slice(0, 400)}</pre>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={onClose}>Cancel</button>
              <button className="btn-primary" onClick={applySelected} disabled={!selected}>
                Apply Template
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

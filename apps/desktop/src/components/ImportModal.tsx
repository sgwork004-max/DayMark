import React, { useState, useRef } from "react";
import { X, CheckCircle, AlertTriangle } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { convertObsidianNote } from "@daymark/importers";
import { convertCraftNote } from "@daymark/importers";
import { parseEnex } from "@daymark/importers";
import { useNotesStore } from "../store/notesStore.js";

type Source = "obsidian" | "evernote" | "craft";

interface ImportResult {
  imported: number;
  skipped: number;
  errors: string[];
}

async function createImportedNote(path: string, content: string): Promise<void> {
  for (let copy = 1; copy <= 999; copy += 1) {
    const candidate = copy === 1 ? path : path.replace(/\.md$/i, ` (${copy}).md`);
    try {
      await invoke("create_note", { path: candidate, content });
      return;
    } catch (error) {
      if (!String(error).includes("already exists")) throw error;
    }
  }
  throw new Error("Too many notes share the same filename.");
}

export function ImportModal({ onClose }: { onClose: () => void }) {
  const [source, setSource]             = useState<Source>("obsidian");
  const [status, setStatus]             = useState<"idle" | "running" | "done">("idle");
  const [result, setResult]             = useState<ImportResult | null>(null);
  const [folderPath, setFolderPath]     = useState("");
  const [enexContent, setEnexContent]   = useState("");
  const fileRef                         = useRef<HTMLInputElement>(null);
  const { settings, loadAllNotesWithContent } = useNotesStore();

  async function pickFolder() {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const dir = await open({ directory: true, multiple: false });
      if (typeof dir === "string") setFolderPath(dir);
    } catch {
      // dialog not available in dev
    }
  }

  async function runImport() {
    setStatus("running");
    const res: ImportResult = { imported: 0, skipped: 0, errors: [] };

    try {
      if (source === "obsidian") {
        const stubs: Array<{ path: string; filename: string }> = await invoke("list_notes", { vaultPath: folderPath });
        for (const stub of stubs) {
          try {
            const raw: string = await invoke("read_note_from_disk", { path: stub.path });
            const converted = convertObsidianNote(raw, stub.filename.replace(/\.md$/, ""));
            const dest = `${settings.vaultPath}/Notes/${stub.filename}`;
            await createImportedNote(dest, converted);
            res.imported++;
          } catch (e) {
            res.errors.push(String(e));
            res.skipped++;
          }
        }
      } else if (source === "evernote") {
        const notes = parseEnex(enexContent);
        for (const note of notes) {
          try {
            const safeName = note.title.replace(/[/\\?%*:|"<>]/g, "-");
            const dest = `${settings.vaultPath}/Notes/${safeName}.md`;
            const md = `# ${note.title}\n\n${note.content}`;
            await createImportedNote(dest, md);
            res.imported++;
          } catch (e) {
            res.errors.push(String(e));
            res.skipped++;
          }
        }
      } else if (source === "craft") {
        const stubs: Array<{ path: string; filename: string }> = await invoke("list_notes", { vaultPath: folderPath });
        for (const stub of stubs) {
          try {
            const raw: string = await invoke("read_note_from_disk", { path: stub.path });
            const converted = convertCraftNote(raw, stub.filename.replace(/\.md$/, ""));
            const dest = `${settings.vaultPath}/Notes/${stub.filename}`;
            await createImportedNote(dest, converted);
            res.imported++;
          } catch (e) {
            res.errors.push(String(e));
            res.skipped++;
          }
        }
      }

      await loadAllNotesWithContent();
      setResult(res);
      setStatus("done");
    } catch (err) {
      res.errors.push(String(err));
      setResult(res);
      setStatus("done");
    }
  }

  return (
    <div className="import-overlay" onClick={onClose}>
      <div className="import-modal" onClick={(e) => e.stopPropagation()}>
        <div className="import-header">
          <h2>Import Notes</h2>
          <button className="import-close" onClick={onClose}><X size={14} strokeWidth={2} /></button>
        </div>

        {status === "idle" && (
          <>
            <div className="import-source-tabs">
              {(["obsidian", "evernote", "craft"] as Source[]).map((s) => (
                <button
                  key={s}
                  className={`import-tab ${source === s ? "active" : ""}`}
                  onClick={() => setSource(s)}
                >
                  {s === "obsidian" ? "Obsidian Vault" : s === "evernote" ? "Evernote (.enex)" : "Craft Export"}
                </button>
              ))}
            </div>

            {source === "evernote" ? (
              <div className="import-body">
                <p className="import-hint">
                  Export your Evernote notebook as <strong>.enex</strong> (File → Export All Notes), then paste the file contents below.
                </p>
                <textarea
                  className="import-enex"
                  placeholder="Paste .enex XML content here…"
                  value={enexContent}
                  onChange={(e) => setEnexContent(e.target.value)}
                  rows={10}
                />
              </div>
            ) : (
              <div className="import-body">
                <p className="import-hint">
                  {source === "obsidian"
                    ? "Select your Obsidian vault folder. All markdown files will be converted and imported."
                    : "Select your Craft export folder containing .md files."}
                </p>
                <div className="import-folder-row">
                  <input
                    className="import-folder-input"
                    value={folderPath}
                    readOnly
                    placeholder="No folder selected"
                  />
                  <button className="import-pick-btn" onClick={pickFolder}>Browse…</button>
                </div>
              </div>
            )}

            <div className="import-actions">
              <button className="import-cancel-btn" onClick={onClose}>Cancel</button>
              <button
                className="import-run-btn"
                disabled={source === "evernote" ? !enexContent.trim() : !folderPath}
                onClick={runImport}
              >
                Import
              </button>
            </div>
          </>
        )}

        {status === "running" && (
          <div className="import-running">
            <div className="import-spinner" />
            <span>Importing notes…</span>
          </div>
        )}

        {status === "done" && result && (
          <div className="import-result">
            <div className="import-result-icon">{result.errors.length === 0 ? <CheckCircle size={32} strokeWidth={1.5} /> : <AlertTriangle size={32} strokeWidth={1.5} />}</div>
            <div className="import-result-stats">
              <strong>{result.imported}</strong> notes imported
              {result.skipped > 0 && <>, <strong>{result.skipped}</strong> skipped</>}
            </div>
            {result.errors.length > 0 && (
              <details className="import-errors">
                <summary>{result.errors.length} errors</summary>
                <ul>
                  {result.errors.map((e, i) => <li key={i}>{e}</li>)}
                </ul>
              </details>
            )}
            <button className="import-run-btn" onClick={onClose}>Done</button>
          </div>
        )}
      </div>
    </div>
  );
}

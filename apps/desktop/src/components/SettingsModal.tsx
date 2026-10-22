import React, { useState } from "react";
import { X, FolderOpen, HardDrive, Cloud, Upload, FileHeart, RotateCcw } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { flushPendingNoteWrites, useNotesStore } from "../store/notesStore.js";
import { today } from "@daymark/core";

interface Props {
  onClose: () => void;
  onImport?: () => void;
  onOnboarding?: () => void;
}

const THEMES = [
  { label: "System",     value: "system" },
  { label: "Dark",       value: "dark" },
  { label: "Light",      value: "light" },
  { label: "Dracula",    value: "dracula" },
  { label: "Nord",       value: "nord" },
  { label: "Gruvbox",    value: "gruvbox" },
  { label: "Solarized",  value: "solarized" },
] as const;

const FONT_FAMILIES = [
  { label: "System", value: "system-ui" },
  { label: "Inter",  value: "Inter, sans-serif" },
  { label: "Mono",   value: "JetBrains Mono, Fira Code, monospace" },
  { label: "Serif",  value: "Georgia, 'Times New Roman', serif" },
];

export function SettingsModal({ onClose, onImport, onOnboarding }: Props) {
  const { settings, updateSettings } = useNotesStore();
  const [saving, setSaving] = useState(false);
  const inICloud = settings.vaultPath.includes("/Library/Mobile Documents/");
  const [diagnosticsPath, setDiagnosticsPath] = useState("");
  const [geminiInput, setGeminiInput] = useState(settings.geminiApiKey ?? "");
  const [integrationError, setIntegrationError] = useState("");
  const [storageError, setStorageError] = useState("");

  async function saveBeforeVaultChange(): Promise<boolean> {
    const requested: Promise<boolean>[] = [];
    document.dispatchEvent(new CustomEvent("daymark:force-save", {
      detail: { waitUntil: (promise: Promise<boolean>) => requested.push(promise) },
    }));
    const direct = await Promise.all(requested);
    return direct.every(Boolean) && await flushPendingNoteWrites();
  }

  async function changeVault(vaultPath: string) {
    setSaving(true);
    setStorageError("");
    try {
      if (!(await saveBeforeVaultChange())) {
        setStorageError("DayMark could not save the active note, so the vault was not changed.");
        return;
      }
      await updateSettings({ vaultPath });
      await useNotesStore.getState().loadAllNotesWithContent();
      await useNotesStore.getState().openDailyNote(today());
    } catch (error) {
      setStorageError(`Could not open that vault: ${String(error)}`);
    } finally {
      setSaving(false);
    }
  }

  async function saveCredential(key: "geminiApiKey", value: string) {
    if ((settings[key] ?? "") === value) return;
    setSaving(true);
    setIntegrationError("");
    try {
      await updateSettings({ [key]: value });
    } catch (error) {
      setIntegrationError(`Could not save the credential securely: ${String(error)}`);
    } finally {
      setSaving(false);
    }
  }

  async function chooseVaultFolder() {
    const folder = await invoke<string | null>("choose_vault_folder");
    if (folder && folder !== settings.vaultPath) await changeVault(folder);
  }

  async function switchToICloud() {
    const icloudPath = await invoke<string>("icloud_vault_path");
    await changeVault(icloudPath);
  }

  async function switchToLocal() {
    const localPath = await invoke<string>("default_vault_path");
    await changeVault(localPath);
  }

  async function createDiagnostics() {
    const path = await invoke<string>("export_diagnostics");
    setDiagnosticsPath(path);
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <span className="settings-title">Settings</span>
          <button className="panel-close" onClick={onClose}><X size={14} strokeWidth={2} /></button>
        </div>

        <div className="settings-body">
          {/* Storage */}
          <section className="settings-section">
            <h3 className="settings-section-title">Storage</h3>

            <div className="settings-row">
              <label className="settings-label">Vault Location</label>
              <div className="settings-vault-row">
                <input
                  className="settings-input"
                  value={settings.vaultPath}
                  readOnly
                  spellCheck={false}
                />
              </div>
              <div className="settings-vault-buttons">
                <button className="btn-settings-secondary" onClick={chooseVaultFolder}>
                  <FolderOpen size={13} strokeWidth={1.75} style={{verticalAlign:"middle",marginRight:4}} /> Choose folder…
                </button>
                <button className={`btn-settings-secondary ${inICloud ? "" : "active"}`} onClick={switchToLocal}>
                  <HardDrive size={13} strokeWidth={1.75} style={{verticalAlign:"middle",marginRight:4}} /> Local vault
                </button>
                <button className={`btn-settings-secondary ${inICloud ? "active" : ""}`} onClick={switchToICloud}>
                  <Cloud size={13} strokeWidth={1.75} style={{verticalAlign:"middle",marginRight:4}} /> iCloud Drive
                </button>
              </div>
              <p className="settings-hint">
                Notes are plain Markdown files. The iCloud Drive option keeps them in iCloud Drive so they
                sync to your other Macs.
              </p>
              {storageError && <p className="settings-error">{storageError}</p>}
            </div>
          </section>

          {/* Appearance */}
          <section className="settings-section">
            <h3 className="settings-section-title">Appearance</h3>

            <div className="settings-row settings-row-inline">
              <label className="settings-label">Theme</label>
              <div className="settings-theme-grid">
                {THEMES.map((t) => (
                  <button
                    key={t.value}
                    className={`settings-theme-chip ${(settings.theme ?? "dark") === t.value ? "active" : ""}`}
                    onClick={() => updateSettings({ theme: t.value })}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="settings-row settings-row-inline">
              <label className="settings-label">Font Size</label>
              <div className="settings-slider-row">
                <input
                  type="range"
                  min={12}
                  max={22}
                  step={1}
                  value={settings.fontSize}
                  onChange={(e) => updateSettings({ fontSize: parseInt(e.target.value) })}
                  className="settings-slider"
                />
                <span className="settings-slider-value">{settings.fontSize}px</span>
              </div>
            </div>

            <div className="settings-row settings-row-inline">
              <label className="settings-label">Editor Font</label>
              <select
                className="settings-select"
                value={settings.fontFamily}
                onChange={(e) => updateSettings({ fontFamily: e.target.value })}
              >
                {FONT_FAMILIES.map((f) => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
              </select>
            </div>

            <div className="settings-row settings-row-inline">
              <label className="settings-label">First Day of Week</label>
              <select
                className="settings-select"
                value={settings.firstDayOfWeek}
                onChange={(e) => updateSettings({ firstDayOfWeek: parseInt(e.target.value) as 0 | 1 })}
              >
                <option value={1}>Monday</option>
                <option value={0}>Sunday</option>
              </select>
            </div>
          </section>

          {/* Integrations */}
          <section className="settings-section">
            <h3 className="settings-section-title">Integrations</h3>

            <div className="settings-row settings-row-inline">
              <label className="settings-label">Apple Calendar</label>
              <button
                className={`settings-toggle ${settings.calendarEnabled ? "active" : ""}`}
                onClick={() => updateSettings({ calendarEnabled: !settings.calendarEnabled })}
              >
                <span className="toggle-knob" />
              </button>
            </div>
            <p className="settings-hint">
              Requires Calendar access permission. Grant it in{" "}
              <strong>System Settings → Privacy → Calendar</strong>.
            </p>

          </section>

          {/* AI */}
          <section className="settings-section">
            <h3 className="settings-section-title">AI Assistant</h3>

            <div className="settings-row">
              <label className="settings-label">Gemini API key</label>
              <input
                className="settings-input"
                type="password"
                value={geminiInput}
                onChange={(e) => setGeminiInput(e.target.value)}
                onBlur={() => void saveCredential("geminiApiKey", geminiInput.trim())}
                placeholder="Paste your Gemini API key"
                spellCheck={false}
              />
              <p className="settings-hint">
                Optional. Stored in macOS Keychain. The active note is sent to Google Gemini only when you use the assistant.
                Get a key from Google AI Studio.
              </p>
            </div>
            {integrationError && <p className="settings-error">{integrationError}</p>}
          </section>

          {/* Import */}
          <section className="settings-section">
            <h3 className="settings-section-title">Import</h3>
            <div className="settings-row">
              <p className="settings-hint">
                Import notes from Obsidian, Evernote (.enex), or Craft exports.
              </p>
              <button
                className="btn-settings-secondary"
                onClick={() => { onClose(); onImport?.(); }}
              >
                <Upload size={13} strokeWidth={1.75} style={{verticalAlign:"middle",marginRight:4}} /> Import Notes…
              </button>
            </div>
          </section>

          {/* About */}
          <section className="settings-section">
            <h3 className="settings-section-title">About</h3>
            <p className="settings-about">
              <strong>DayMark</strong> - version 0.6.1
            </p>
            <p className="settings-about">
              Vault: <code>{settings.vaultPath || "not set"}</code>
            </p>
            <div className="settings-about-actions">
              <button className="btn-settings-secondary" onClick={onOnboarding}>
                <RotateCcw size={13} /> Run welcome setup
              </button>
              <button className="btn-settings-secondary" onClick={createDiagnostics}>
                <FileHeart size={13} /> Create diagnostics
              </button>
            </div>
            {diagnosticsPath && <p className="settings-diagnostics">Saved to <code>{diagnosticsPath}</code></p>}
          </section>
        </div>

        {saving && <div className="settings-saving">Saving…</div>}
      </div>
    </div>
  );
}

import React, { useEffect, useState } from "react";
import { X, FolderOpen, Cloud, FileHeart, RotateCcw, KeyRound, CheckCircle2, LogOut } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { flushPendingNoteWrites, useNotesStore } from "../store/notesStore.js";
import { today } from "@daymark/core";
import { bundledAiGatewayUrl, type ManagerAiAccess } from "../managerAi.js";

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
  const [vaultInput, setVaultInput] = useState(settings.vaultPath);
  const [saving, setSaving] = useState(false);
  const [diagnosticsPath, setDiagnosticsPath] = useState("");
  const [todoistInput, setTodoistInput] = useState(settings.todoistApiToken ?? "");
  const [geminiInput, setGeminiInput] = useState(settings.geminiApiKey ?? "");
  const [gatewayInput, setGatewayInput] = useState(settings.aiGatewayUrl || bundledAiGatewayUrl);
  const [activationCode, setActivationCode] = useState("");
  const [aiAccess, setAiAccess] = useState<ManagerAiAccess | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");
  const [integrationError, setIntegrationError] = useState("");
  const [storageError, setStorageError] = useState("");

  useEffect(() => {
    const gatewayUrl = settings.aiGatewayUrl?.trim();
    if (!gatewayUrl) return;
    setAiLoading(true);
    invoke<ManagerAiAccess>("get_manager_ai_status", { gatewayUrl })
      .then((status) => {
        setAiAccess(status);
        setAiError("");
      })
      .catch(() => setAiAccess(null))
      .finally(() => setAiLoading(false));
  }, [settings.aiGatewayUrl]);

  async function activateAi() {
    const gatewayUrl = gatewayInput.trim();
    if (!gatewayUrl || !activationCode.trim()) {
      setAiError("Enter the Manager service URL and your activation code.");
      return;
    }
    setAiLoading(true);
    setAiError("");
    try {
      await updateSettings({ aiGatewayUrl: gatewayUrl });
      const status = await invoke<ManagerAiAccess>("activate_manager_ai", {
        gatewayUrl,
        activationCode: activationCode.trim(),
        deviceId: settings.aiDeviceId || crypto.randomUUID(),
      });
      setAiAccess(status);
      setActivationCode("");
    } catch (error) {
      setAiError(String(error));
    } finally {
      setAiLoading(false);
    }
  }

  async function disconnectAi() {
    await invoke("disconnect_manager_ai");
    setAiAccess(null);
    setAiError("");
  }

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
        setStorageError("Manager could not save the active note, so the vault was not changed.");
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

  async function saveCredential(key: "todoistApiToken" | "geminiApiKey", value: string) {
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

  async function applyVaultPath() {
    if (!vaultInput.trim() || vaultInput === settings.vaultPath) return;
    await changeVault(vaultInput.trim());
  }

  async function switchToICloud() {
    const icloudPath = await invoke<string>("icloud_vault_path");
    setVaultInput(icloudPath);
    await changeVault(icloudPath);
  }

  async function switchToLocal() {
    const localPath = await invoke<string>("default_vault_path");
    setVaultInput(localPath);
    await changeVault(localPath);
  }

  async function createDiagnostics() {
    const path = await invoke<string>("export_diagnostics", { vaultPath: settings.vaultPath });
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
                  value={vaultInput}
                  onChange={(e) => setVaultInput(e.target.value)}
                  onBlur={applyVaultPath}
                  spellCheck={false}
                />
              </div>
              <div className="settings-vault-buttons">
                <button className="btn-settings-secondary" onClick={switchToLocal}>
                  <FolderOpen size={13} strokeWidth={1.75} style={{verticalAlign:"middle",marginRight:4}} /> Local vault
                </button>
                <button className="btn-settings-secondary btn-icloud" onClick={switchToICloud}>
                  <Cloud size={13} strokeWidth={1.75} style={{verticalAlign:"middle",marginRight:4}} /> iCloud Drive
                </button>
              </div>
              <p className="settings-hint">
                The iCloud option places your vault in{" "}
                your selected iCloud Drive folder,
                syncing automatically to iPhone &amp; iPad.
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

            <div className="settings-row">
              <label className="settings-label">Todoist API Token</label>
              <input
                className="settings-input"
                type="password"
                value={todoistInput}
                onChange={(e) => setTodoistInput(e.target.value)}
                onBlur={() => void saveCredential("todoistApiToken", todoistInput.trim())}
                placeholder="Paste your Todoist token"
                spellCheck={false}
              />
              <p className="settings-hint">
                Used to show your live Todoist Today tasks under daily notes. Find it in Todoist Settings → Integrations → Developer.
              </p>
            </div>
          </section>

          {/* AI */}
          <section className="settings-section">
            <h3 className="settings-section-title">AI Assistant</h3>

            {aiAccess ? (
              <div className="settings-ai-access">
                <div className="settings-ai-access-main">
                  <CheckCircle2 size={18} />
                  <div>
                    <strong>Manager AI is active</strong>
                    <span>{aiAccess.remainingCredits} of {aiAccess.creditLimit} credits remaining</span>
                  </div>
                </div>
                <div className="settings-ai-meter" aria-label={`${aiAccess.remainingCredits} AI credits remaining`}>
                  <span style={{ width: `${Math.max(0, Math.min(100, (aiAccess.remainingCredits / aiAccess.creditLimit) * 100))}%` }} />
                </div>
                <button className="btn-settings-secondary" onClick={disconnectAi}>
                  <LogOut size={13} /> Disconnect
                </button>
              </div>
            ) : gatewayInput.trim() ? (
              <div className="settings-row">
                <label className="settings-label">Manager activation code</label>
                <div className="settings-activation-row">
                  <input
                    className="settings-input"
                    value={activationCode}
                    onChange={(event) => setActivationCode(event.target.value.toUpperCase())}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") void activateAi();
                    }}
                    placeholder="MGR-XXXX-XXXX-XXXX"
                    spellCheck={false}
                    autoCapitalize="characters"
                  />
                  <button className="btn-primary" onClick={activateAi} disabled={aiLoading || !activationCode.trim()}>
                    <KeyRound size={13} /> Activate
                  </button>
                </div>
                <p className="settings-hint">AI is included with your Manager activation. No Gemini account or API key is required.</p>
              </div>
            ) : (
              <p className="settings-hint">
                Hosted AI is not configured in this build. Add your personal Gemini key under Advanced AI settings to use the assistant.
              </p>
            )}

            {aiLoading && <p className="settings-hint">Checking Manager AI access...</p>}
            {aiError && <p className="settings-error">{aiError}</p>}
            {integrationError && <p className="settings-error">{integrationError}</p>}

            <details className="settings-advanced">
              <summary>Advanced AI settings</summary>
              <div className="settings-row">
                <label className="settings-label">Manager AI service URL</label>
                <input
                  className="settings-input"
                  value={gatewayInput}
                  onChange={(event) => setGatewayInput(event.target.value)}
                  onBlur={() => {
                    const value = gatewayInput.trim();
                    if (value !== (settings.aiGatewayUrl ?? "")) void updateSettings({ aiGatewayUrl: value });
                  }}
                  placeholder="https://manager-ai-gateway.workers.dev"
                  spellCheck={false}
                />
                <p className="settings-hint">This is preconfigured in customer builds. Note content is sent to this service only when you invoke AI.</p>
              </div>
              <div className="settings-row">
                <label className="settings-label">Personal Gemini key (optional)</label>
                <input
                  className="settings-input"
                  type="password"
                  value={geminiInput}
                  onChange={(e) => setGeminiInput(e.target.value)}
                  onBlur={() => void saveCredential("geminiApiKey", geminiInput.trim())}
                  placeholder="Optional power-user fallback"
                  spellCheck={false}
                />
                <p className="settings-hint">Used only when Manager AI is not activated. Stored in macOS Keychain.</p>
              </div>
            </details>
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
                ↑ Import Notes…
              </button>
            </div>
          </section>

          {/* About */}
          <section className="settings-section">
            <h3 className="settings-section-title">About</h3>
            <p className="settings-about">
              <strong>Manager</strong> - version 0.6.0
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

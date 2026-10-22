import { useState } from "react";
import { ArrowRight, CalendarDays, Check, Cloud, FolderOpen, ListChecks, Moon, Sparkles } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { useNotesStore } from "../store/notesStore.js";
import { today } from "@daymark/core";

interface Props {
  onComplete: () => void;
}

type StorageChoice = "local" | "icloud";
type OnboardingTheme = "system" | "light" | "dark";

export function OnboardingModal({ onComplete }: Props) {
  const { settings, updateSettings, openDailyNote } = useNotesStore();
  const [step, setStep] = useState(0);
  const [storage, setStorage] = useState<StorageChoice>(
    () => settings.vaultPath.includes("Mobile Documents") ? "icloud" : "local",
  );
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [theme, setTheme] = useState<OnboardingTheme>(
    () => settings.theme === "light" || settings.theme === "dark" ? settings.theme : "system",
  );
  const [calendarEnabled, setCalendarEnabled] = useState(settings.calendarEnabled);

  async function finish() {
    setWorking(true);
    setError("");
    try {
      const command = storage === "icloud" ? "icloud_vault_path" : "default_vault_path";
      const vaultPath = await invoke<string>(command);
      await updateSettings({ vaultPath, theme, calendarEnabled });
      await openDailyNote(today());
      window.localStorage.setItem("daymark.onboarding.completed", "1");
      window.localStorage.setItem("manager.onboarding.version", "2");
      onComplete();
    } catch {
      setError("DayMark could not prepare that vault. Choose another location in Settings.");
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="onboarding-backdrop">
      <section className="onboarding-modal" aria-label="Welcome to DayMark">
        <div className="onboarding-progress" aria-hidden="true">
          {[0, 1, 2, 3].map((index) => <span key={index} className={index <= step ? "active" : ""} />)}
        </div>

        {step === 0 && (
          <div className="onboarding-page onboarding-welcome">
            <img className="onboarding-brand-mark" src="/daymark-icon.png" alt="" width="64" height="64" />
            <h1>Your day, with context intact.</h1>
            <p>Plan what matters. Close the loop. Carry the useful signal forward.</p>
          </div>
        )}

        {step === 1 && (
          <div className="onboarding-page">
            <h1>Keep your work yours.</h1>
            <p>Your notes remain Markdown files in a folder you control.</p>
            <div className="onboarding-storage">
              <button className={storage === "local" ? "active" : ""} onClick={() => setStorage("local")}>
                <FolderOpen size={20} />
                <span><strong>On this Mac</strong><small>Fast and fully local</small></span>
                {storage === "local" && <Check size={15} />}
              </button>
              <button className={storage === "icloud" ? "active" : ""} onClick={() => setStorage("icloud")}>
                <Cloud size={20} />
                <span><strong>iCloud Drive</strong><small>Available across your Apple devices</small></span>
                {storage === "icloud" && <Check size={15} />}
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="onboarding-page">
            <h1>One page runs the day.</h1>
            <p>Prioritize first, execute from the note, then keep context below it.</p>
            <div className="onboarding-note-preview">
              <strong>Today&apos;s Agenda</strong>
              <span className="priority-p1">P1</span>
              <div><i /> Ship the most important outcome</div>
              <span className="priority-p2">P2</span>
              <div><i /> Move the next project forward</div>
              <small>Press Enter after a task or list item to continue it automatically.</small>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="onboarding-page">
            <h1>Make DayMark feel native.</h1>
            <div className="onboarding-preferences">
              <div className="onboarding-preference-row">
                <span><Moon size={17} /><strong>Appearance</strong></span>
                <div className="onboarding-theme-choice">
                  {(["system", "light", "dark"] as const).map((value) => (
                    <button key={value} className={theme === value ? "active" : ""} onClick={() => setTheme(value)}>
                      {value[0]?.toUpperCase()}{value.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
              <button className={`onboarding-calendar-choice ${calendarEnabled ? "active" : ""}`} onClick={() => setCalendarEnabled((value) => !value)}>
                <CalendarDays size={18} />
                <span><strong>Apple Calendar</strong><small>Show your schedule beside the daily note</small></span>
                <span className="onboarding-switch"><i /></span>
              </button>
              <div className="onboarding-loop compact">
                <div><ListChecks size={17} /><span><strong>Plan</strong><small>P1, P2, P3, and Misc</small></span></div>
                <div><Sparkles size={17} /><span><strong>Think</strong><small>Use AI only when you invoke it</small></span></div>
                <div><Moon size={17} /><span><strong>Close</strong><small>Carry unfinished work forward</small></span></div>
              </div>
            </div>
            {error && <p className="onboarding-error">{error}</p>}
          </div>
        )}

        <footer className="onboarding-footer">
          {step > 0 ? <button className="onboarding-back" onClick={() => setStep((value) => value - 1)}>Back</button> : <span />}
          <button
            className="onboarding-next"
            onClick={() => step < 3 ? setStep((value) => value + 1) : finish()}
            disabled={working}
          >
            {working ? "Preparing…" : step === 3 ? "Open today" : "Continue"}
            {!working && <ArrowRight size={14} />}
          </button>
        </footer>
      </section>
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Brain, Check, ChevronRight, History, Moon, RotateCcw, Sunrise, X } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import {
  addDays,
  appendDailyReview,
  buildExecutionMemory,
  dailyNoteFilename,
  fromISODate,
  parseTasks,
  periodicDefaultContent,
  rolloverOpenTasks,
  sectionLines,
  setDailyFocus,
  toISODate,
  type ExecutionMemoryBrief,
  type MemoryNote,
} from "@daymark/core";
import { useNotesStore } from "../store/notesStore.js";

interface NoteFile {
  path: string;
  content: string;
}

interface Props {
  mode: "plan" | "review";
  noteDate: string;
  content: string;
  onChange: (content: string) => void;
  onClose: () => void;
}

function adjacentDate(date: string, delta: number): string {
  return toISODate(addDays(fromISODate(date), delta));
}

function cleanFocusLine(line: string): string {
  return line.replace(/^[-*]\s+/, "").trim();
}

function currentTime(): string {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function DailyRitualModal({ mode, noteDate, content, onChange, onClose }: Props) {
  const { settings, activeNoteId, saveNote, reloadNoteContent } = useNotesStore();
  const existingFocus = useMemo(
    () => sectionLines(content, "## Day's Focus").map(cleanFocusLine).slice(0, 3),
    [content],
  );
  const [outcomes, setOutcomes] = useState(["", "", ""]);
  const [win, setWin] = useState("");
  const [learned, setLearned] = useState("");
  const [tomorrow, setTomorrow] = useState("");
  const [carryOpen, setCarryOpen] = useState(true);
  const [previousOpen, setPreviousOpen] = useState(0);
  const [previousContent, setPreviousContent] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");
  const [memory, setMemory] = useState<ExecutionMemoryBrief | null>(null);
  const [memoryLoading, setMemoryLoading] = useState(false);

  const tasks = useMemo(() => parseTasks(content, noteDate), [content, noteDate]);
  const openTasks = tasks.filter((task) => task.state === "open");
  const completedTasks = tasks.filter((task) => task.state === "done");
  const previousDate = adjacentDate(noteDate, -1);
  const nextDate = adjacentDate(noteDate, 1);

  useEffect(() => {
    setOutcomes([
      existingFocus[0] ?? "",
      existingFocus[1] ?? "",
      existingFocus[2] ?? "",
    ]);
  }, [noteDate]);

  useEffect(() => {
    if (mode !== "plan") return;
    const path = `${settings.vaultPath}/Daily/${dailyNoteFilename(previousDate)}`;
    invoke<NoteFile>("read_note", { path })
      .then((file) => {
        setPreviousContent(file.content);
        setPreviousOpen(parseTasks(file.content, previousDate).filter((task) => task.state === "open").length);
      })
      .catch(() => {
        setPreviousContent(null);
        setPreviousOpen(0);
      });
  }, [mode, previousDate, settings.vaultPath]);

  useEffect(() => {
    if (mode !== "plan") return;
    let cancelled = false;
    setMemoryLoading(true);

    const dates = Array.from({ length: 14 }, (_, index) => adjacentDate(noteDate, -(index + 1)));
    Promise.all(
      dates.map(async (date): Promise<MemoryNote | null> => {
        const path = `${settings.vaultPath}/Daily/${dailyNoteFilename(date)}`;
        try {
          const file = await invoke<NoteFile>("read_note", { path });
          return { date, content: file.content };
        } catch {
          return null;
        }
      }),
    ).then((notes) => {
      if (cancelled) return;
      setMemory(buildExecutionMemory(notes.filter((note): note is MemoryNote => note !== null), noteDate));
      setMemoryLoading(false);
    });

    return () => { cancelled = true; };
  }, [mode, noteDate, settings.vaultPath]);

  function chooseTask(title: string) {
    const firstEmpty = outcomes.findIndex((outcome) => !outcome.trim());
    const index = firstEmpty === -1 ? 2 : firstEmpty;
    setOutcomes((current) => current.map((outcome, i) => i === index ? title : outcome));
  }

  async function carryPrevious() {
    if (!previousContent || previousOpen === 0) return;
    setWorking(true);
    setMessage("");
    try {
      const result = rolloverOpenTasks(previousContent, content, previousDate, noteDate);
      const sourcePath = `${settings.vaultPath}/Daily/${dailyNoteFilename(previousDate)}`;
      onChange(result.targetContent);
      if (activeNoteId && !(await saveNote(activeNoteId, result.targetContent))) {
        throw new Error("Target note could not be saved.");
      }
      await invoke("write_note", { path: sourcePath, content: result.sourceContent });
      reloadNoteContent(sourcePath, result.sourceContent);
      setPreviousContent(result.sourceContent);
      setPreviousOpen(0);
      setMessage(`${result.count} task${result.count === 1 ? "" : "s"} carried into today`);
    } catch {
      setMessage("Could not finish carrying tasks. The source tasks were kept to prevent loss.");
    } finally {
      setWorking(false);
    }
  }

  async function startDay() {
    const updated = setDailyFocus(content, outcomes);
    onChange(updated);
    if (activeNoteId && !(await saveNote(activeNoteId, updated))) {
      setMessage("Could not save the plan. Keep this window open and try again.");
      return;
    }
    window.localStorage.setItem(`daymark.planned.${noteDate}`, "1");
    onClose();
  }

  async function closeDay() {
    setWorking(true);
    setMessage("");
    try {
      let updated = appendDailyReview(content, {
        win,
        learned,
        tomorrow,
        completedAt: currentTime(),
      });

      if (carryOpen && openTasks.length > 0) {
        const targetPath = `${settings.vaultPath}/Daily/${dailyNoteFilename(nextDate)}`;
        const target = await invoke<NoteFile>("ensure_note_exists", {
          path: targetPath,
          defaultContent: periodicDefaultContent("daily", nextDate),
        });
        const result = rolloverOpenTasks(updated, target.content, noteDate, nextDate);
        updated = result.sourceContent;
        await invoke("write_note", { path: targetPath, content: result.targetContent });
        reloadNoteContent(targetPath, result.targetContent);
      }

      onChange(updated);
      if (activeNoteId && !(await saveNote(activeNoteId, updated))) {
        throw new Error("Daily review could not be saved.");
      }
      window.localStorage.setItem(`daymark.reviewed.${noteDate}`, "1");
      onClose();
    } catch {
      setMessage("Could not finish the closeout. Original tasks were kept to prevent loss.");
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="ritual-backdrop" onMouseDown={onClose}>
      <section className="ritual-modal" onMouseDown={(event) => event.stopPropagation()}>
        <header className="ritual-header">
          <div className={`ritual-mark ${mode}`}>
            {mode === "plan" ? <Sunrise size={18} /> : <Moon size={17} />}
          </div>
          <div>
            <h2>{mode === "plan" ? "Plan the day" : "Close the day"}</h2>
            <p>{mode === "plan" ? "Choose what makes today successful." : "Capture the signal, then clear the deck."}</p>
          </div>
          <button className="ritual-close" onClick={onClose} aria-label="Close"><X size={15} /></button>
        </header>

        {mode === "plan" ? (
          <div className="ritual-body">
            {previousOpen > 0 && (
              <button className="ritual-rollover" onClick={carryPrevious} disabled={working}>
                <RotateCcw size={14} />
                <span>Carry {previousOpen} unfinished task{previousOpen === 1 ? "" : "s"} from yesterday</span>
                <ChevronRight size={14} />
              </button>
            )}

            <div className="ritual-section-label">Three outcomes</div>
            <div className="ritual-outcomes">
              {outcomes.map((outcome, index) => (
                <label key={index} className="ritual-outcome">
                  <span>{index + 1}</span>
                  <input
                    value={outcome}
                    onChange={(event) => setOutcomes((current) => current.map((item, i) => i === index ? event.target.value : item))}
                    placeholder={index === 0 ? "The result that matters most" : "Another meaningful outcome"}
                    autoFocus={index === 0 && !outcome}
                  />
                </label>
              ))}
            </div>

            {(memoryLoading || memory?.handoff || memory?.recurringLoops.length || memory?.learnings.length) && (
              <div className="ritual-memory">
                <div className="ritual-memory-heading">
                  <Brain size={14} />
                  <span>Execution memory</span>
                  <small>last 14 days</small>
                </div>
                {memoryLoading ? (
                  <div className="ritual-memory-loading">Looking through recent work…</div>
                ) : (
                  <div className="ritual-memory-items">
                    {memory?.handoff && (
                      <button onClick={() => chooseTask(memory.handoff!.text)}>
                        <History size={13} />
                        <span><small>Last handoff</small>{memory.handoff.text}</span>
                        <em>Use</em>
                      </button>
                    )}
                    {memory?.recurringLoops.slice(0, 2).map((loop) => (
                      <button key={`${loop.date}-${loop.text}`} onClick={() => chooseTask(loop.text)}>
                        <RotateCcw size={13} />
                        <span><small>Carried {loop.occurrences} times</small>{loop.text}</span>
                        <em>Use</em>
                      </button>
                    ))}
                    {memory?.learnings[0] && (
                      <div className="ritual-memory-signal">
                        <span>Recent learning</span>
                        <p>{memory.learnings[0].text}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {openTasks.length > 0 && (
              <>
                <div className="ritual-section-label">Open tasks in this note</div>
                <div className="ritual-task-list">
                  {openTasks.slice(0, 8).map((task) => (
                    <button key={task.lineIndex} onClick={() => chooseTask(task.content)}>
                      <span className="ritual-task-ring" />
                      <span>{task.content}</span>
                      <ArrowRight size={12} />
                    </button>
                  ))}
                </div>
              </>
            )}
            {message && <div className="ritual-message"><Check size={13} />{message}</div>}
          </div>
        ) : (
          <div className="ritual-body">
            <div className="ritual-score">
              <div><strong>{completedTasks.length}</strong><span>completed</span></div>
              <div><strong>{openTasks.length}</strong><span>still open</span></div>
            </div>
            <label className="ritual-review-field"><span>What moved forward?</span><input value={win} onChange={(e) => setWin(e.target.value)} autoFocus /></label>
            <label className="ritual-review-field"><span>What did you learn?</span><input value={learned} onChange={(e) => setLearned(e.target.value)} /></label>
            <label className="ritual-review-field"><span>What matters tomorrow?</span><input value={tomorrow} onChange={(e) => setTomorrow(e.target.value)} /></label>
            {openTasks.length > 0 && (
              <button className={`ritual-carry-toggle ${carryOpen ? "active" : ""}`} onClick={() => setCarryOpen((value) => !value)}>
                <span className="ritual-checkbox">{carryOpen && <Check size={11} />}</span>
                Carry {openTasks.length} unfinished task{openTasks.length === 1 ? "" : "s"} to tomorrow
              </button>
            )}
            {message && <div className="ritual-message"><Check size={13} />{message}</div>}
          </div>
        )}

        <footer className="ritual-footer">
          <button className="ritual-secondary" onClick={onClose}>Not now</button>
          <button
            className="ritual-primary"
            onClick={mode === "plan" ? startDay : closeDay}
            disabled={working || (mode === "plan" && outcomes.every((outcome) => !outcome.trim()))}
          >
            {working ? "Working…" : mode === "plan" ? "Start the day" : "Complete the day"}
            {!working && <ArrowRight size={14} />}
          </button>
        </footer>
      </section>
    </div>
  );
}

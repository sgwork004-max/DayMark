import React, { useCallback, useEffect, useState, lazy, Suspense } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Sidebar } from "./components/Sidebar.js";
import { Titlebar } from "./components/Titlebar.js";
import { NotePane } from "./pages/DailyNote.js";
import { SmartView } from "./pages/SmartView.js";
import { EntityResultsView } from "./pages/EntityResultsView.js";
import { CommandPalette } from "./components/CommandPalette.js";
import { CalendarPanel } from "./components/CalendarPanel.js";
import { SettingsModal } from "./components/SettingsModal.js";
import { ConflictModal } from "./components/ConflictModal.js";
import { AIPanel } from "./components/AIPanel.js";
import { TableOfContents } from "./components/TableOfContents.js";
import { ShortcutsPanel } from "./components/ShortcutsPanel.js";
import { OnboardingModal } from "./components/OnboardingModal.js";
import { useNotesStore } from "./store/notesStore.js";
import { useFileWatcher } from "./hooks/useFileWatcher.js";
import { addDays, today, toISODate, fromISODate } from "@daymark/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { listen } from "@tauri-apps/api/event";
import { flushPendingNoteWrites } from "./store/notesStore.js";
import { AppNotice } from "./components/AppNotice.js";
import { showAppNotice } from "./appNotice.js";
import { ResizablePanel } from "./components/ResizablePanel.js";

const GraphView   = lazy(() => import("./components/GraphView.js").then((m) => ({ default: m.GraphView })));
const ImportModal = lazy(() => import("./components/ImportModal.js").then((m) => ({ default: m.ImportModal })));

type RightPanel = "toc" | "shortcuts" | null;

function savedPanelWidth(key: string, fallback: number): number {
  const value = Number(window.localStorage.getItem(key));
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export function App() {
  const { sidebarOpen, activeSmartView, activeEntityFilter, openDailyNote, init, setPaletteOpen, settings } =
    useNotesStore();
  const [calendarOpen, setCalendarOpen]   = useState(false);
  const [rightPanel, setRightPanel]       = useState<RightPanel>(null);
  const [settingsOpen, setSettingsOpen]   = useState(false);
  const [aiOpen, setAiOpen]               = useState(false);
  const [graphOpen, setGraphOpen]         = useState(false);
  const [importOpen, setImportOpen]       = useState(false);
  const [startupReady, setStartupReady]   = useState(false);
  const [startupError, setStartupError]   = useState<string | null>(null);
  const [onboardingOpen, setOnboardingOpen] = useState(
    () => window.localStorage.getItem("manager.onboarding.version") !== "2",
  );
  const [sidebarWidth, setSidebarWidth] = useState(() => savedPanelWidth("manager.panel.sidebar", 240));
  const [calendarWidth, setCalendarWidth] = useState(() => savedPanelWidth("manager.panel.calendar", 320));
  const [aiWidth, setAiWidth] = useState(() => savedPanelWidth("manager.panel.ai", 340));
  const [utilityWidth, setUtilityWidth] = useState(() => savedPanelWidth("manager.panel.utility", 300));

  useFileWatcher();

  // Apply theme to document root
  useEffect(() => {
    const theme = settings.theme ?? "dark";
    const media = window.matchMedia("(prefers-color-scheme: light)");
    const apply = () => {
      document.documentElement.dataset.theme = theme === "system"
        ? media.matches ? "light" : "dark"
        : theme;
    };
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [settings.theme]);

  useEffect(() => {
    document.documentElement.style.setProperty("--editor-font-size", `${settings.fontSize}px`);
    document.documentElement.style.setProperty("--editor-font-family", settings.fontFamily);
  }, [settings.fontFamily, settings.fontSize]);

  useEffect(() => { window.localStorage.setItem("manager.panel.sidebar", String(sidebarWidth)); }, [sidebarWidth]);
  useEffect(() => { window.localStorage.setItem("manager.panel.calendar", String(calendarWidth)); }, [calendarWidth]);
  useEffect(() => { window.localStorage.setItem("manager.panel.ai", String(aiWidth)); }, [aiWidth]);
  useEffect(() => { window.localStorage.setItem("manager.panel.utility", String(utilityWidth)); }, [utilityWidth]);

  const initializeApp = useCallback(async () => {
    setStartupError(null);
    try {
      await init();
      await openDailyNote(today());
      setStartupReady(true);
    } catch (error) {
      setStartupReady(false);
      setStartupError(error instanceof Error ? error.message : String(error));
    }
  }, [init, openDailyNote]);

  useEffect(() => {
    void initializeApp();
  }, [initializeApp]);

  useEffect(() => {
    let disposed = false;
    let closing = false;
    let unlisten: (() => void) | undefined;
    const appWindow = getCurrentWindow();

    void appWindow.onCloseRequested(async (event) => {
      if (closing) return;
      event.preventDefault();
      const requestedSaves: Promise<boolean>[] = [];
      document.dispatchEvent(new CustomEvent("daymark:force-save", {
        detail: { waitUntil: (promise: Promise<boolean>) => requestedSaves.push(promise) },
      }));
      const directResults = await Promise.all(requestedSaves);
      const queuedSaved = await flushPendingNoteWrites();
      if (!directResults.every(Boolean) || !queuedSaved) {
        showAppNotice("DayMark could not save your latest changes. The app will remain open so you can try again.", "error");
        return;
      }
      closing = true;
      await appWindow.destroy();
    }).then((listener) => {
      if (disposed) listener();
      else unlisten = listener;
    });

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);

  useEffect(() => {
    // Keyboard shortcuts and the native menu run the same commands. The menu may
    // also see a shortcut the page already handled, so repeats are ignored briefly.
    const lastRun = new Map<string, number>();
    function runCommand(id: string) {
      const now = Date.now();
      if (now - (lastRun.get(id) ?? 0) < 300) return;
      lastRun.set(id, now);
      const store = useNotesStore.getState();
      switch (id) {
        case "palette":    setPaletteOpen(true); break;
        case "today":      void openDailyNote(today()); break;
        case "yesterday":  void openDailyNote(toISODate(addDays(fromISODate(today()), -1))); break;
        case "tomorrow":   void openDailyNote(toISODate(addDays(fromISODate(today()), 1))); break;
        case "calendar":   setCalendarOpen((v) => !v); break;
        case "settings":   setSettingsOpen(true); break;
        case "ai":         setAiOpen((v) => !v); break;
        case "graph":      setGraphOpen((v) => !v); break;
        case "toc":        setRightPanel((v) => v === "toc" ? null : "toc"); break;
        case "shortcuts":  setRightPanel((v) => v === "shortcuts" ? null : "shortcuts"); break;
        case "save":       document.dispatchEvent(new CustomEvent("daymark:force-save")); break;
        case "new-note":   void store.createNote("Untitled"); break;
        case "quick-task": document.dispatchEvent(new CustomEvent("daymark:quick-task")); break;
        case "review-day": document.dispatchEvent(new CustomEvent("daymark:review-day")); break;
        case "import":     setImportOpen(true); break;
      }
    }

    function shortcutFor(e: KeyboardEvent): string | null {
      if (!e.metaKey) return null;
      const key = e.key.toLowerCase();
      if (e.shiftKey) {
        if (e.code === "Space") return "quick-task";
        return ({ t: "tomorrow", c: "calendar", a: "ai", g: "graph", o: "toc", e: "review-day" } as Record<string, string>)[key] ?? null;
      }
      return ({ k: "palette", t: "today", y: "yesterday", ",": "settings", s: "save", n: "new-note" } as Record<string, string>)[key] ?? null;
    }

    function onKeyDown(e: KeyboardEvent) {
      const command = shortcutFor(e);
      if (command) { e.preventDefault(); runCommand(command); return; }
      const target = e.target as HTMLElement | null;
      const isEditing = Boolean(target?.closest("input, textarea, [contenteditable='true'], .cm-editor"));
      if (e.key === "?" && !e.metaKey && !e.ctrlKey && !isEditing) { runCommand("shortcuts"); }
      // ⌘1-3 for smart views
      if (e.metaKey && e.key === "1") { e.preventDefault(); useNotesStore.getState().openSmartView("today"); }
      if (e.metaKey && e.key === "2") { e.preventDefault(); useNotesStore.getState().openSmartView("overdue"); }
      if (e.metaKey && e.key === "3") { e.preventDefault(); useNotesStore.getState().openSmartView("upcoming"); }
    }
    let unlistenMenu: (() => void) | undefined;
    let menuDisposed = false;
    void listen<string>("menu", (event) => runCommand(event.payload)).then((unlisten) => {
      if (menuDisposed) unlisten();
      else unlistenMenu = unlisten;
    });
    function onOpenGraph()     { setGraphOpen(true); }
    function onOpenShortcuts() { setRightPanel((v) => v === "shortcuts" ? null : "shortcuts"); }

    window.addEventListener("keydown", onKeyDown);
    document.addEventListener("daymark:open-graph",     onOpenGraph);
    document.addEventListener("daymark:open-shortcuts", onOpenShortcuts);
    return () => {
      menuDisposed = true;
      unlistenMenu?.();
      window.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("daymark:open-graph",     onOpenGraph);
      document.removeEventListener("daymark:open-shortcuts", onOpenShortcuts);
    };
  }, [openDailyNote, setPaletteOpen]);

  if (!startupReady) {
    return (
      <div className="startup-screen">
        {startupError ? (
          <>
            <AlertTriangle size={30} strokeWidth={1.7} />
            <h1>DayMark could not open your notes</h1>
            <p>{startupError}</p>
            <button className="btn-primary" onClick={() => void initializeApp()}>
              <RefreshCw size={14} /> Retry
            </button>
          </>
        ) : (
          <>
            <div className="startup-spinner" />
            <p>Opening DayMark...</p>
          </>
        )}
      </div>
    );
  }

  return (
    <>
      {/* Full-screen overlays */}
      {graphOpen && (
        <Suspense fallback={null}>
          <GraphView onClose={() => setGraphOpen(false)} />
        </Suspense>
      )}

      <div className={`app-shell ${sidebarOpen ? "sidebar-visible" : "sidebar-hidden"} ${calendarOpen ? "calendar-visible" : ""}`}>
        <Titlebar
          onCalendarToggle={() => setCalendarOpen((v) => !v)}
          onSettingsOpen={() => setSettingsOpen(true)}
          onAIToggle={() => setAiOpen((v) => !v)}
          onGraphOpen={() => setGraphOpen(true)}
          onTOCToggle={() => setRightPanel((v) => v === "toc" ? null : "toc")}
          onShortcutsToggle={() => setRightPanel((v) => v === "shortcuts" ? null : "shortcuts")}
        />
        <div className="app-body">
          {sidebarOpen && (
            <ResizablePanel
              className="sidebar-panel-shell"
              edge="right"
              width={sidebarWidth}
              minWidth={190}
              maxWidth={360}
              defaultWidth={240}
              onWidthChange={setSidebarWidth}
              label="navigation sidebar"
            >
              <Sidebar />
            </ResizablePanel>
          )}

          <main className="main-content">
            {activeEntityFilter ? <EntityResultsView /> : activeSmartView ? <SmartView /> : <NotePane />}
          </main>

          {/* Right panel — mutually exclusive */}
          {rightPanel && (
            <ResizablePanel
              edge="left"
              width={utilityWidth}
              minWidth={240}
              maxWidth={480}
              defaultWidth={300}
              onWidthChange={setUtilityWidth}
              label="utility panel"
            >
              <aside className="right-panel">
                {rightPanel === "toc"        && <TableOfContents onClose={() => setRightPanel(null)} />}
                {rightPanel === "shortcuts"  && <ShortcutsPanel onClose={() => setRightPanel(null)} />}
              </aside>
            </ResizablePanel>
          )}

          {/* AI panel */}
          {aiOpen && (
            <ResizablePanel
              edge="left"
              width={aiWidth}
              minWidth={280}
              maxWidth={520}
              defaultWidth={340}
              onWidthChange={setAiWidth}
              label="AI assistant"
            >
              <AIPanel onClose={() => setAiOpen(false)} />
            </ResizablePanel>
          )}

          {/* Calendar panel */}
          {calendarOpen && (
            <ResizablePanel
              edge="left"
              width={calendarWidth}
              minWidth={280}
              maxWidth={540}
              defaultWidth={320}
              onWidthChange={setCalendarWidth}
              label="calendar"
            >
              <CalendarPanel onClose={() => setCalendarOpen(false)} />
            </ResizablePanel>
          )}
        </div>

        <CommandPalette />
        <AppNotice />
        <ConflictModal />
        {onboardingOpen && <OnboardingModal onComplete={() => setOnboardingOpen(false)} />}

        {settingsOpen && (
          <SettingsModal
            onClose={() => setSettingsOpen(false)}
            onImport={() => setImportOpen(true)}
            onOnboarding={() => {
              setSettingsOpen(false);
              setOnboardingOpen(true);
            }}
          />
        )}

        {importOpen && (
          <Suspense fallback={null}>
            <ImportModal onClose={() => setImportOpen(false)} />
          </Suspense>
        )}

      </div>
    </>
  );
}

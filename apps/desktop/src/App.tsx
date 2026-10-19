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
        showAppNotice("Manager could not save your latest changes. The app will remain open so you can try again.", "error");
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
    function onKeyDown(e: KeyboardEvent) {
      if (e.metaKey && e.key === "k") { e.preventDefault(); setPaletteOpen(true); return; }
      if (e.metaKey && !e.shiftKey && e.key === "t") { e.preventDefault(); openDailyNote(today()); }
      if (e.metaKey && !e.shiftKey && e.key === "y") { e.preventDefault(); openDailyNote(toISODate(addDays(fromISODate(today()), -1))); }
      if (e.metaKey && e.shiftKey && e.key === "T")  { e.preventDefault(); openDailyNote(toISODate(addDays(fromISODate(today()), 1))); }
      if (e.metaKey && e.shiftKey && e.key === "C") { e.preventDefault(); setCalendarOpen((v) => !v); }
      if (e.metaKey && e.key === ",")           { e.preventDefault(); setSettingsOpen(true); }
      if (e.metaKey && e.shiftKey && e.key === "A") { e.preventDefault(); setAiOpen((v) => !v); }
      if (e.metaKey && e.shiftKey && e.key === "G") { e.preventDefault(); setGraphOpen((v) => !v); }
      if (e.metaKey && e.shiftKey && e.key === "O") { e.preventDefault(); setRightPanel((v) => v === "toc" ? null : "toc"); }
      if (e.metaKey && e.key === "s") { e.preventDefault(); document.dispatchEvent(new CustomEvent("daymark:force-save")); }
      if (e.metaKey && e.key === "n") { e.preventDefault(); useNotesStore.getState().createNote("Untitled"); }
      if (e.metaKey && e.shiftKey && e.code === "Space") { e.preventDefault(); document.dispatchEvent(new CustomEvent("daymark:quick-task")); }
      if (e.metaKey && e.shiftKey && e.key.toLowerCase() === "e") { e.preventDefault(); document.dispatchEvent(new CustomEvent("daymark:review-day")); }
      const target = e.target as HTMLElement | null;
      const isEditing = Boolean(target?.closest("input, textarea, [contenteditable='true'], .cm-editor"));
      if (e.key === "?" && !e.metaKey && !e.ctrlKey && !isEditing) { setRightPanel((v) => v === "shortcuts" ? null : "shortcuts"); }
      // ⌘1-3 for smart views
      if (e.metaKey && e.key === "1") { e.preventDefault(); useNotesStore.getState().openSmartView("today"); }
      if (e.metaKey && e.key === "2") { e.preventDefault(); useNotesStore.getState().openSmartView("overdue"); }
      if (e.metaKey && e.key === "3") { e.preventDefault(); useNotesStore.getState().openSmartView("upcoming"); }
    }
    function onOpenGraph()     { setGraphOpen(true); }
    function onOpenShortcuts() { setRightPanel((v) => v === "shortcuts" ? null : "shortcuts"); }

    window.addEventListener("keydown", onKeyDown);
    document.addEventListener("daymark:open-graph",     onOpenGraph);
    document.addEventListener("daymark:open-shortcuts", onOpenShortcuts);
    return () => {
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
            <h1>Manager could not open your notes</h1>
            <p>{startupError}</p>
            <button className="btn-primary" onClick={() => void initializeApp()}>
              <RefreshCw size={14} /> Retry
            </button>
          </>
        ) : (
          <>
            <div className="startup-spinner" />
            <p>Opening Manager...</p>
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

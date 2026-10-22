import React, { useEffect, useRef } from "react";
import { EditorState, Extension } from "@codemirror/state";
import { EditorView, keymap, highlightActiveLine, drawSelection } from "@codemirror/view";
import { defaultKeymap, historyKeymap, history, indentWithTab } from "@codemirror/commands";
import { searchKeymap } from "@codemirror/search";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { syntaxHighlighting, defaultHighlightStyle } from "@codemirror/language";
import { inlineDecorations } from "./extensions/wikilinks.js";
import { notePlanKeymap } from "./extensions/keymap.js";
import { notePlanTheme } from "./theme.js";

interface NoteEditorProps {
  content: string;
  onChange: (content: string) => void;
  onWikiLinkClick?: (target: string) => void;
  readOnly?: boolean;
  autoFocus?: boolean;
}


function buildStaticExtensions(readOnly: boolean): Extension[] {
  return [
    history(),
    drawSelection(),
    highlightActiveLine(),
    syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
    markdown({ base: markdownLanguage, addKeymap: false }),
    keymap.of([
      ...notePlanKeymap,
      ...defaultKeymap,
      ...historyKeymap,
      ...searchKeymap,
      indentWithTab,
    ]),
    inlineDecorations,
    notePlanTheme,
    EditorView.lineWrapping,
    EditorView.editable.of(!readOnly),
  ];
}

export function NoteEditor({
  content,
  onChange,
  onWikiLinkClick,
  readOnly = false,
  autoFocus = false,
}: NoteEditorProps) {
  const containerRef   = useRef<HTMLDivElement>(null);
  const viewRef        = useRef<EditorView | null>(null);
  const contentRef     = useRef(content);
  // Always-current refs — no stale closures
  const onChangeRef    = useRef(onChange);
  const onWikiRef      = useRef(onWikiLinkClick);
  onChangeRef.current  = onChange;
  onWikiRef.current    = onWikiLinkClick;

  // Mount once
  useEffect(() => {
    if (!containerRef.current) return;

    const state = EditorState.create({
      doc: content,
      extensions: [
        ...buildStaticExtensions(readOnly),
        // Route doc changes through the always-current ref
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            const val = update.state.doc.toString();
            contentRef.current = val;
            onChangeRef.current(val);
          }
        }),
        // Route wiki-link clicks through the always-current ref
        EditorView.domEventHandlers({
          click(event, view) {
            const el = event.target as HTMLElement;
            const checkbox = el.closest(".cm-task-checkbox-token") as HTMLElement | null;
            if (checkbox) {
              const line = view.state.doc.lineAt(view.posAtDOM(checkbox));
              let updated = line.text;
              if (/\[ \]/.test(updated)) {
                updated = updated.replace("[ ]", "[x]");
                if (!updated.includes("@done(")) updated = `${updated.trimEnd()} @done(${new Date().toISOString().slice(0, 10)})`;
              } else if (/\[x\]/i.test(updated)) {
                updated = updated.replace(/\[x\]/i, "[ ]").replace(/\s*@done\([^)]*\)/, "");
              }
              view.dispatch({ changes: { from: line.from, to: line.to, insert: updated } });
              return true;
            }

            const handler = onWikiRef.current;
            if (!handler) return false;
            if (!el.classList.contains("cm-wikilink")) return false;
            const pos  = view.posAtDOM(el);
            const text = view.state.doc.sliceString(Math.max(0, pos - 60), pos + 60);
            const m    = /\[\[([^\]]+)\]\]/.exec(text);
            if (m?.[1]) { handler(m[1]); return true; }
            return false;
          },
        }),
      ],
    });

    const view = new EditorView({ state, parent: containerRef.current });
    viewRef.current = view;
    if (autoFocus) view.focus();

    return () => { view.destroy(); viewRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync when the active note changes (external content change)
  useEffect(() => {
    const view = viewRef.current;
    if (!view || contentRef.current === content) return;
    contentRef.current = content;
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: content } });
  }, [content]);

  // Scroll editor to a specific line index (0-based) from SmartView task clicks
  useEffect(() => {
    function onScrollToLine(e: Event) {
      const lineIndex: number = (e as CustomEvent<number>).detail;
      const view = viewRef.current;
      if (!view) return;
      const docLines = view.state.doc.lines;
      const lineNum  = Math.min(lineIndex + 1, docLines); // CodeMirror lines are 1-based
      const line     = view.state.doc.line(lineNum);
      view.dispatch({
        selection: { anchor: line.from, head: line.to },
        effects: EditorView.scrollIntoView(line.from, { y: "center" }),
      });
      view.focus();
    }
    document.addEventListener("daymark:scroll-to-line", onScrollToLine);
    return () => document.removeEventListener("daymark:scroll-to-line", onScrollToLine);
  }, []);

  // Place the cursor at the end of a task line created from the native task panel.
  useEffect(() => {
    function onEditTaskLine(e: Event) {
      const lineIndex: number = (e as CustomEvent<number>).detail;
      const view = viewRef.current;
      if (!view) return;
      const line = view.state.doc.line(Math.min(lineIndex + 1, view.state.doc.lines));
      view.dispatch({
        selection: { anchor: line.to },
        effects: EditorView.scrollIntoView(line.to, { y: "center" }),
      });
      view.focus();
    }
    document.addEventListener("daymark:edit-task-line", onEditTaskLine);
    return () => document.removeEventListener("daymark:edit-task-line", onEditTaskLine);
  }, []);

  return <div ref={containerRef} className="note-editor" />;
}

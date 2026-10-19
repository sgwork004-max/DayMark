import { KeyBinding, EditorView } from "@codemirror/view";
import { EditorSelection } from "@codemirror/state";

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

interface ListContinuation {
  prefix: string;
  content: string;
}

/** Return the next-line prefix for Markdown tasks, bullets, and numbered lists. */
export function listContinuationForLine(text: string): ListContinuation | null {
  const task = /^(\s*)-\s+\[[ xX\->]\]\s?(.*)$/.exec(text);
  if (task) {
    return { prefix: `${task[1] ?? ""}- [ ] `, content: task[2] ?? "" };
  }

  const bullet = /^(\s*)([-*+])\s+(.*)$/.exec(text);
  if (bullet?.[2]) {
    return { prefix: `${bullet[1] ?? ""}${bullet[2]} `, content: bullet[3] ?? "" };
  }

  const numbered = /^(\s*)(\d+)([.)])\s+(.*)$/.exec(text);
  if (numbered?.[2] && numbered[3]) {
    return {
      prefix: `${numbered[1] ?? ""}${Number(numbered[2]) + 1}${numbered[3]} `,
      content: numbered[4] ?? "",
    };
  }

  return null;
}

function continueMarkdownList(view: EditorView): boolean {
  const { state } = view;
  const range = state.selection.main;
  if (!range.empty) return false;

  const line = state.doc.lineAt(range.head);
  const continuation = listContinuationForLine(line.text);
  if (!continuation) return false;

  if (!continuation.content.trim() && range.head === line.to) {
    view.dispatch({
      changes: { from: line.from, to: line.to, insert: "" },
      selection: EditorSelection.cursor(line.from),
    });
    return true;
  }

  const insertion = `\n${continuation.prefix}`;
  view.dispatch({
    changes: { from: range.head, insert: insertion },
    selection: EditorSelection.cursor(range.head + insertion.length),
  });
  return true;
}

/** Insert a new task line on Enter inside a task */
function newlineAndContinueTask(view: EditorView): boolean {
  const line = view.state.doc.lineAt(view.state.selection.main.head);
  if (!/^\s*-\s+\[[ xX\->]\]/.test(line.text)) return false;
  return continueMarkdownList(view);
}

/** Toggle task done/open on Cmd+Enter, with @done(date) annotation */
function toggleTaskOnLine(view: EditorView): boolean {
  const { state } = view;
  const line = state.doc.lineAt(state.selection.main.head);
  const text = line.text;

  if (/\[ \]/.test(text)) {
    let updated = text.replace("[ ]", "[x]");
    if (!updated.includes("@done(")) {
      updated = updated.trimEnd() + ` @done(${todayISO()})`;
    }
    view.dispatch({ changes: { from: line.from, to: line.to, insert: updated } });
    return true;
  }

  if (/\[x\]/i.test(text)) {
    const updated = text.replace(/\[x\]/i, "[ ]").replace(/\s*@done\([^)]*\)/, "");
    view.dispatch({ changes: { from: line.from, to: line.to, insert: updated } });
    return true;
  }

  return false;
}

/** Indent/unindent list items with Tab / Shift+Tab */
function indentListItem(view: EditorView): boolean {
  const { state } = view;
  const line = state.doc.lineAt(state.selection.main.head);
  if (!/^\s*[-*+]/.test(line.text)) return false;
  view.dispatch({ changes: { from: line.from, insert: "  " } });
  return true;
}

function unindentListItem(view: EditorView): boolean {
  const { state } = view;
  const line = state.doc.lineAt(state.selection.main.head);
  if (!/^  /.test(line.text)) return false;
  view.dispatch({ changes: { from: line.from, to: line.from + 2, insert: "" } });
  return true;
}

export const notePlanKeymap: readonly KeyBinding[] = [
  { key: "Enter",       run: newlineAndContinueTask },
  { key: "Enter",       run: continueMarkdownList },
  { key: "Mod-Enter",   run: toggleTaskOnLine },
  { key: "Tab",         run: indentListItem },
  { key: "Shift-Tab",   run: unindentListItem },
  // Dispatch save event from inside the editor so it fires even when
  // CodeMirror has focus (browser keydown may not reach window in that case).
  { key: "Mod-s", run: () => {
    document.dispatchEvent(new CustomEvent("daymark:force-save"));
    return true; // prevent browser "Save Page As" dialog
  }},
];

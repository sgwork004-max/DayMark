import { EditorView } from "@codemirror/view";
import { syntaxHighlighting } from "@codemirror/language";
import { tagHighlighter, tags } from "@lezer/highlight";

/**
 * Emits the `tok-*` classes styled below. CodeMirror's default highlight style
 * uses generated class names and underlines headings, so it is not used.
 */
export const markdownHighlighting = syntaxHighlighting(tagHighlighter([
  { tag: tags.heading1, class: "tok-heading1" },
  { tag: tags.heading2, class: "tok-heading2" },
  { tag: [tags.heading3, tags.heading4, tags.heading5, tags.heading6], class: "tok-heading3" },
  { tag: tags.strong, class: "tok-strong" },
  { tag: tags.emphasis, class: "tok-emphasis" },
  { tag: tags.monospace, class: "tok-monospace" },
  { tag: tags.strikethrough, class: "tok-strikethrough" },
  { tag: tags.quote, class: "tok-quote" },
  { tag: tags.contentSeparator, class: "tok-contentSeparator" },
  { tag: tags.link, class: "tok-link" },
  { tag: tags.url, class: "tok-url" },
  { tag: tags.processingInstruction, class: "tok-meta" },
]));

export const notePlanTheme = EditorView.theme(
  {
    "&": {
      height: "100%",
      fontSize: "var(--editor-font-size, 15px)",
      fontFamily: "var(--editor-font-family, system-ui)",
      background: "transparent",
      color: "var(--color-text)",
    },
    ".cm-scroller": {
      // CodeMirror's base theme sets monospace here, which hides the font setting.
      fontFamily: "inherit",
      overflowY: "auto",
      overflowX: "hidden",
      lineHeight: "1.75",
      padding: "0 0 120px 0",
    },
    ".cm-content": {
      caretColor: "var(--color-accent)",
      width: "100%",
      minWidth: "0",
      maxWidth: "720px",
      margin: "0 auto",
      padding: "32px 48px",
    },
    ".cm-line": {
      minWidth: "0",
      overflowWrap: "anywhere",
      wordBreak: "break-word",
    },
    ".cm-cursor": { borderLeftColor: "var(--color-accent)" },
    ".cm-activeLine": { background: "var(--color-editor-active)" },
    ".cm-selectionBackground": { background: "var(--color-selection) !important" },
    "&.cm-focused .cm-selectionBackground": { background: "var(--color-selection-strong) !important" },
    ".cm-gutters": { display: "none" },

    // Daily-note hierarchy
    ".cm-line.cm-note-title": {
      marginBottom: "12px",
      padding: "3px 0 5px",
      fontSize: "28px",
      fontWeight: "760",
      lineHeight: "1.25",
      color: "var(--color-text)",
      textDecoration: "none !important",
      borderBottom: "none !important",
    },
    ".cm-line.cm-note-title .tok-heading1, .cm-line.cm-note-title *": {
      fontSize: "inherit",
      fontWeight: "inherit",
      textDecoration: "none !important",
      borderBottom: "none !important",
    },
    ".cm-line.cm-agenda-heading": {
      marginTop: "2px",
      marginBottom: "0",
      fontSize: "18px",
      fontWeight: "700",
      color: "var(--color-text)",
      textDecoration: "none !important",
    },
    ".cm-line.cm-heading-2": {
      marginTop: "18px",
      marginBottom: "5px",
      fontSize: "1.42em",
      fontWeight: "720",
      lineHeight: "1.35",
      color: "var(--color-text)",
    },
    ".cm-line.cm-heading-3": {
      marginTop: "12px",
      marginBottom: "3px",
      fontSize: "1.12em",
      fontWeight: "650",
      lineHeight: "1.4",
      color: "var(--color-text-secondary)",
    },
    ".cm-line.cm-agenda-priority": {
      marginTop: "0",
      paddingTop: "0",
      fontSize: "13px",
      fontWeight: "750",
      lineHeight: "1.45",
      textTransform: "uppercase",
    },
    ".cm-priority-widget": {
      display: "inline-flex",
      alignItems: "center",
      fontSize: "13px",
      fontWeight: "750",
      letterSpacing: "0",
    },
    ".cm-priority-label-p1": { color: "#ef6461 !important" },
    ".cm-priority-label-p2": { color: "#e7a63a !important" },
    ".cm-priority-label-p3": { color: "#579dff !important" },
    ".cm-priority-label-misc": { color: "var(--color-text-muted) !important" },
    ".cm-line.cm-note-title .tok-heading1, .cm-line.cm-agenda-heading .tok-heading2, .cm-line.cm-agenda-priority .tok-heading3": {
      textDecoration: "none !important",
    },
    ".cm-priority-marker": { display: "none" },
    ".cm-line.cm-note-title.cm-activeLine": { background: "transparent" },
    ".cm-line.cm-task-empty::after": {
      content: '"Add a task"',
      color: "var(--color-text-disabled)",
      pointerEvents: "none",
    },
    ".cm-task-prefix": {
      display: "inline",
      color: "var(--color-text-disabled) !important",
    },
    ".cm-task-checkbox-token": {
      display: "inline",
      marginRight: "7px",
      color: "#8b83ff !important",
      fontSize: "inherit",
      fontWeight: "650",
      background: "transparent",
      cursor: "pointer",
    },
    ".cm-task-checkbox-token:hover": { color: "var(--color-accent) !important" },
    ".cm-task-checkbox-token.is-checked": { color: "#35b87f !important" },
    ".cm-task-checkbox-token.is-scheduled": { color: "var(--color-scheduled) !important" },
    ".cm-task-checkbox-token.is-cancelled": { color: "var(--color-text-disabled) !important", opacity: "0.65" },

    // Tasks
    ".cm-task-open":      { color: "var(--color-text)" },
    ".cm-task-done":      { color: "var(--color-text-muted)" },
    ".cm-task-cancelled": { color: "var(--color-text-disabled)", textDecoration: "line-through", opacity: "0.5" },
    ".cm-task-scheduled": { color: "var(--color-scheduled)" },

    // Checkbox widget
    ".cm-task-checkbox-wrap": { display: "inline-flex", alignItems: "center", verticalAlign: "middle" },
    ".cm-task-checkbox": {
      appearance: "none",
      width: "15px",
      height: "15px",
      border: "1.5px solid var(--color-border)",
      borderRadius: "3px",
      cursor: "pointer",
      background: "transparent",
      position: "relative",
      flexShrink: "0",
      transition: "background 0.1s, border-color 0.1s",
    },
    ".cm-task-checkbox:checked": {
      background: "var(--color-accent)",
      borderColor: "var(--color-accent)",
    },
    ".cm-task-checkbox:checked::after": {
      content: "'✓'",
      position: "absolute",
      fontSize: "11px",
      color: "white",
      top: "-1px",
      left: "1px",
    },

    // Inline decorations
    ".cm-wikilink": {
      color: "var(--color-accent)",
      textDecoration: "none",
      background: "rgba(124, 111, 255, 0.08)",
      borderRadius: "3px",
      padding: "0 2px",
      cursor: "pointer",
    },
    ".cm-tag":     { color: "var(--color-tag)",     fontWeight: "500" },
    ".cm-mention": { color: "var(--color-mention)", fontWeight: "500" },
    ".cm-task-scheduled-token": { color: "var(--color-scheduled)", fontWeight: "600" },
    ".cm-task-deadline-token":  { color: "var(--color-mention)",   fontWeight: "600" },
    ".cm-task-remind-token":    { color: "#8b5cf6",                fontWeight: "600" },
    ".cm-task-done-token":      { color: "#22a06b",                fontWeight: "600" },

    // Markdown headings
    ".cm-line .tok-heading1": { fontSize: "1.6em", fontWeight: "700", color: "inherit", lineHeight: "1.3", textDecoration: "none" },
    ".cm-line .tok-heading2": { fontSize: "inherit", fontWeight: "inherit", color: "inherit", textDecoration: "none" },
    ".cm-line .tok-heading3": { fontSize: "inherit", fontWeight: "inherit", color: "inherit", textDecoration: "none" },

    // Strong / em / code
    ".tok-strong":         { fontWeight: "700" },
    ".tok-emphasis":       { fontStyle: "italic" },
    ".tok-monospace":      { fontFamily: "var(--font-mono, monospace)", background: "var(--color-code-bg)", borderRadius: "3px", padding: "0 3px" },
    ".tok-strikethrough":  { textDecoration: "line-through", opacity: "0.5" },

    // HR
    ".tok-contentSeparator": { color: "var(--color-border)" },
    ".tok-quote":  { color: "var(--color-text-secondary)", fontStyle: "italic" },
    ".tok-link":   { color: "var(--color-accent)" },
    ".tok-url":    { color: "var(--color-text-muted)" },
    // Same specificity as the heading rules above and declared after them, so
    // heading and list marks stay dimmed inside headings.
    ".cm-line .tok-meta": { color: "var(--color-text-disabled)" },
  },
  { dark: true },
);

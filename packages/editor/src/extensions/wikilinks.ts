import { Decoration, DecorationSet, EditorView, ViewPlugin, ViewUpdate, WidgetType } from "@codemirror/view";
import { RangeSetBuilder } from "@codemirror/state";

const WIKILINK_RE = /\[\[([^\]]+)\]\]/g;
const TAG_RE = /#([\w/-]+)/g;
const MENTION_RE = /@(?!done|due|repeat|start|remind)([\w-]+)/g;
const SCHEDULED_TOKEN_RE = />\s*(?:\d{4}-\d{2}-\d{2}|\d{2}\/\d{2})/g;
const DEADLINE_TOKEN_RE = /@due\((?:\d{4}-\d{2}-\d{2}|\d{2}\/\d{2})\)/g;
const REMIND_TOKEN_RE = /@remind\([^)]+\)/g;
const DONE_TOKEN_RE = /@done\((?:\d{4}-\d{2}-\d{2}|\d{2}\/\d{2})\)/g;

class PriorityLabelWidget extends WidgetType {
  constructor(readonly label: string, readonly color: string) { super(); }

  toDOM(): HTMLElement {
    const element = document.createElement("span");
    element.className = "cm-priority-widget";
    const text = document.createElement("span");
    text.textContent = this.label;
    text.style.setProperty("color", this.color, "important");
    text.style.setProperty("-webkit-text-fill-color", this.color, "important");
    element.append(text);
    element.style.setProperty("color", this.color, "important");
    element.style.setProperty("-webkit-text-fill-color", this.color, "important");
    return element;
  }

  eq(other: PriorityLabelWidget): boolean {
    return other.label === this.label && other.color === this.color;
  }

  ignoreEvent(): boolean { return false; }
}

function priorityColor(priority: string): string {
  if (priority === "p1") return "#ef6461";
  if (priority === "p2") return "#e7a63a";
  if (priority === "p3") return "#579dff";
  return "var(--color-text-muted)";
}

export const inlineDecorations = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = this.build(view);
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = this.build(update.view);
      }
    }

    build(view: EditorView): DecorationSet {
      const builder = new RangeSetBuilder<Decoration>();
      const { from, to } = view.viewport;

      for (let pos = from; pos <= to;) {
        const line = view.state.doc.lineAt(pos);
        const text = line.text;

        if (/^#\s+/.test(text)) {
          builder.add(line.from, line.from, Decoration.line({ class: "cm-note-title" }));
        } else if (/^##\s+Today's Agenda\s*$/.test(text)) {
          builder.add(line.from, line.from, Decoration.line({ class: "cm-agenda-heading" }));
        } else {
          const priorityMatch = /^(###\s+)(P1|P2|P3|Misc)\s*$/i.exec(text);
          const priority = priorityMatch?.[2]?.toLowerCase();
          if (priority && priorityMatch?.[1]) {
            builder.add(line.from, line.from, Decoration.line({ class: `cm-agenda-priority cm-agenda-${priority}` }));
            builder.add(
              line.from,
              line.to,
              Decoration.replace({
                widget: new PriorityLabelWidget(priorityMatch[2] ?? priority.toUpperCase(), priorityColor(priority)),
              }),
            );
          } else if (/^##\s+/.test(text)) {
            builder.add(line.from, line.from, Decoration.line({ class: "cm-heading-2" }));
          } else if (/^###\s+/.test(text)) {
            builder.add(line.from, line.from, Decoration.line({ class: "cm-heading-3" }));
          }
        }

        const taskMatch = /^(\s*-\s+)(\[([ xX>\-])\])/.exec(text);
        if (taskMatch?.[1] && taskMatch[2]) {
          const tokenStart = line.from + taskMatch[1].length;
          const state = taskMatch[3]?.toLowerCase();
          builder.add(line.from, tokenStart, Decoration.mark({ class: "cm-task-prefix" }));
          builder.add(tokenStart, tokenStart + taskMatch[2].length, Decoration.mark({
            class: `cm-task-checkbox-token ${state === "x" ? "is-checked" : state === ">" ? "is-scheduled" : state === "-" ? "is-cancelled" : "is-open"}`,
          }));
        }

        // Wiki-links
        for (const m of text.matchAll(WIKILINK_RE)) {
          const start = line.from + (m.index ?? 0);
          builder.add(start, start + m[0].length, Decoration.mark({ class: "cm-wikilink" }));
        }

        // Tags
        for (const m of text.matchAll(TAG_RE)) {
          const start = line.from + (m.index ?? 0);
          builder.add(start, start + m[0].length, Decoration.mark({ class: "cm-tag" }));
        }

        // Mentions
        for (const m of text.matchAll(MENTION_RE)) {
          const start = line.from + (m.index ?? 0);
          builder.add(start, start + m[0].length, Decoration.mark({ class: "cm-mention" }));
        }

        // Task metadata
        for (const m of text.matchAll(SCHEDULED_TOKEN_RE)) {
          const start = line.from + (m.index ?? 0);
          builder.add(start, start + m[0].length, Decoration.mark({ class: "cm-task-scheduled-token" }));
        }

        for (const m of text.matchAll(DEADLINE_TOKEN_RE)) {
          const start = line.from + (m.index ?? 0);
          builder.add(start, start + m[0].length, Decoration.mark({ class: "cm-task-deadline-token" }));
        }

        for (const m of text.matchAll(REMIND_TOKEN_RE)) {
          const start = line.from + (m.index ?? 0);
          builder.add(start, start + m[0].length, Decoration.mark({ class: "cm-task-remind-token" }));
        }

        for (const m of text.matchAll(DONE_TOKEN_RE)) {
          const start = line.from + (m.index ?? 0);
          builder.add(start, start + m[0].length, Decoration.mark({ class: "cm-task-done-token" }));
        }

        pos = line.to + 1;
      }

      return builder.finish();
    }
  },
  { decorations: (v) => v.decorations },
);

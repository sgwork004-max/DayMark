import { EditorView, Decoration, DecorationSet, ViewPlugin, ViewUpdate, WidgetType } from "@codemirror/view";
import { RangeSetBuilder } from "@codemirror/state";

const TASK_LINE_RE = /^(\s*)-\s+\[([\ xX\-\>])\]\s*/;

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function toggleLine(lineText: string, nowChecked: boolean): string {
  if (nowChecked) {
    // Was checked → uncheck: remove [x] → [ ] and strip @done(...)
    return lineText.replace(/\[x\]/i, "[ ]").replace(/\s*@done\([^)]*\)/, "");
  } else {
    // Was open → check: [ ] → [x] and add @done(date)
    let updated = lineText.replace("[ ]", "[x]");
    if (!updated.includes("@done(")) {
      updated = updated.trimEnd() + ` @done(${todayISO()})`;
    }
    return updated;
  }
}

class CheckboxWidget extends WidgetType {
  constructor(
    readonly checked: boolean,
    readonly lineStart: number,
    readonly checkboxStart: number,
  ) {
    super();
  }

  toDOM(view: EditorView): HTMLElement {
    const wrap = document.createElement("span");
    wrap.className = "cm-task-checkbox-wrap";

    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = this.checked;
    cb.className = "cm-task-checkbox";
    cb.setAttribute("aria-label", this.checked ? "Mark incomplete" : "Mark complete");

    cb.addEventListener("mousedown", (e) => {
      e.preventDefault();
      const doc = view.state.doc;
      const line = doc.lineAt(this.checkboxStart);
      const updated = toggleLine(line.text, this.checked);
      view.dispatch({ changes: { from: line.from, to: line.to, insert: updated } });
    });

    wrap.appendChild(cb);
    return wrap;
  }

  ignoreEvent() { return false; }
  eq(other: CheckboxWidget) {
    return other.checked === this.checked && other.lineStart === this.lineStart;
  }
}

export const taskDecorations = ViewPlugin.fromClass(
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
        const m = TASK_LINE_RE.exec(line.text);

        if (m) {
          const stateChar = m[2] as string;
          const checked   = /[xX]/.test(stateChar);
          const cancelled = stateChar === "-";
          const scheduled = stateChar === ">";

          const cbStart = line.from + line.text.indexOf("[");
          const cbEnd   = cbStart + 3;

          builder.add(
            cbStart,
            cbEnd,
            Decoration.replace({
              widget: new CheckboxWidget(checked, line.from, cbStart),
            }),
          );

          const baseCls = checked    ? "cm-task-done"
                    : cancelled  ? "cm-task-cancelled"
                    : scheduled  ? "cm-task-scheduled"
                                 : "cm-task-open";
          builder.add(line.from, line.from, Decoration.line({ class: baseCls }));
        }

        pos = line.to + 1;
      }

      return builder.finish();
    }
  },
  { decorations: (v) => v.decorations },
);

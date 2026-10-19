import React from "react";
import { X } from "lucide-react";

interface Shortcut {
  keys: string[];
  description: string;
}
interface Group {
  label: string;
  shortcuts: Shortcut[];
}

const GROUPS: Group[] = [
  {
    label: "Navigation",
    shortcuts: [
      { keys: ["⌘", "N"],          description: "New note" },
      { keys: ["⌘", "T"],          description: "Open today's daily note" },
      { keys: ["⌘", "Y"],          description: "Open yesterday's daily note" },
      { keys: ["⌘", "⇧", "T"],     description: "Open tomorrow's daily note" },
      { keys: ["⌘", "K"],          description: "Command palette / search" },
    ],
  },
  {
    label: "Panels",
    shortcuts: [
      { keys: ["⌘", "⇧", "C"],     description: "Toggle calendar" },
      { keys: ["⌘", "⇧", "A"],     description: "Toggle AI assistant" },
      { keys: ["⌘", "⇧", "G"],     description: "Open graph view" },
      { keys: ["⌘", "⇧", "O"],     description: "Toggle table of contents" },
      { keys: ["⌘", ","],          description: "Settings" },
      { keys: ["⌘", "S"],          description: "Force save" },
      { keys: ["?"],               description: "Show shortcuts" },
    ],
  },
  {
    label: "Editing",
    shortcuts: [
      { keys: ["⌘", "B"],          description: "Bold" },
      { keys: ["⌘", "I"],          description: "Italic" },
      { keys: ["⌘", "Enter"],      description: "Toggle task done/open" },
      { keys: ["⌘", "⇧", "Space"], description: "Quick capture task" },
      { keys: ["Tab"],             description: "Indent list item" },
      { keys: ["⇧", "Tab"],        description: "Unindent list item" },
      { keys: ["⌘", "⇧", "Enter"], description: "Insert task below" },
      { keys: ["[["],              description: "Open wiki-link picker" },
      { keys: ["#"],               description: "Start tag" },
      { keys: ["@"],               description: "Mention / schedule" },
    ],
  },
  {
    label: "Tasks",
    shortcuts: [
      { keys: ["⌘", "⇧", "E"],     description: "Close the day" },
      { keys: ["⌘", "Enter"],      description: "Complete / uncomplete task" },
      { keys: ["⌘", "⇧", "Space"], description: "Capture task with natural language" },
      { keys: ["⌘", "⇧", "Enter"], description: "Move task to today" },
    ],
  },
  {
    label: "Views",
    shortcuts: [
      { keys: ["⌘", "1"],          description: "Smart view: Today" },
      { keys: ["⌘", "2"],          description: "Smart view: Overdue" },
      { keys: ["⌘", "3"],          description: "Smart view: Upcoming" },
    ],
  },
];

export function ShortcutsPanel({ onClose }: { onClose: () => void }) {
  return (
    <div className="shortcuts-panel">
      <div className="shortcuts-header">
        <span>Keyboard Shortcuts</span>
        <button onClick={onClose}><X size={14} strokeWidth={2} /></button>
      </div>
      <div className="shortcuts-body">
        {GROUPS.map((group) => (
          <div key={group.label} className="shortcuts-group">
            <div className="shortcuts-group-label">{group.label}</div>
            {group.shortcuts.map((s, i) => (
              <div key={i} className="shortcuts-row">
                <span className="shortcuts-keys">
                  {s.keys.map((k, ki) => (
                    <React.Fragment key={ki}>
                      <kbd>{k}</kbd>
                      {ki < s.keys.length - 1 && (
                        <span className="shortcuts-plus">+</span>
                      )}
                    </React.Fragment>
                  ))}
                </span>
                <span className="shortcuts-desc">{s.description}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

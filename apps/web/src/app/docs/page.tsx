export default function DocsPage() {
  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: "60px 24px", lineHeight: 1.7 }}>
      <a href="/" style={{ color: "var(--color-accent)", textDecoration: "none", fontSize: 13 }}>
        ← Back
      </a>
      <h1 style={{ fontSize: 32, fontWeight: 800, marginTop: 24, marginBottom: 8 }}>Documentation</h1>
      <p style={{ color: "var(--color-text-muted)", marginBottom: 40 }}>
        Everything you need to get started with Manager. See the <a href="https://github.com/sgwork004-max/manager/blob/main/INSTALL.md">Mac install instructions</a> for the current release.
      </p>

      {SECTIONS.map((s) => (
        <section key={s.title} style={{ marginBottom: 40 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12, color: "var(--color-text)" }}>
            {s.title}
          </h2>
          <div style={{ color: "var(--color-text-muted)", fontSize: 14 }}>
            {s.content.map((line, i) => (
              <p key={i} style={{ marginBottom: 8 }}>{line}</p>
            ))}
          </div>
        </section>
      ))}
    </main>
  );
}

const SECTIONS = [
  {
    title: "Getting Started",
    content: [
      "Download the Mac release and follow the scoped terminal install step. On first launch, your vault is created at ~/Manager/.",
      "Open today's daily note with ⌘T. Write your tasks as markdown checkboxes: - [ ] Task text.",
      "Press ⌘K to open the command palette and search your notes or run commands.",
    ],
  },
  {
    title: "Task Syntax",
    content: [
      "- [ ] Open task",
      "- [x] Completed task @done(2025-06-14)",
      "- [-] Cancelled task",
      "- [>] Scheduled task",
      "Add scheduling with >YYYY-MM-DD, due dates with @due(date), and recurrence with @repeat(1 week).",
    ],
  },
  {
    title: "Wiki-Links",
    content: [
      "Type [[Note Title]] to link to any note in your vault. Click the link to navigate there.",
      "If the linked note doesn't exist, Manager creates it automatically.",
      "The Backlinks panel (⌘⇧B) shows all notes that link to the current note.",
    ],
  },
  {
    title: "iCloud Sync",
    content: [
      "Go to Settings (⌘,) and click 'iCloud Drive' to move your vault to iCloud.",
      "iCloud Drive can sync the Markdown folder between Macs using the same Apple account. Keep a separate backup of important notes.",
      "Manager watches your vault for external changes and shows a conflict dialog if a note was edited on another device.",
    ],
  },
  {
    title: "AI Assistant",
    content: [
      "Press ⌘⇧A to open the AI panel. Activate Manager AI or enter a personal Gemini key in Settings first.",
      "Use Quick Actions: Summarize, Extract Tasks, Continue Writing, Improve, or Ask Key Questions.",
      "Click '↳ Insert into note' to append the AI response directly to your current note.",
    ],
  },
  {
    title: "Keyboard Shortcuts",
    content: [
      "⌘T — Today's note  |  ⌘K — Command palette  |  ⌘N — New note",
      "⌘← / ⌘→ — Navigate days  |  ⌘1/2/3 — Today / Overdue / Upcoming",
      "⌘⇧A — AI panel  |  ⌘⇧G — Graph view  |  ⌘, — Settings",
      "? — Show all shortcuts",
    ],
  },
];

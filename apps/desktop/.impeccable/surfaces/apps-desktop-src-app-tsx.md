---
version: 1
slug: "apps-desktop-src-app-tsx"
primary_target: "apps/desktop/src/App.tsx"
related_targets: []
---

# Surface brief: DayMark desktop app (today's page and app shell)

Mode: Operate. The user runs their day from this screen many times a day, morning to evening, at a Mac.

Scope: the whole desktop app shell (toolbar, sidebar, today's page, priority cards, quick add, notes, calendar panel, status bar) plus settings, onboarding and modals, light and dark.

Approved reference: `.impeccable/mocks/directions/fieldday.html` (light and dark). Earlier rounds kept for context: `index.html` (five directions) and `blends.html` (four blends; "C Field Day" was chosen, then rebuilt with a quiet background and fuller app controls).

## Direction contract

THESIS: Today is a page you work from, not a document you scroll. DayMark refuses the category default of one long Markdown note under a generic sidebar; the day's date is a physical card, priorities are four labelled cards with a headline lead, and the schedule sits in the margin at true length.

OWN-WORLD: Quiet warm off-white page (#FBFAF8) on a slightly darker chrome (#EFEEEA), white raised cards with a 3px priority-colored top edge, ink #24262A, one teal-blue accent (#2E6F8E) for selection, links and focus. Priority hues P1 brick #C2412D, P2 ochre #C48A1C, P3 teal-blue, Misc gray. Slab serif (Zilla Slab) only for the date numeral, the weekday heading and P1 lead tasks; system UI font everywhere else; JetBrains Mono for numbers, labels and times. Dark theme inverts the date card and lifts the accent (#6FAFCB). Icons from lucide only.

STORY: The user sees the date and how full the day is at a glance, adds tasks in natural language from the quick-add bar, works through P1 to Misc, checks the schedule in the margin, and closes the day.

FIRST VIEWPORT: 52px toolbar (traffic lights, sidebar toggle, day navigation with Today button, Day/Week/Month segmented control, search with ⌘K, AI, calendar toggle, primary New button). 220px sidebar with icons and counts. Center page: dark date card (month, numeral, day of year) beside the Zilla Slab weekday, summary line and progress strip, Plan day and Close day buttons top right; quick-add bar; 2×2 priority cards; notes card filling the rest. 288px right panel: mini month calendar, then the schedule with a now line. 26px status bar with save state.

FORM: Blend of grounded candidates 3 (The Morning Edition: headline hierarchy, day number, true-length schedule) and 1 (The Daily Planner Page: date block, paper, hour margin), chosen by the user from rendered mockups. Seed key 7704f823.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Unresolved

- App icon (next step).
- Whether the editor body stays raw Markdown with dimmed marks inside the notes card, or the whole day note renders as cards (current app edits one Markdown file; cards must map back to that file).

# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

A macOS desktop app built with Tauri 2, React and a WebKit webview (`apps/desktop`), plus a Next.js marketing and docs site (`apps/web`). The interface is web technology but must behave like a native Mac app: native menu bar, window chrome with overlay title bar, system dialogs, Keychain, and Apple Calendar.

## Users

Three groups, none primary:

- Busy professionals who plan the workday around meetings and tasks and want one page per day instead of several apps.
- Thinkers and writers (students, researchers, writers) who journal, keep notes and link ideas.
- People who like NotePlan's daily-note model but want something open and local.

All of them sit at a Mac, at the start, middle and end of a working day.

## Product Purpose

DayMark puts your day on one page. Each day gets a Markdown note that holds the day's priorities, tasks and calendar, with a morning plan and an evening close that carry unfinished work forward. Success: people open DayMark first thing, run the day from today's page, and close it at night.

## Positioning

Your day on one page. Daily note, native tasks and Apple Calendar live together, with plan and close rituals built in. Obsidian makes you assemble this from plugins; Notion is a database. DayMark is free, open source and stores plain Markdown on your disk.

## Operating Context

- Morning: open today's page, set P1/P2/P3/Misc priorities, pull in yesterday's unfinished work.
- During the day: capture tasks with natural-language dates, schedule and complete them, glance at the calendar beside the note.
- Evening: "Close the day" review, then roll unfinished work into tomorrow.
- Weekly, monthly, quarterly and yearly notes; regular notes linked with [[wiki links]], #tags and @mentions; graph view.
- Optional: Apple Calendar, macOS reminders, voice dictation, AI assistant with the user's own Gemini key.

## Capabilities and Constraints

- Notes are plain Markdown files in a user-chosen vault folder (local or iCloud Drive). The vault is the source of truth.
- Native file access is confined to the vault and user-approved import folders.
- Import from Obsidian, Evernote (.enex) and Craft.
- Mac only; macOS 13 or newer. The mobile app in `apps/mobile` is experimental and not part of the product.
- Not Apple-notarized yet: installation needs a terminal step.
- Terminology: "today's page" / daily note, "vault", "Close the day", priorities P1, P2, P3, Misc.

## Brand Commitments

- Name: **DayMark** (written with a capital M). Chosen 2026-10-22, replacing "Manager". Internal identifiers keep the existing `daymark` spelling (bundle id `co.daymark.desktop`, `@daymark/*` packages, `~/.daymark`).
- Feel: calm and paper-like.
- Icons come from one drawn family (currently lucide-react); never emoji or text symbols as icons.
- Free and open source under the MIT License. No paid tier is planned; do not imply one.
- Not affiliated with NotePlan, Apple or Google.

## Evidence on Hand

- Working app and source in this repository; the v0.6.0 release on GitHub (as "Manager").
- No testimonials, user counts, press or benchmarks exist. Do not invent any.

## Product Principles

1. The day is the unit. Every feature should help someone plan, run or close a day on one page.
2. The files are the user's. Plain Markdown in their folder, readable without DayMark.
3. Calm over clever. The page should feel quiet enough to think on.
4. Native where it counts. Menus, shortcuts, dialogs and system integrations behave like a Mac app.
5. Nothing hidden. AI and integrations run only when the user invokes or enables them.

# Changelog

## 0.6.1 - Vault access and editor update

- Preserve file watcher events for vaults opened through a symlink.

- Native file commands now only read and write inside the active vault. Paths with `..` and symlinks that leave the vault are refused.
- A vault folder is chosen with a native folder dialog. The path field in Settings is no longer editable.
- Added the missing Tauri permissions for note deletion confirmations, notifications and file-change events.
- Import folders are chosen through a native dialog and are read-only.
- Removed the Todoist integration and hosted Manager AI. The AI assistant now uses your own Gemini API key.
- Removed unused file-system, shell, plugin and MCP server code.
- Added a native menu bar with Settings, New Note, Import, navigation, panels and Help links.
- Editing a note's first heading now renames the note when you leave it.
- The editor now uses the font chosen in Settings instead of always showing monospace.
- Obsidian imports keep YAML frontmatter at the top and no longer duplicate the title.
- Graph links are visible in dark themes, and the graph header no longer sits under the window buttons.
- Settings shows which storage location is active and no longer promises iPhone sync.
- AI quick actions are disabled until a Gemini key is added.
- Markdown headings no longer render underlined, and heading and list marks are dimmed.
- Empty agenda tasks show an "Add a task" hint instead of bare brackets.
- New daily notes no longer include an "AI Pipeline" section.
- Replaced remaining text symbols used as icons with drawn icons, and raised hint text contrast.

## 0.6.0 - Public release

- Prepared the Mac app for an MIT-licensed public release.
- Replaced personal Todoist project defaults with the connected account's projects.
- Kept the last loaded Todoist view visible during temporary service errors.
- Scheduled quick-capture reminders after the new task is saved.
- Removed unsupported plugin, MCP, and mobile claims from public documentation.
- Added release checks for Rust tests and the website, plus an ad hoc signed Mac release workflow and scoped install instructions.

## 0.5.0 - Native tasks and Manager identity

- Renamed the visible product and macOS application to Manager.
- Made local Markdown tasks the primary daily task workspace.
- Added task project grouping, today plus overdue, upcoming and all-task views.
- Added native scheduling, deadlines, reminders and macOS notifications.
- Kept Todoist available as an optional secondary integration.

## 0.4.0 - Private beta readiness

- Added a focused three-step first-run setup.
- Added local crash reports and privacy-safe diagnostic exports.
- Added a repeatable macOS signing, notarization, and draft-release workflow.
- Added private beta terms and a product privacy statement.
- Added hardened-runtime and entitlement configuration for release builds.

## 0.3.0 - Execution memory

- Added execution memory to morning planning.
- Surfaces the latest daily handoff, recent learnings, and repeatedly carried work.
- Lets remembered context become one of today's outcomes in one click.

## 0.2.0 - Daily execution loop

- Added a focused morning planning ritual with three daily outcomes.
- Added one-click carryover of unfinished tasks from yesterday.
- Added an end-of-day review and controlled rollover into tomorrow.
- Added Plan and Close commands with keyboard shortcuts.
- Made the Todoist panel optional when no account is connected.
- Fixed repeated development signing that could cause unnecessary CPU load.

## 0.1.0 - Private beta foundation

- Introduced the temporary Daymark product identity.
- Moved integration credentials to macOS Keychain.
- Added migration support for existing settings and vaults.
- Disabled automatic MCP server startup.
- Added core task and daily-template tests.

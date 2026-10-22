# Manager architecture and growth path

## Current release boundary

The Mac app owns the user's Markdown vault. `packages/core` parses notes and tasks. Tauri commands bridge the React interface to local files, macOS Calendar, Keychain, notifications, and the optional Gemini assistant. The vault is the source of truth, and no hosted service is required.

Native file commands only accept paths inside the active vault (`src-tauri/src/commands/vault.rs`). A folder becomes the vault only from saved settings, the built-in local or iCloud locations, or a native folder dialog, so the webview cannot widen its own file access.

## Before serving a larger user base

1. Add an incremental local index for search and smart views. The current desktop store loads every note into renderer memory for these views. Keep Markdown as the durable format and rebuild the index from files after a crash or migration.
2. Treat sync as a separate product with explicit conflict and recovery rules. Do not promise mobile or cross-device parity until the Mac and mobile vaults demonstrably read and write the same data safely.
3. Version the file format and integration contracts. Preserve existing vaults, test migrations with fixtures, and support backup and export before adding automatic transformations.
4. Measure release health without uploading note content. Opt-in crash reporting, update adoption, and integration error rates are useful only with a clear privacy choice.

## Commercial boundary

The MIT app can remain free and useful. Potential paid offerings are hosted AI, managed sync after it is reliable, and support for teams. Do not gate local notes behind a licence check in the open source client. Validate demand before adding billing or account infrastructure.

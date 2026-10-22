# DayMark

DayMark is a local Mac workspace for Markdown notes, daily planning, tasks, and Apple Calendar. Notes live in a folder you control. The desktop app is built with Tauri, React, and Rust.

For a packaged Mac build, see [INSTALL.md](INSTALL.md). The first release uses an ad hoc signature and a scoped terminal install step.

## Status

The latest [open source Mac release](https://github.com/sgwork004-max/DayMark/releases/tag/v0.6.1), 0.6.1, was published under the app's earlier name, Manager. The next release ships as DayMark. The mobile app in `apps/mobile` is experimental source code and is not part of the supported release.

## Development

Requirements: macOS 13 or newer, Node.js 22, pnpm 11.6.0, Rust, and Xcode command line tools.

```sh
pnpm install --frozen-lockfile
pnpm --filter @daymark/core test
pnpm --filter @daymark/desktop typecheck
pnpm --filter @daymark/desktop vite:build
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml
pnpm --filter @daymark/desktop dev
```

The desktop source is in `apps/desktop`, reusable note and task logic is in `packages/core`. Build a macOS app with `pnpm --filter @daymark/desktop build`.

## Data and optional services

DayMark stores notes as Markdown files in the selected vault. Apple Calendar access, voice dictation, and the AI assistant are optional. The assistant uses your own Google Gemini API key and sends the active note only when you invoke it. See [PRIVACY.md](PRIVACY.md) for details.

## Licence

The source code is available under the [MIT License](LICENSE). Hosted services, provider accounts, and third-party trademarks are separate from that licence. DayMark is not affiliated with NotePlan, Apple, or Google.

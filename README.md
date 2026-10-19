# Manager

Manager is a local Mac workspace for Markdown notes, daily planning, tasks, and Apple Calendar. Notes live in a folder you control. The desktop app is built with Tauri, React, and Rust.

For a packaged Mac build, see [INSTALL.md](INSTALL.md). The first release uses an ad hoc signature and a scoped terminal install step.

## Status

The Mac app is being prepared for its first public open source release. Mobile, plugins, and the MCP server are experimental source code and are not part of the supported release. Manager AI and Todoist are optional integrations.

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

The desktop source is in `apps/desktop`, reusable note and task logic is in `packages/core`, and the optional hosted AI service is in `apps/ai-gateway`. Build a macOS app with `pnpm --filter @daymark/desktop build`.

## Data and optional services

Manager stores notes as Markdown files in the selected vault. Apple Calendar access, Todoist, voice dictation, and AI are optional. AI sends the active note context to the configured provider only when you invoke an AI action. See [PRIVACY.md](PRIVACY.md) for details.

## Licence

The source code is available under the [MIT License](LICENSE). Hosted services, provider accounts, and third-party trademarks are separate from that licence. Manager is not affiliated with NotePlan, Todoist, Apple, or Google.

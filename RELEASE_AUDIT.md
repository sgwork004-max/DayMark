# Release audit, October 19, 2026

## Checked

- The installed 0.5.2 Mac app opened a daily note and calendar. Its Todoist pane returned an HTTP 502 response and displayed project lanes tied to the developer's account. The release source now uses the connected account's project list, keeps the last loaded boards during a temporary service failure, and starts with native tasks when Todoist is not configured.
- In the packaged 0.6.0 app, a disposable vault created a daily note and a separate note, saved a scheduled native task, and retained the note and task after restart. The test used an isolated home directory and did not touch the existing vault.
- Core tests: 19 passed. Rust tests: 4 passed. Desktop, web, and AI gateway TypeScript checks passed. Desktop and web production frontend builds passed. These checks exercise code paths and compilation; they do not prove every integration works with a live account.
- The website's download link and claims about mobile sync, plugins, and hosted AI were ahead of the product. The copy now describes the Mac app and optional integrations, and no longer sends visitors to a generic GitHub page.
- GitHub verification passed on the final release source. The public `v0.6.0` release built Apple Silicon and Intel DMGs; downloaded assets matched their published SHA-256 digests, and the Apple Silicon app signature and version were verified inside its disk image.
- MIT licensing, contribution guidance, privacy and security information, CI, and a release checklist are present. Local Cloudflare state and release artifacts are excluded from the public source tree.

## Remaining validation and hardening

1. Complete the remaining disposable-vault and integration checks in [RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md), then verify the packaged app on another Mac.
2. Test [INSTALL.md](INSTALL.md) on a second, clean Mac. This release requires a scoped terminal step because it is not Apple notarized.
3. Restrict native file commands to the selected vault and explicitly approved import or export paths. The current webview can pass arbitrary paths to several Rust commands; narrow that boundary before accepting untrusted content or enabling plugins.
4. Add request limits and abuse controls before offering the optional hosted AI gateway to customers. The gateway is source code, not an operated service.

## Architecture for growth

Keep Markdown in the user's vault as the durable source of truth. Add a rebuildable local index before adding large-vault search features. Treat sync and the hosted AI gateway as separate services with their own reliability, privacy, and billing boundaries. See [ARCHITECTURE.md](ARCHITECTURE.md).

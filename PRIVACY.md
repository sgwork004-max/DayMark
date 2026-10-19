# Manager Privacy

Last updated: October 19, 2026

Manager stores notes as Markdown files in the folder selected by the user. Manager does not operate an analytics or telemetry service.

Integration credentials are stored in macOS Keychain. When a user enables an integration, relevant requests are sent to that provider. This currently includes Apple Calendar, Todoist, and Google Gemini. Manager AI sends user-invoked prompts through the optional hosted gateway to Google Gemini. Those providers process data under their own privacy terms.

Crash reports and diagnostics are stored locally in `~/.daymark`. Diagnostic reports contain app, operating system, vault-path, and health information. They do not include note contents.

Users can remove Manager data by deleting the selected vault, `~/.daymark`, and Manager entries from macOS Keychain.

Manager AI's gateway stores activation, device, and usage records but does not store note text. The source code does not include a payment system.

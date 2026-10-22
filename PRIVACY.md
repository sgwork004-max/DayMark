# Manager Privacy

Last updated: October 19, 2026

Manager stores notes as Markdown files in the folder selected by the user. Manager does not operate an analytics or telemetry service.

Apple Calendar data is read and written through macOS on your Mac. If you add a Google Gemini API key, it is stored in macOS Keychain, and the active note is sent to Google Gemini only when you use the AI assistant. Google processes that data under its own privacy terms. Voice dictation uses Apple's speech recognition.

Crash reports and diagnostics are stored locally in `~/.daymark`. Diagnostic reports contain app, operating system, vault-path, and health information. They do not include note contents.

Users can remove Manager data by deleting the selected vault, `~/.daymark`, and Manager entries from macOS Keychain.

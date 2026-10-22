# Security

Report vulnerabilities privately through [GitHub private vulnerability reporting](https://github.com/sgwork004-max/DayMark/security/advisories/new). Do not open a public issue.

Include reproduction steps and the affected version. Never include real API keys, access tokens, or private note contents in a report.

## Supported versions

Only the latest release receives security fixes.

## Data handling

Integration credentials are stored in macOS Keychain. Notes remain in the user-selected local or iCloud Drive vault, and the app's native file commands only read and write inside that vault. The optional AI gateway uses a separate activation token and does not store note text.

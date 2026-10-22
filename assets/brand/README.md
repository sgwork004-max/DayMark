# DayMark brand assets

- `daymark-icon.svg`: master app icon ("Card Slices"), 1024 × 1024 on the macOS icon grid.
- `daymark-icon-1024.png`: rendered master.

Regenerate the app icon set after editing the master:

```sh
apps/desktop/node_modules/.bin/tauri icon assets/brand/daymark-icon-1024.png -o apps/desktop/src-tauri/icons
```

Then remove the Android, iOS and Windows files it adds; DayMark ships for macOS only.

#!/bin/sh
set -eu

if [ "$#" -ne 1 ] || [ ! -f "$1" ]; then
  echo "Usage: sh install-macos.sh /path/to/DayMark.dmg" >&2
  exit 2
fi

dmg_path=$1
mount_point=$(mktemp -d /private/tmp/daymark-install.XXXXXX)
mounted=0
cleanup() {
  if [ "$mounted" -eq 1 ]; then
    hdiutil detach "$mount_point" -quiet || true
  fi
  rmdir "$mount_point" 2>/dev/null || true
}
trap cleanup EXIT HUP INT TERM

hdiutil attach "$dmg_path" -readonly -nobrowse -mountpoint "$mount_point" -quiet
mounted=1
# Releases before 0.7.0 were named Manager.
app_name=""
for candidate in DayMark Manager; do
  if [ -d "$mount_point/$candidate.app" ]; then
    app_name=$candidate
    break
  fi
done
if [ -z "$app_name" ]; then
  echo "The disk image does not contain DayMark.app." >&2
  exit 1
fi
source_app="$mount_point/$app_name.app"
codesign --verify --deep --strict "$source_app"

destination="/Applications/$app_name.app"
if [ -e "$destination" ]; then
  backup="/Applications/$app_name.backup.$(date +%Y%m%d-%H%M%S).app"
  sudo mv "$destination" "$backup"
  echo "Previous version saved at $backup"
fi
sudo ditto "$source_app" "$destination"
sudo xattr -dr com.apple.quarantine "$destination"
open "$destination"
echo "$app_name installed in /Applications."
if [ "$app_name" = DayMark ] && [ -d /Applications/Manager.app ]; then
  echo "The previous app, Manager.app, is still in /Applications. Your notes are unaffected; you can move it to the Trash."
fi

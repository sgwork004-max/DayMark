#!/bin/sh
set -eu

if [ "$#" -ne 1 ] || [ ! -f "$1" ]; then
  echo "Usage: sh install-macos.sh /path/to/Manager.dmg" >&2
  exit 2
fi

dmg_path=$1
mount_point=$(mktemp -d /private/tmp/manager-install.XXXXXX)
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
source_app="$mount_point/Manager.app"
if [ ! -d "$source_app" ]; then
  echo "The disk image does not contain Manager.app." >&2
  exit 1
fi
codesign --verify --deep --strict "$source_app"

destination=/Applications/Manager.app
if [ -e "$destination" ]; then
  backup="/Applications/Manager.backup.$(date +%Y%m%d-%H%M%S).app"
  sudo mv "$destination" "$backup"
  echo "Previous version saved at $backup"
fi
sudo ditto "$source_app" "$destination"
sudo xattr -dr com.apple.quarantine "$destination"
open "$destination"
echo "Manager installed in /Applications."

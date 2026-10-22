#!/bin/sh
set -eu

version=0.6.1
# 0.6.x releases were published under the earlier name, Manager.
app_name=Manager
case "$(uname -m)" in
  arm64)
    asset="${app_name}_${version}_aarch64.dmg"
    ;;
  x86_64)
    asset="${app_name}_${version}_x64.dmg"
    ;;
  *)
    echo "DayMark supports Apple Silicon and Intel Macs." >&2
    exit 1
    ;;
esac

work_dir=$(mktemp -d "${TMPDIR:-/private/tmp}/daymark-install.XXXXXX")
cleanup() { rm -rf "$work_dir"; }
trap cleanup EXIT HUP INT TERM

release_url="https://github.com/sgwork004-max/DayMark/releases/download/v${version}/${asset}"
checksums_url="https://github.com/sgwork004-max/DayMark/releases/download/v${version}/SHA256SUMS"
installer_url="https://raw.githubusercontent.com/sgwork004-max/DayMark/v${version}/tools/install-macos.sh"
curl --fail --location --silent --show-error "$checksums_url" -o "$work_dir/SHA256SUMS"
expected_sha256=$(awk -v asset="$asset" '$2 == asset { print $1 }' "$work_dir/SHA256SUMS")
if ! printf '%s' "$expected_sha256" | grep -Eq '^[[:xdigit:]]{64}$'; then
  echo "DayMark release has no valid checksum for $asset." >&2
  exit 1
fi
curl --fail --location --silent --show-error "$release_url" -o "$work_dir/$asset"
actual_sha256=$(shasum -a 256 "$work_dir/$asset" | awk '{ print $1 }')
if [ "$actual_sha256" != "$expected_sha256" ]; then
  echo "DayMark download checksum did not match the published release." >&2
  exit 1
fi
printf 'Verified %s SHA-256.\n' "$asset"
if [ "${DAYMARK_VERIFY_ONLY:-${MANAGER_VERIFY_ONLY:-0}}" = 1 ]; then
  exit 0
fi
curl --fail --location --silent --show-error "$installer_url" -o "$work_dir/install-macos.sh"
sh "$work_dir/install-macos.sh" "$work_dir/$asset"

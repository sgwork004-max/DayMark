#!/bin/sh
set -eu

version=0.6.0
case "$(uname -m)" in
  arm64)
    asset="Manager_${version}_aarch64.dmg"
    expected_sha256=6d3fe13a7fa40e0e0df86475c78a80e19bf1fd7ca5842896594a217bf8f0a254
    ;;
  x86_64)
    asset="Manager_${version}_x64.dmg"
    expected_sha256=dd544578eed0bfa9533ceb044d6273cab10a8ef1fd43d5f7fddcbd712f0954ee
    ;;
  *)
    echo "Manager supports Apple Silicon and Intel Macs." >&2
    exit 1
    ;;
esac

work_dir=$(mktemp -d "${TMPDIR:-/private/tmp}/manager-install.XXXXXX")
cleanup() { rm -rf "$work_dir"; }
trap cleanup EXIT HUP INT TERM

release_url="https://github.com/sgwork004-max/manager/releases/download/v${version}/${asset}"
installer_url="https://raw.githubusercontent.com/sgwork004-max/manager/v${version}/tools/install-macos.sh"
curl --fail --location --silent --show-error "$release_url" -o "$work_dir/$asset"
actual_sha256=$(shasum -a 256 "$work_dir/$asset" | awk '{ print $1 }')
if [ "$actual_sha256" != "$expected_sha256" ]; then
  echo "Manager download checksum did not match the published release." >&2
  exit 1
fi
printf 'Verified %s SHA-256.\n' "$asset"
if [ "${MANAGER_VERIFY_ONLY:-0}" = 1 ]; then
  exit 0
fi
curl --fail --location --silent --show-error "$installer_url" -o "$work_dir/install-macos.sh"
sh "$work_dir/install-macos.sh" "$work_dir/$asset"

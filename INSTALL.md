# Install DayMark on macOS

The latest release, 0.6.1, was published under the app's earlier name, Manager: the download is `Manager_0.6.1_*.dmg` and installs `Manager.app`. Releases from 0.7.0 onward are named DayMark.

The release is ad hoc signed and is not Apple notarized. Its installer removes quarantine only from the copied app. It does not change macOS security settings for any other software.

## One command for 0.6.1

Paste this into Terminal. It downloads the DMG for your Mac, checks its SHA-256 against the verified release digest, verifies the app signature, backs up an existing copy, installs into `/Applications`, and removes quarantine only from that app:

```sh
curl -fsSL https://raw.githubusercontent.com/sgwork004-max/DayMark/main/tools/install-release-macos.sh -o /tmp/install-daymark.sh && sh /tmp/install-daymark.sh
```

You can [inspect the installer source](tools/install-release-macos.sh) before running it. macOS may ask for your administrator password.

## Manual install

1. Download the DMG for your Mac from this repository's GitHub release. Confirm the asset comes from `sgwork004-max/DayMark` and inspect its SHA-256 digest on the release page.
2. Download or clone this repository, then run:

   ```sh
   sh tools/install-macos.sh "$HOME/Downloads/NAME-OF-DOWNLOADED-FILE.dmg"
   ```

Replace the DMG name with the file you downloaded. The script verifies the app's code signature, backs up any existing copy in `/Applications`, copies the new app, removes quarantine from that app, and opens it. macOS may ask for your administrator password to write to Applications.

If you prefer to install by dragging the app from the DMG into Applications, you can remove quarantine from that app afterward with:

```sh
sudo xattr -dr com.apple.quarantine /Applications/Manager.app
open /Applications/Manager.app
```

For 0.7.0 and later, use `DayMark.app` in those commands.

Only run the quarantine command for a release you have chosen to trust. The source is available in this repository for review.

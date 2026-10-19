# Install Manager on macOS

Manager 0.6.0 is ad hoc signed and is not Apple notarized. Its installer removes quarantine only from the copied Manager app. It does not change macOS security settings for any other software.

1. Download the DMG for your Mac from this repository's GitHub release. Confirm the asset comes from `sgwork004-max/manager` and inspect its SHA-256 digest on the release page.
2. Download or clone this repository, then run:

   ```sh
   sh tools/install-macos.sh "$HOME/Downloads/NAME-OF-DOWNLOADED-MANAGER.dmg"
   ```

Replace the DMG name with the file you downloaded. The script verifies the app's code signature, backs up any existing `/Applications/Manager.app`, copies the new app, removes quarantine from that app, and opens it. macOS may ask for your administrator password to write to Applications.

If you prefer to install by dragging `Manager.app` from the DMG into Applications, you can remove quarantine from that app afterward with:

```sh
sudo xattr -dr com.apple.quarantine /Applications/Manager.app
open /Applications/Manager.app
```

Only run the quarantine command for a release you have chosen to trust. The source is available in this repository for review.

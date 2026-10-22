# Public release checklist

This checklist records what has been verified for the public Mac release and what remains for broader distribution. A local build is not a public release.

- [x] Verify the GitHub repository belongs to `sgwork004-max` and its visibility is public.
- [ ] Review all source and assets for secrets, private vault data, and third-party rights.
- [x] Restrict native file operations to the selected vault and approved import/export paths; test traversal and symlink cases.
- [x] Run core tests, desktop and web typechecks, Rust tests, and production frontend builds from the release commit.
- [ ] Exercise a disposable vault: onboarding, new note, edit, restart, search, task completion, reminder permission, import, recovery, and export.
- [ ] Exercise Calendar and Gemini paths with permission denied, service outage, and working account states.
- [ ] Verify the ad hoc signed DMG and the scoped terminal install command on a clean Mac. Confirm users can see that this release is not Apple notarized.
- [x] Publish the tagged macOS app and DMG through GitHub Releases, then download and verify checksums.
- [ ] Set `NEXT_PUBLIC_MANAGER_RELEASE_URL` to the verified release URL and publish the website. Check the download button and docs from the live URL.
- [ ] Enable private vulnerability reporting and provide a support contact on the public repository.

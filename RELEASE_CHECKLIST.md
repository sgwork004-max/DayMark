# Public release checklist

This checklist applies to the first public Mac release. A local build is not a public release.

- [ ] Verify the GitHub repository belongs to `sgwork004-max` and its visibility is public.
- [ ] Review all source and assets for secrets, private vault data, and third-party rights.
- [ ] Restrict native file operations to the selected vault and approved import/export paths; test traversal and symlink cases.
- [ ] Run core tests, desktop and web typechecks, Rust tests, and production frontend builds from the release commit.
- [ ] Exercise a disposable vault: onboarding, new note, edit, restart, search, task completion, reminder permission, import, recovery, and export.
- [ ] Exercise optional Todoist and Calendar paths with permission denied, service outage, and working account states.
- [ ] Verify the ad hoc signed DMG and the scoped terminal install command on a clean Mac. Confirm users can see that this release is not Apple notarized.
- [ ] Publish the tagged macOS app and DMG through GitHub Releases, then download and verify checksums.
- [ ] Set `NEXT_PUBLIC_MANAGER_RELEASE_URL` to the verified release URL and publish the website. Check the download button and docs from the live URL.
- [ ] Enable private vulnerability reporting and provide a support contact on the public repository.

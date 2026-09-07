# Changelog

All notable changes to this project should be documented in this file.

## [Unreleased]

### Added

- Added repository guidance to keep `README.md`, `AGENTS.md`, and `CHANGELOG.md` maintained.
- Added a committed README demo GIF workflow driven by Playwright screenshots and a repo-local `docs/demo.gif` asset.
- Restructured `docs/` into a Diátaxis + journal taxonomy (`explanation/`, `how-to/`, `reference/`, `conventions/`, `journal/`) with an enforced routing rule, and added `scripts/check_docs.py` as a pre-commit and CI gate.
- Versioned PocketBase migrations (`pocketbase/pb_migrations/`) and baked them into the PocketBase Docker image, so the schema applies automatically in dev and production instead of requiring manual admin-UI setup.
- Added a header badge showing live "Importing... (X/Y)" progress while a backup import is running, since rate-limit retries can make a large import take a while with no other visible feedback. The import control is disabled for the duration.
- Promoted artists to a first-class PocketBase record (`artists` collection) referenced from `favorites` by an `artistIds` relation, so a mix's artist field, the grid's artist filter, and the search box resolve by identity instead of exact-string name matching. Importing a JSON backup resolves each artist name to an existing artist or creates one, collapsing spelling variants within the file into a single artist named by the most frequent spelling.

### Fixed

- Preserved each favorite's original creation date when importing a JSON backup while signed in with cloud sync, instead of overwriting it with the import time. Added a required `created_at` field to the `favorites` PocketBase collection to carry this date, distinct from the auto-managed `created`/`updated` audit timestamps.
- Upgraded the Playwright lockfile resolution to fix GitHub Actions failures while installing Playwright browsers.
- Removed favorites grid enter/move/leave animations to avoid iPhone crashes and reload loops when filtering or searching large lists.
- Added progressive rendering (batches of 20) and lazy image loading to prevent iPhone crash with 120+ favorites during search/filter.
- Upgraded the PocketBase JavaScript SDK to `0.27.0` and the Docker-pinned PocketBase server to `v0.39.4`.
- Upgraded the Docker-pinned PocketBase server to `v0.40.2` and removed the duplicated `PB_VERSION` override in `docker-compose.yml` so the Dockerfile stays the single source of truth.
- Restricted GitHub Actions workflows to explicit read-only repository permissions.
- Hardened SoundCloud URL detection so lookalike hosts are no longer treated as trusted SoundCloud links.
- Fixed an SSRF in the `/api/expand-soundcloud` PocketBase hook: the host check compared a string prefix instead of the parsed hostname, so a userinfo (`https://on.soundcloud.com@internal-host/...`) or subdomain-suffix (`https://on.soundcloud.com.attacker.test/`) URL could make the server fetch an arbitrary internal or external host.
- Fixed the app getting stuck on the loading spinner forever after a failed sign-in or bootstrap: `useAppStore`'s `bootstrap()` and `handleAuthenticatedSession()` now recover to the login screen (and clear any partial auth session) instead of leaving `status` stuck at `'booting'`.
- Fixed the `favorites` collection's `updateRule` allowing an authenticated user to reassign a favorite's `owner` to another user's ID via a crafted `PATCH` request, injecting the record into the victim's list and removing it from their own.
- Fixed cloud-mode backup imports silently dropping most favorites in production: the server's create-request rate limit rejected everything past the first burst, and those rejections were mislabeled as "already present" duplicates instead of surfacing as failures. Imports now pace and back off across the whole batch when rate-limited, and a real creation failure is reported as a distinct failed count.
- Fixed favorites added, edited, or deleted while signed in with cloud sync but the backend unavailable being silently lost on the next reconnect (the cloud list, which never saw those offline writes, would overwrite the offline cache). The authenticated offline fallback is now read-only: `useFavoritesStore` blocks writes while in `google-cache` mode and the UI shows an "Offline (Read-only)" badge with the add/edit/delete/import controls disabled.

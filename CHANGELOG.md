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
- Added an events destination: record a night you attended with its name, date and venue, plus the line-up you saw and one verdict per performance. An event and its whole line-up save or fail together -- in cloud mode as a single `/api/batch` transaction -- and deleting a night removes its performances through the database cascade. Backed by two new owner-scoped PocketBase collections (`events`, `performances`) whose create and update rules also correlate each submitted relation with the caller, and a settings migration enabling the batch endpoint.
- Gave the app navigation: three destinations (mixes, events, artists) on `vue-router` 4 with HTML5 history, plus an addressable page per artist keyed on their slug, so a performer's page can be linked, opened cold and reloaded on both deploy targets.
- Added an artist page showing both halves of what is known about a performer: the mixes crediting them with their moment counts, and the nights they were seen live led by the most recent _rated_ verdict. Every credited name on a mix card and on an event card links to it.
- Added an artists tab: a table of every performer credited by at least one mix or one night, sortable on each of its seven columns, reducing on a phone to the name plus the active column's value.
- **Breaking:** the backup file is now one versioned envelope, `{ "formatVersion": 1, "mixes": [...], "events": [...] }`, carrying both domains. An import reads the version first and refuses anything it does not recognize whole, rather than reading it partially. An export taken before this change is refused: bring it forward by wrapping the array under `"mixes"` and adding `"formatVersion": 1`. Import also became an app-level action available on every destination instead of a mixes-only one.

### Changed

- The account badge, the settings button and the logout button are now one account menu, with a status dot reporting whether the session is synced, read-only or importing.
- The search field, the date sort and the create button sit in the same row on all three tabs.
- The events tab can be read oldest-first.
- The phone header is two rows shorter.
- Fixed the events tab's controls row starting at the page edge while the cards below it stayed
  centred, so the search field and the first card now share a left edge as they do on the other tabs.
- Every control on that row — the search field, the sort and filter buttons, and the create button —
  is now the same height (44px), instead of three heights between 38px and 48px.

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

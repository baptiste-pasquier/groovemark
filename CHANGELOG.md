# Changelog

All notable changes to this project should be documented in this file.

## [Unreleased]

### Added

- Added repository guidance to keep `README.md`, `AGENTS.md`, and `CHANGELOG.md` maintained.
- Added a committed README demo GIF workflow driven by Playwright screenshots and a repo-local `docs/demo.gif` asset.
- Restructured `docs/` into a Diátaxis + journal taxonomy (`explanation/`, `how-to/`, `reference/`, `conventions/`, `journal/`) with an enforced routing rule, and added `scripts/check_docs.py` as a pre-commit and CI gate.
- Versioned PocketBase migrations (`pocketbase/pb_migrations/`) and baked them into the PocketBase Docker image, so the schema applies automatically in dev and production instead of requiring manual admin-UI setup.

### Fixed

- Upgraded the Playwright lockfile resolution to fix GitHub Actions failures while installing Playwright browsers.
- Removed favorites grid enter/move/leave animations to avoid iPhone crashes and reload loops when filtering or searching large lists.
- Added progressive rendering (batches of 20) and lazy image loading to prevent iPhone crash with 120+ favorites during search/filter.
- Upgraded the PocketBase JavaScript SDK to `0.27.0` and the Docker-pinned PocketBase server to `v0.39.4`.
- Upgraded the Docker-pinned PocketBase server to `v0.40.2` and removed the duplicated `PB_VERSION` override in `docker-compose.yml` so the Dockerfile stays the single source of truth.
- Restricted GitHub Actions workflows to explicit read-only repository permissions.
- Hardened SoundCloud URL detection so lookalike hosts are no longer treated as trusted SoundCloud links.

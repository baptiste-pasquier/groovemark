# Changelog

All notable changes to this project should be documented in this file.

## [Unreleased]

### Added

- Added repository guidance to keep `README.md`, `AGENTS.md`, and `CHANGELOG.md` maintained.

### Fixed

- Upgraded the Playwright lockfile resolution to fix GitHub Actions failures while installing Playwright browsers.
- Removed favorites grid enter/move/leave animations to avoid iPhone crashes and reload loops when filtering or searching large lists.
- Added progressive rendering (batches of 20) and lazy image loading to prevent iPhone crash with 120+ favorites during search/filter.
- Upgraded the PocketBase JavaScript SDK to `0.27.0` and the Docker-pinned PocketBase server to `v0.39.4`.
- Restricted GitHub Actions workflows to explicit read-only repository permissions.
- Hardened SoundCloud URL detection so lookalike hosts are no longer treated as trusted SoundCloud links.

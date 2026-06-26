# Changelog

All notable changes to this project should be documented in this file.

## [Unreleased]

### Added

- Added repository guidance to keep `README.md`, `AGENTS.md`, and `CHANGELOG.md` maintained.

### Fixed

- Upgraded the Playwright lockfile resolution to fix GitHub Actions failures while installing Playwright browsers.
- Removed favorites grid enter/move/leave animations to avoid iPhone crashes and reload loops when filtering or searching large lists.
- Added progressive rendering (batches of 20) and lazy image loading to prevent iPhone crash with 120+ favorites during search/filter.

# E2E Tests: Favorite Creation with SoundCloud & YouTube

**Date:** 2026-06-26
**Status:** Ready for planning

## Problem

The favorite creation flow — entering a URL, having metadata pre-filled from an external API, adding timestamps, and saving — has no E2E test coverage. Regressions in the add-favorite dialog, URL normalization, noembed.com integration, or the save-to-local-storage path can ship undetected.

## Desired Outcome

Two Playwright E2E tests (one YouTube, one SoundCloud) that exercise the full favorite creation round-trip in local mode, using real API calls, and verify that the favorite appears correctly in the grid after saving.

## Success Criteria

- Each test enters a URL, waits for metadata pre-fill, verifies title and artist fields are populated, adds at least one timestamp, saves, and confirms the favorite card appears in the favorites grid
- Tests hit the real noembed.com API (no mocking)
- Tests use stable, well-known public content URLs unlikely to be taken down
- SoundCloud tests use full URLs (`soundcloud.com/artist/track`), not short links (`on.soundcloud.com`) — short link expansion requires PocketBase
- Tests run in local mode, following the existing `e2e/vue.spec.ts` pattern (navigate to root, click "Continuer en mode local")
- Tests pass on CI (Playwright config already handles dev server startup, retries, and headless mode)

## Scope Boundaries

### Included

- YouTube favorite creation (full round-trip with timestamp)
- SoundCloud favorite creation (full round-trip with timestamp)
- Pre-fill verification (title, artist populated from noembed.com)
- Save and grid verification (favorite card visible with correct data)

### Excluded

- SoundCloud short link (`on.soundcloud.com`) testing — requires PocketBase
- Authenticated mode (Google auth) — local mode only
- Error/edge case scenarios (invalid URLs, API failures, duplicate detection)
- Edit or delete flows
- Mobile viewport testing

## Key Technical Context

- Metadata fetching uses `noembed.com/embed?url=...` (oEmbed aggregator), returning `title`, `author_name`, `thumbnail_url`
- Pre-fill triggers on URL input blur (`FavoriteModal.vue` `onUrlBlur`)
- Pre-fill only populates empty fields — title and artist won't overwrite existing values
- URL normalization: YouTube URLs become `youtube.com/watch?v={ID}`, SoundCloud URLs get query params stripped
- Type is auto-detected from URL (`youtube` or `soundcloud`)
- Favorites in local mode persist to `localStorage` under `groovemark:favorites:local`

## Assumptions

- noembed.com remains available and returns metadata for the chosen test URLs (CI retries mitigate transient failures)
- The chosen public content URLs remain online — URL selection should favor official/institutional uploads with long track records

## Outstanding Questions

- Which specific stable public URLs to use (to be decided at implementation time, validated against noembed.com)
- Whether to create a new test file (e.g., `e2e/favorite-creation.spec.ts`) or extend `e2e/vue.spec.ts` (planning decision)

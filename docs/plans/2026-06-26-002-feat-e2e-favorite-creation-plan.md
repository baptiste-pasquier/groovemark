---
title: 'feat: Add E2E tests for favorite creation with YouTube and SoundCloud'
date: 2026-06-26
type: feat
origin: docs/brainstorms/2026-06-26-e2e-favorite-creation-requirements.md
---

# feat: Add E2E tests for favorite creation with YouTube and SoundCloud

## Summary

Add Playwright E2E tests that exercise the full favorite creation round-trip — entering a URL, verifying metadata pre-fill from noembed.com, adding a timestamp, saving, and confirming the favorite card appears in the grid. Two tests: one for YouTube, one for SoundCloud. Both run in local mode with real API calls.

---

## Problem Frame

The add-favorite dialog is the core user flow and currently has zero E2E coverage. Regressions in URL normalization, noembed.com integration, timestamp handling, or the save-to-localStorage path can ship undetected. (see origin: `docs/brainstorms/2026-06-26-e2e-favorite-creation-requirements.md`)

---

## Requirements

- R1. Each test enters a URL, waits for metadata pre-fill, verifies title and artist fields are populated, adds a timestamp, saves, and confirms the favorite card appears in the favorites grid
- R2. Tests hit the real noembed.com API — no mocking or route interception
- R3. Tests use stable, well-known public content URLs validated against noembed.com
- R4. SoundCloud tests use full URLs only (short link expansion requires PocketBase)
- R5. Tests run in local mode following the existing E2E pattern
- R6. Tests pass on CI with the existing Playwright config (retries, headless, preview server)

---

## Key Technical Decisions

### KTD1. New test file rather than extending `e2e/vue.spec.ts`

The existing test is a basic smoke test (navigate, click local mode, check heading). The favorite creation tests are a distinct concern with their own setup and teardown. A dedicated `e2e/favorite-creation.spec.ts` keeps the test suite organized by feature domain.

### KTD2. Pre-validated URL fixtures with expected metadata

URLs are hardcoded as constants with their expected noembed.com response values (title, author_name). This makes assertions deterministic — the test knows exactly what title and artist to expect. URLs validated as of 2026-06-26:

| Provider   | URL                                                      | Expected title (contains) | Expected author   |
| ---------- | -------------------------------------------------------- | ------------------------- | ----------------- |
| YouTube    | `https://www.youtube.com/watch?v=dQw4w9WgXcQ`            | "Never Gonna Give You Up" | "Rick Astley"     |
| SoundCloud | `https://soundcloud.com/octobersveryown/drake-gods-plan` | "God's Plan"              | "octobersveryown" |

Assertions should use `toContain` / partial matching rather than exact equality — noembed titles can include suffixes like "(Official Video)" or "by Artist" that may change.

### KTD3. Shared local-mode navigation helper

Both tests need to navigate to `/`, click "Continuer en mode local", and wait for the main view. Extract this as a reusable helper function within the test file to avoid duplication with `e2e/vue.spec.ts`.

### KTD4. Increased timeout for noembed.com network calls

The default 5s `expect` timeout may be tight for real API calls, especially on CI. The metadata loading indicator (`metadataLoading`) disappears when the fetch completes — tests should wait for the title input to be populated (or loading indicator to disappear) with a generous timeout rather than relying on fixed waits.

---

## Scope Boundaries

### Included

- YouTube favorite creation: full round-trip with timestamp
- SoundCloud favorite creation: full round-trip with timestamp
- Pre-fill verification: title and artist populated from noembed.com
- Save and grid verification: favorite card visible with correct title, artist, and timestamp

### Excluded

- SoundCloud short link testing (requires PocketBase)
- Authenticated mode (local mode only)
- Error/edge case scenarios (invalid URLs, API failures, duplicates)
- Edit or delete flows
- Mobile viewport testing

### Deferred to Follow-Up Work

- E2E tests for error cases (invalid URL, noembed failure, duplicate URL detection)
- E2E tests for edit and delete flows
- E2E tests for authenticated mode with PocketBase

---

## Implementation Units

### U1. Create `e2e/favorite-creation.spec.ts` with YouTube test

**Goal:** Test the full YouTube favorite creation flow — URL entry, metadata pre-fill, timestamp addition, save, and grid verification.

**Requirements:** R1, R2, R3, R5, R6

**Dependencies:** None

**Files:**

- `e2e/favorite-creation.spec.ts` (create)

**Approach:**

1. Set `locale: 'fr-FR'` to match the existing test pattern
2. Navigate to `/`, click "Continuer en mode local" button, verify main view loads
3. Click the "Nouveau favori" button to open the add-favorite modal
4. Fill the URL input with the YouTube fixture URL, then trigger blur (click or tab to the title field)
5. Wait for the title input to become populated (the metadata loading state to resolve) — use `toHaveValue` with a timeout rather than a fixed `waitForTimeout`
6. Assert title input contains "Never Gonna Give You Up"
7. Assert artist tag area contains "Rick Astley"
8. Fill a timestamp: enter a label and time value (e.g., label "Drop", time "0130" which auto-formats to "01:30")
9. Click the save button ("Sauvegarder")
10. Assert a favorite card appears in the grid with the expected title text
11. Assert the card shows the artist name and the timestamp

**Patterns to follow:**

- `e2e/vue.spec.ts` — locale setting, `page.goto('/')`, role-based button selectors
- `FavoriteModal.vue` — input IDs: `#url`, `#title`; button text from `fr.json`: "Sauvegarder", "Annuler", "+ Ajouter un timestamp"
- `AddFavoriteButton.vue` — button text: "Nouveau favori"
- `FavoriteCard.vue` — title in `h3`, artists in adjacent `p` tag, timestamps in a bordered section with `font-mono` time values

**Test scenarios:**

1. Enter YouTube URL → blur → title input populated with value containing "Never Gonna Give You Up" and artist tag "Rick Astley" appears
2. Add timestamp with label "Drop" and time "0130" → time auto-formats to "01:30"
3. Click save → modal closes → favorite card visible in grid with title, artist, and timestamp "01:30"

**Verification:** `npx playwright test e2e/favorite-creation.spec.ts --project=chromium` passes locally. The grid shows a card with the YouTube icon badge, correct title, artist, and timestamp.

---

### U2. Add SoundCloud test to `e2e/favorite-creation.spec.ts`

**Goal:** Test the full SoundCloud favorite creation flow, verifying that the same dialog correctly handles SoundCloud URLs and displays the SoundCloud icon in the grid.

**Requirements:** R1, R2, R3, R4, R5, R6

**Dependencies:** U1 (same file, shared helper)

**Files:**

- `e2e/favorite-creation.spec.ts` (modify)

**Approach:**

1. Same local-mode setup as U1 — extract the navigate-and-enter-local-mode steps into a `beforeEach` or helper function
2. Click "Nouveau favori", fill URL with the SoundCloud fixture
3. Wait for pre-fill, assert title contains "God's Plan" and artist contains "octobersveryown"
4. Add a timestamp with label "Intro" and time "0045" (auto-formats to "00:45")
5. Save and verify the card appears with SoundCloud icon badge, correct title, artist, and timestamp

**Patterns to follow:** Same as U1. SoundCloud card shows the orange SoundCloud SVG icon with `title="SoundCloud"` (vs YouTube's red icon).

**Test scenarios:**

1. Enter SoundCloud full URL → blur → title input populated with value containing "God's Plan" and artist tag "octobersveryown" appears
2. Add timestamp with label "Intro" and time "0045" → time auto-formats to "00:45"
3. Click save → modal closes → favorite card visible in grid with title, artist, and timestamp "00:45"
4. Card displays the SoundCloud icon (not YouTube)

**Verification:** `npx playwright test e2e/favorite-creation.spec.ts --project=chromium` passes locally with both tests green. Both cards appear if tests run sequentially in the same browser context, or each independently in isolation.

---

## Risks & Dependencies

| Risk                                                          | Mitigation                                                                                                              |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| noembed.com downtime causes CI flakiness                      | Playwright config already retries twice on CI; noembed is a lightweight service with good uptime history                |
| Fixture URLs taken down by content owners                     | URLs chosen from major label / official artist accounts with years of history; if a URL dies, swap the fixture constant |
| Metadata title/artist values change on the provider side      | Use partial matching (`toContain`) rather than exact equality                                                           |
| Pre-fill timing: blur → API call → populate may be slow on CI | Wait for input value with explicit timeout rather than fixed delays                                                     |

---

## Sources & Research

- noembed.com API responses validated via `curl` for both fixture URLs (2026-06-26)
- YouTube fixture: `dQw4w9WgXcQ` — Rick Astley "Never Gonna Give You Up", uploaded 2009, 1.5B+ views
- SoundCloud fixture: `octobersveryown/drake-gods-plan` — Drake "God's Plan", official label account
- FavoriteModal input IDs and i18n keys from `src/components/modals/FavoriteModal.vue` and `src/i18n/locales/fr.json`

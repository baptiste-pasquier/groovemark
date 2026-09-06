---
title: Preserve Favorite Creation Dates on Cloud Import - Plan
type: fix
date: 2026-09-06
topic: cloud-import-created-date
artifact_contract: ce-unified-plan/v1
artifact_readiness: implementation-ready
product_contract_source: ce-brainstorm
execution: code
deepened: 2026-09-06
---

# Preserve Favorite Creation Dates on Cloud Import - Plan

## Goal Capsule

- **Objective:** A favorite imported from a JSON backup while signed in with cloud sync keeps the creation date it had when it was first favorited, the same way local-mode import already behaves.
- **Means:** Add a required, client-settable `created_at` field to the PocketBase `favorites` collection, distinct from its auto-managed `created`/`updated` audit timestamps, and populate it explicitly on every cloud create (KTD1-KTD3).
- **Authority:** Product Contract requirements govern scope. Planning Contract KTDs govern implementation mechanism within that scope. Implementation Units override neither.
- **Stop conditions:** None identified. Research confirmed PocketBase's plain `date` field type is client-settable under normal API rules, unlike the `autodate` type `created` already uses.
- **Execution profile:** `code`, Standard depth. The `favorites` collection's data is treated as reset for this rollout (KTD5) — no existing record needs to satisfy the new required field. Residual risk if that premise doesn't hold is accepted and recorded under Risks & Dependencies.
- **Tail ownership:** The implementer (`ce-work` or the user) commits per unit and opens the PR. This plan does not launch an autonomous pipeline.

---

## Product Contract

**Product Contract preservation:** unchanged.

### Summary

Importing a JSON backup while signed in with cloud sync will preserve each favorite's original creation date instead of overwriting it with the import time, matching what local-mode import already does correctly.

### Problem Frame

Exporting favorites to JSON preserves each favorite's original `created` date, and importing that JSON in local mode restores it correctly. Importing the same JSON while signed in with cloud sync does not: the app never sends a creation date to PocketBase, and PocketBase's own `created` field is an autodate column it manages automatically on every insert — a normal client request cannot set it, regardless of what the import sends. Every cloud import therefore stamps the record with the import time, silently discarding the date the export carried.

The natural alternative — a PocketBase hook that lets an authenticated request override `created` — would need `pb_hooks/` baked into the PocketBase Docker image. That boundary was deliberately closed a few hours before this brainstorm (see Sources): hooks stay out of the production image. Reopening it for this fix would trade a small server-side override for undoing a decision the project just closed.

### Requirements

- R1. Importing a JSON backup while signed in with cloud sync (PocketBase reachable) preserves each favorite's original creation date instead of substituting the import time.
- R2. When an imported entry carries no creation date, the app assigns the import time as its creation date — matching current local-mode behavior.
- R3. Default favorites ordering continues to reflect each favorite's creation date after this change, for both newly imported and pre-existing cloud favorites.

### Key Decisions

- **Preserve the date via a new, non-auto-managed field rather than a PocketBase hook** (session-settled: user-approved — chosen over enabling a server-side hook to override PocketBase's autodate `created` field, since `pb_hooks/` was deliberately excluded from the Docker image in the migrations work merged just before this brainstorm, and a hook would reopen that boundary and add server-side business logic). Governs R1.
- **No backfill for favorites already imported with a lost creation date** (session-settled: user-approved — chosen over building a data-repair path, since the original date was already overwritten before this fix and isn't reliably recoverable from what PocketBase kept). Governs the Scope Boundaries entry below.

### Scope Boundaries

- Local-mode import and the offline authenticated cache fallback already preserve the creation date correctly; their behavior is unchanged.
- No backfill or repair of favorites already imported under the current (broken) behavior — per the Key Decision above. The `favorites` collection's data is additionally treated as reset for this rollout (KTD5): no data-migration step and no read-time fallback for pre-existing records.
- No change to how the creation date is surfaced in the UI; it drives sort order only and is not displayed anywhere today.
- Manual single-favorite add/edit is unaffected from the user's perspective — the repository populates or preserves the new field automatically (KTD3, KTD4); no store or UI changes are needed on that path.

### Acceptance Examples

- AE1. **Covers R1.** Given a JSON export entry with `created: "2024-01-01T00:00:00.000Z"`, when it's imported while signed in with cloud sync available, then the favorite's stored creation date is `2024-01-01T00:00:00.000Z`, not the import timestamp.
- AE2. **Covers R2.** Given a JSON export entry with no creation date, when it's imported via cloud sync, then the favorite is assigned the import time as its creation date.
- AE3. **Covers R3.** Given two favorites imported in the same cloud session with different original creation dates, when the favorites list renders in its default order, then it reflects the preserved original dates, not import order.

### Sources / Research

- `src/stores/favorites.ts:238-253` — `importFavorites`'s cloud branch omits `created` from the create payload; the local/cache branch already preserves it.
- `src/services/favoritesRepository.ts:9-16, 34-40` — `FavoriteRecordInput` and `FavoritesRepository` interfaces, no `created` field.
- `src/services/pocketbaseFavoritesRepository.ts:17-96` — `list()`, `create()`, `update()` each map PocketBase records to `Favorite` manually.
- `src/services/localFavoritesRepository.ts:37-65` — local `create()`/`update()` already handle the date correctly and are unaffected.
- `src/stores/favoritesUi.ts:58-67` — the only reader of `Favorite.created`, used for sort order; not rendered anywhere under `src/components/`.
- `pocketbase/pb_migrations/1788708315_created_favorites.js` — `favorites.created` is an `autodate` field (`onCreate: true`), server-managed on every insert; its field-object shape (`id`, `name`, `type`, `required`, `system`, `presentable`, `hidden`) is the convention a new field follows.
- `docker/Dockerfile.pocketbase` — the `pb_hooks` `COPY` line is commented out; only `pb_migrations` is baked into the image.
- PocketBase docs (`Fields > DateField` vs `Fields > AutodateField`, pocketbase.io/docs/collections) — a plain `date` field is a normal, client-settable field gated only by the collection's existing API rules; only `autodate` fields are auto-managed and write-protected. Dates are RFC3339/ISO 8601 strings.
- `docs/how-to/pocketbase-setup.md` — "Adding a new migration" documents the generation workflow a new field should follow (KTD6).
- `docs/journal/plans/2026-09-06-1807-feat-version-pocketbase-migrations-plan.md` — the plan that closed the pb_hooks-stays-out-of-Docker boundary this fix works around, established the migration-generation convention (KTD6), and set the precedent of treating a PocketBase data volume as reset for a schema rollout (KTD5).
- `src/__tests__/mocks/pocketbase.ts` and `src/__tests__/favorites.spec.ts:11-22, 57-71` — existing mock and cloud-mode test setup patterns to mirror for new test scenarios.

---

## Planning Contract

### Key Technical Decisions

- KTD1. **Add `created_at` (type `date`, required) to the `favorites` collection** as the canonical source of a favorite's creation date. PocketBase's own `created`/`updated` remain untouched, auto-managed audit fields. Rationale: PocketBase's `date` field type is a plain, client-settable field distinct from `autodate`, confirmed against PocketBase's own docs. Governs R1.
- KTD2. **`created_at` stays internal to `PocketBaseFavoritesRepository`; the app-level contract keeps the existing `Favorite.created` name** (session-settled: user-approved — chosen over introducing a second app-level date field, to leave `Favorite`, the export/import JSON shape, `favoritesUi.ts`, and `LocalFavoritesRepository` untouched). `FavoriteRecordInput` gains only an optional `created?: string` input; `Favorite` itself is unchanged. Governs R1, R3.
- KTD3. **`create()` always supplies `created_at`**: the caller's `FavoriteRecordInput.created` when present, otherwise the current time, using `||` rather than `??` so an empty-string date also falls back to the current time — matching `LocalFavoritesRepository`'s existing default (`favorites.ts:252`) and preventing an empty date from reaching PocketBase's required-field validation. One central default covers both the import path (R2) and manual single-favorite adds. Governs R1, R2.
- KTD4. **`update()` never sends `created_at`.** `FavoriteRecordInput` carries no update-time date, so PocketBase leaves the stored value untouched on every edit — no explicit "preserve on edit" logic is needed. Governs R1.
- KTD5. **`created_at` is required, with no backfill migration and no read-time fallback to PocketBase's native `created`** (session-settled: user-directed — chosen over an in-migration backfill of existing rows or a documented production volume reset for this rollout specifically. Challenged with evidence that `docker-compose.prod.yml` mounts a persistent volume and the prior reset was scoped to that one rollout, not an ongoing policy; reaffirmed by explicit user direction to treat the `favorites` collection's data as empty for this rollout too). The residual risk if that premise doesn't hold in practice is recorded under Risks & Dependencies. Governs R3.
- KTD6. **Author the migration via the project's established generation workflow** — run PocketBase locally (`cd pocketbase && ./pocketbase serve`), add the field through the admin UI or `./pocketbase migrate collections`, then commit the generated file — rather than hand-writing it (per the migrations-versioning plan's KTD2, see origin: `docs/journal/plans/2026-09-06-1807-feat-version-pocketbase-migrations-plan.md`).

---

## Implementation Units

### U1. Add `created_at` field to the `favorites` PocketBase collection

- **Goal:** The schema carries a required, client-settable creation-date field distinct from PocketBase's autodate `created`.
- **Requirements:** R1
- **Dependencies:** none
- **Files:**
  - `pocketbase/pb_migrations/<generated>_updated_favorites.js` (name and numeric field id assigned by the generation workflow)
- **Approach:** Follow KTD6: start PocketBase locally and generate the migration by adding the field via the admin UI (or `./pocketbase migrate collections`). The field object mirrors the existing `favorites` migration's convention (`id`, `name: 'created_at'`, `type: 'date'`, `required: true`, `system: false`, `presentable: false`, `hidden: false`), appended to the collection's `fields` array; the down migration removes it by name, with no attempt to preserve `created_at` values written after this ships (see Risks & Dependencies). No data manipulation in this migration (KTD5) — the collection's data is treated as empty for this rollout.
- **Test expectation:** none -- pure schema change, verified structurally below.
- **Verification:** Rebuild and start the local PocketBase container; the `favorites` collection schema shows `created_at` as a required, non-auto field, and creating a favorite through any repository path succeeds only when `created_at` is supplied. Before shipping, smoke-test the required-field enforcement directly: create one test favorite (with `created_at` supplied), then attempt an `update()` on it — confirm the update succeeds because the stored value is already present, validating the assumption this unit depends on.

### U2. Thread `created_at` through the repository and type layer

- **Goal:** `PocketBaseFavoritesRepository` writes and reads `created_at`, mapped onto the existing `Favorite.created` name; every cloud create supplies a value.
- **Requirements:** R1, R2, R3
- **Dependencies:** U1
- **Files:**
  - `src/services/favoritesRepository.ts`
  - `src/services/pocketbaseFavoritesRepository.ts`
  - `src/__tests__/mocks/pocketbase.ts`
  - `src/__tests__/favorites.spec.ts`
- **Approach:**
  1. Add an optional `created?: string` to `FavoriteRecordInput` (KTD2). `LocalFavoritesRepository` ignores the addition; its own date handling is unaffected.
  2. In `create()`, send `created_at: favorite.created || new Date().toISOString()` alongside the existing fields (KTD3); map the response's `created_at` onto the returned `Favorite.created`.
  3. In `update()`, do not send `created_at` (KTD4); keep mapping `created_at` onto `Favorite.created` in the response.
  4. In `list()`, map `created: record.created_at` (KTD5 — no fallback).
- **Test scenarios:**
  - Happy path: `create()` called with `created` set in the input sends `created_at` with that exact value and returns it on `Favorite.created`.
  - Happy path: `create()` called with no `created` in the input sends `created_at` set to the current time.
  - Edge case: `update()`'s PocketBase payload never includes `created_at`, regardless of the input.
  - Integration: `list()` maps a mocked record's `created_at` onto the returned `Favorite.created`.
- **Test data note:** every scenario above uses a `created`/`created_at` value distinct from the PocketBase mock's hardcoded default date (`2024-01-01T00:00:00.000Z` in `src/__tests__/mocks/pocketbase.ts`), so a test would fail — not coincidentally pass — if the mapping ever reads the collection's own auto-managed `created` field instead of `created_at`.
- **Verification:** The scenarios above pass; `npm run type-check` passes with the new optional field.

### U3. Fix cloud-mode import to pass the original date through

- **Goal:** `importFavorites`'s cloud branch preserves each imported favorite's original date, defaulting to import time when absent.
- **Requirements:** R1, R2, R3
- **Dependencies:** U2
- **Files:**
  - `src/stores/favorites.ts`
  - `src/__tests__/favoriteImport.spec.ts`
- **Approach:** In the cloud branch of `importFavorites` (currently omitting any date), add `created: favorite.created` to the `activeRepository.create(...)` call. When absent, U2's KTD3 default (current time) applies automatically — no explicit fallback is needed in the store.
- **Test scenarios:**
  - Covers AE1. Happy path: importing a favorite with a known `created` value in cloud mode results in the stored favorite carrying that exact date.
  - Covers AE2. Edge case: importing a favorite with no `created` value in cloud mode results in the stored favorite's date being the import time.
  - Covers AE3. Integration: importing two favorites with different original dates in the same cloud session, then confirming the app's default sort order reflects those dates, not import order.
- **Test data note:** AE1's worked example date (`2024-01-01T00:00:00.000Z`) is identical to the PocketBase mock's hardcoded default (`src/__tests__/mocks/pocketbase.ts`); use a different date in the actual test implementing AE1 so the assertion can't pass on a mapping bug that reads the collection's own `created` field instead of `created_at`.
- **Verification:** The three scenarios above pass; existing local-mode import tests are unaffected.

### U4. Update documentation and changelog

- **Goal:** The schema reference, setup guide, and changelog reflect the new field.
- **Requirements:** R1
- **Dependencies:** U1
- **Files:**
  - `docs/reference/pocketbase-schema.md`
  - `docs/how-to/pocketbase-setup.md`
  - `CHANGELOG.md`
- **Approach:** Add a `created_at` row to the schema's field table and example record. Add it to `pocketbase-setup.md`'s field list, noting it is not auto-generated (unlike `created`/`updated`). Add one entry under `CHANGELOG.md`'s `Unreleased` section.
- **Test expectation:** none -- documentation only.
- **Verification:** `npm run check:docs` passes.

---

## Risks & Dependencies

- **Risk (accepted, user-directed):** `created_at` is required with no backfill and no read-time fallback (KTD5). If the `favorites` collection is not actually empty when this migration ships, editing a pre-existing favorite would fail PocketBase's required-field validation (`update()` re-validates the full record and rejects a still-empty required field), and a missing value could parse as an invalid date in the sort comparator, disrupting default order beyond just the affected row. This plan proceeds on the explicit instruction to treat the collection's data as empty for this rollout; verifying or resetting the volume before shipping is an operational step outside this plan's scope, not a plan requirement.
- **Risk (rollback data loss):** Rolling back U1's migration after go-live silently drops any `created_at` values captured since deploy — PocketBase discards the unknown field on future writes rather than failing, so a rollback reverts to the original bug (import time becomes the effective date again), not a crash. Consistent with the Product Contract's no-recovery stance on lost dates, but worth knowing before rolling back.
- **Dependency (deployment ordering):** The PocketBase image (U1's migration) and the frontend app image (U2/U3, which must send `created_at` on every create) should deploy together for this rollout. Existing ops docs allow updating PocketBase independently of the app; if the migration ships first while the prior frontend build is still live, every new favorite creation fails validation until the app image catches up.

---

## Verification Contract

| Command                                                                               | Applies to | Purpose                                                                    |
| ------------------------------------------------------------------------------------- | ---------- | -------------------------------------------------------------------------- |
| `npm run type-check`                                                                  | U2         | `FavoriteRecordInput` and repository changes type-check                    |
| `npm run lint`                                                                        | All        | Repo lint standard                                                         |
| `npx vitest run src/__tests__/favorites.spec.ts src/__tests__/favoriteImport.spec.ts` | U2, U3     | New and existing repository/import test scenarios pass                     |
| `npm run check:docs`                                                                  | U4         | Documentation gate                                                         |
| Manual: rebuild and start the local PocketBase container                              | U1         | Schema shows `created_at` as required; app can create favorites through it |

## Definition of Done

- U1-U4 are complete and each unit's Verification criteria pass.
- `favorites.created_at` exists as a required PocketBase field, distinct from the auto-managed `created`/`updated`.
- Cloud-mode import preserves each favorite's original date, or defaults to the import time when absent (AE1-AE3 pass).
- Manual cloud add/edit continues to populate and preserve the date correctly, with no store or UI changes.
- Local-mode import behavior is unchanged.
- The PocketBase image and the frontend app image ship together for this rollout (Risks & Dependencies).
- `docs/reference/pocketbase-schema.md`, `docs/how-to/pocketbase-setup.md`, and `CHANGELOG.md` reflect the new field.
- No leftover debug output, temporary files, or commented-out dead code remains in the touched files.

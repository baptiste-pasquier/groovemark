---
title: Preserve Favorite Creation Dates on Cloud Import - Plan
type: fix
date: 2026-09-06
topic: cloud-import-created-date
artifact_contract: ce-unified-plan/v1
artifact_readiness: requirements-only
product_contract_source: ce-brainstorm
execution: code
---

# Preserve Favorite Creation Dates on Cloud Import - Plan

## Goal Capsule

- **Objective:** A favorite imported from a JSON backup while signed in with cloud sync keeps the creation date it had when it was first favorited, the same way local-mode import already behaves.
- **Means:** Introduce a creation-date field that PocketBase does not auto-manage on create, distinct from its own `created`/`updated` audit timestamps, and thread it through the cloud import and create paths.
- **Authority:** The Product Contract requirements below govern scope; exact field naming, migration mechanics, and repository wiring are for planning.
- **Open blockers:** None identified.

---

## Product Contract

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
- No backfill or repair of favorites already imported under the current (broken) behavior — per the Key Decision above.
- No change to how the creation date is surfaced in the UI; it drives sort order only and is not displayed anywhere today.

### Acceptance Examples

- AE1. **Covers R1.** Given a JSON export entry with `created: "2024-01-01T00:00:00.000Z"`, when it's imported while signed in with cloud sync available, then the favorite's stored creation date is `2024-01-01T00:00:00.000Z`, not the import timestamp.
- AE2. **Covers R2.** Given a JSON export entry with no creation date, when it's imported via cloud sync, then the favorite is assigned the import time as its creation date.
- AE3. **Covers R3.** Given two favorites imported in the same cloud session with different original creation dates, when the favorites list renders in its default order, then it reflects the preserved original dates, not import order.

### Sources / Research

- `src/stores/favorites.ts:238-253` — `importFavorites`'s cloud branch omits `created` from the create payload; the local/cache branch already preserves it.
- `src/services/favoritesRepository.ts:9-16` — `FavoriteRecordInput` has no `created` field.
- `pocketbase/pb_migrations/1788708315_created_favorites.js` — `favorites.created` is an `autodate` field (`onCreate: true`), server-managed on every insert.
- `src/stores/favoritesUi.ts:59-60` — the only reader of `created`, used for sort order; not rendered anywhere under `src/components/`.
- `docker/Dockerfile.pocketbase` — the `pb_hooks` `COPY` line is commented out; only `pb_migrations` is baked into the image.
- `docs/journal/plans/2026-09-06-1807-feat-version-pocketbase-migrations-plan.md` — the plan that just closed the pb_hooks-stays-out-of-Docker boundary this fix works around.

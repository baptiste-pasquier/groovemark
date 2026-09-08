---
title: 'PocketBase relation maxSelect: 0 means single-select, not unlimited'
date: 2026-09-08
category: database-issues
module: favorites
problem_type: database_issue
component: data_model
symptoms:
  - A favorite credited to multiple artists silently keeps only the last artist after save
  - No error, warning, or validation failure from PocketBase's API or the client -- the save reports success
  - 'artistIds relation field was configured with maxSelect: 0 assuming it meant unlimited multi-select'
root_cause: config_error
resolution_type: migration
severity: medium
tags: [pocketbase, relation-field, maxselect, migration, multi-select, silent-data-loss]
framework_version: pocketbase 0.40.2
---

# PocketBase relation maxSelect: 0 means single-select, not unlimited

## Problem

The `artistIds` relation field on the `favorites` PocketBase collection was defined with
`maxSelect: 0` in `pocketbase/pb_migrations/1788815925_updated_favorites.js`, on the assumption
that `0` means "unlimited multi-select." In PocketBase, `0` and `1` both mean single-select, so a
favorite credited to more than one artist would silently retain only the last artist selected
when saved.

## Symptoms

- There is no error, warning, or validation failure at any layer -- not from PocketBase's API,
  not from the client. The save operation succeeds.
- Given a favorite associated with multiple artists, only the last artist ID in the selection is
  persisted; the others are silently dropped.
- The bug is only observable by inspecting the stored data after the fact, or the underlying
  SQLite schema (a scalar `TEXT` column instead of a `JSON` array column for `artistIds`).

## What Didn't Work

Reading PocketBase's Go source for the pinned version was the first investigative step, and it
did point at the right answer: `RelationField.IsMultiple()` returns `MaxSelect > 1`, so
`maxSelect: 0` and `maxSelect: 1` both produce a single-select field rather than a multi-select
one. Source-reading was correctly treated as _insufficient_ on its own to confirm a claim about a
third-party platform's runtime behavior. Rather than shipping a fix based on that reading alone,
the investigation went further: the actual pinned PocketBase v0.40.2 binary (pinned in
`docker/Dockerfile.pocketbase:6`) was downloaded, the migration was applied against a clean
database, and the resulting SQLite schema was inspected directly with
`sqlite3 data.db ".schema favorites"`. This confirmed a scalar `TEXT` column for `artistIds` at
`maxSelect: 0`, and a `JSON` array column once `maxSelect` was changed to `999`. Treating
source-reading as a hypothesis rather than a confirmed fact -- and only trusting the fix once the
binary's actual behavior matched it -- is what avoided shipping an unverified change.

An earlier session on this same branch (session history) shows how easy the wrong conclusion is
to reach and keep restating: asked three separate times whether `maxSelect: 0` really meant
unlimited multi-select, an agent reconfirmed "yes, unlimited" twice in a row -- first by citing an
old PocketBase v0.8.0 changelog line ("enables unlimited maxSelect for the relation field"), then
by re-grepping the migration file and finding the same literal `0` without questioning what it
meant. Only on the fourth challenge, after being asked to check the latest PocketBase docs
directly, did it find text stating plainly that "when MaxSelect is set to one or less, the field
expects a single record ID" -- and even then it first tried to rationalize `0` as still behaving
as unlimited "in practice," before finally reading the actual Go source and confirming
`IsMultiple()` requires `MaxSelect > 1`. Restating an old changelog note, or re-confirming the
same literal config value, is not verification -- it repeats the same unverified assumption
rather than testing it (session history).

## Solution

The fix changes `maxSelect` from `0` to `999` in the same migration file, since the migration had
never been applied or deployed anywhere -- the artist-identity feature lived entirely on a
still-open, unmerged PR at the time of the fix, so editing the migration in place (rather than
adding a new migration) was safe.

`pocketbase/pb_migrations/1788815925_updated_favorites.js:15`:

```js
// Before
maxSelect: 0,

// After
maxSelect: 999,
```

A regression test was added at `src/__tests__/pocketbaseMigrations.spec.ts`. Migration files run
inside PocketBase's embedded JS runtime and call global `migrate`/`Field`/`app` helpers that
don't exist in Node, so they cannot be imported and executed directly in Vitest. Instead, the
test reads the migration file as text (`readMigrationSource`,
`pocketbaseMigrations.spec.ts:10-13`), extracts the `artistIds` field's `new Field({...})` block
via a regex keyed on `name: 'artistIds'` (`extractFieldBlock`,
`pocketbaseMigrations.spec.ts:15-24`), and asserts `maxSelect > 1`
(`pocketbaseMigrations.spec.ts:40-44`) rather than an exact value, pinning the invariant that
matters ("this is genuinely multi-select") instead of an arbitrary number.

## Why This Works

`maxSelect: 999` is unambiguously greater than `1`, so `RelationField.IsMultiple()` evaluates to
`true` and PocketBase stores `artistIds` as a `JSON` array column, allowing a favorite to retain
every associated artist ID on save instead of collapsing to the last one. The root cause of the
original bug was a conflation of two unrelated PocketBase facts: an old changelog note describing
the removal of a numeric _cap_ on how high `maxSelect` could be configured was misread as meaning
that the value `0` itself signals "unlimited." The changelog was about the ceiling on the
configurable value, not about the semantics of `0`; `0` has always meant single-select. The
regression test encodes the actual verified semantic (`maxSelect > 1` implies multi-select)
rather than restating the old assumption, so it will fail if a future edit regresses the field
back to a single-select-equivalent value.

Verification after the fix: the full Vitest suite passed (183 tests at the time, with only
pre-existing, unrelated Playwright-worktree failures remaining), type-check/eslint/prettier were
clean, and a follow-up scoped 5-persona code review (correctness, data-migration, testing,
project-standards, api-contract) returned zero actionable findings.

## Prevention

- **Never treat `maxSelect: 0` as "unlimited" for a PocketBase relation field.** In the pinned
  PocketBase version (`docker/Dockerfile.pocketbase:6`), a relation field is multi-select only
  when `maxSelect > 1` (`RelationField.IsMultiple()`); `0` and `1` both mean single-select and
  are stored as a scalar column, not a `JSON` array. For an effectively-unlimited multi-select
  relation, set an explicit large value (e.g. `999`), never `0`.
- **Don't trust a platform's changelog notes, or a single re-read of its source or the
  configured value, to confirm cardinality-affecting field config.** A changelog note can
  describe a fact adjacent to the one being relied on (e.g., "the cap on the configurable value
  was removed") without asserting the fact actually needed (e.g., "what does `0` itself mean").
  For any PocketBase field-configuration change that affects cardinality, uniqueness, or storage
  shape (`maxSelect`, `min`/`max` constraints, unique indexes, etc.), verify against the actual
  pinned binary's behavior -- apply the migration to a clean database and inspect the resulting
  schema directly (e.g. `sqlite3 data.db ".schema <collection>"`) -- before relying on it.
- **When writing a regression test for a config invariant, assert the exact value the feature
  actually needs, not just a loose bound.** The current test at
  `src/__tests__/pocketbaseMigrations.spec.ts:40-44` asserts `maxSelect > 1`, which is correct
  for catching a regression back to `0` or `1`, but would still pass if a future edit set
  `maxSelect: 2` -- a value that is technically multi-select but almost certainly not what the
  feature needs. If a future change to this test is warranted, prefer asserting the exact
  intended value (e.g. `expect(maxSelect).toBe(999)`) so an accidental too-small-but-still-`>1`
  edit is caught by the test rather than surfacing only as an application-level symptom later.
- **When a PocketBase migration file needs a behavioral fix and has never been applied in any
  deployed environment, edit it in place rather than adding a new migration.** Confirm via the
  feature's branch/PR status that no environment has applied the migration yet before doing so;
  once a migration has shipped anywhere, correct it with a new migration instead.

## Related Issues

- [PR #55](https://github.com/baptiste-pasquier/groovemark/pull/55) -- the artist-identity
  feature this bug was found and fixed in.
- [ADR 0002](../../decisions/0002-artists-as-a-first-class-record.md) -- the design decision
  that `artistIds` is a multi-select relation; this bug was a defect in the migration
  implementing that decision, not a flaw in the decision itself.

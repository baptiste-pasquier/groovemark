---
status: accepted
date: 2026-09-08
decision-makers: [baptiste-pasquier]
---

# Artists as a first-class record, not a normalized string

## Context and Problem Statement

An artist existed only as a string copied into each favorite's `artists` array. Nothing
bound two copies of the same name together: the artist field's own suggestion list matched
by exact string, so `Amelie Lens` and `AMELIE` filtered to two disjoint sets of mixes, and
nothing in the app could join them back together after the fact. A per-artist view -- the
next planned feature -- needs a join it can trust, and a join on free text drifts every time
a name is retyped.

## Decision Drivers

- Filtering and a future per-artist view need every mix crediting one performer to resolve
  to the same identity, regardless of how the name was typed
- Whatever ships needs to also collapse the spelling variants already present in a JSON
  backup on import, since production carried no favorites at the time of this decision
- The fix should not require a second screen or workflow just to credit a known artist

## Considered Options

- Keep artist names as plain strings, normalized for comparison, with a merge-and-rename
  tool to fix drift after the fact
- Promote the artist into its own PocketBase record, referenced by a relation

## Decision Outcome

Chosen option: promote the artist into its own `artists` collection (see
[PocketBase Schema](../../reference/pocketbase-schema.md#collection-artists)), referenced
from `favorites` by a multi-select `artistIds` relation. An opaque record id removes the
ghost-artist class outright instead of making it repairable after the fact, and it is what
the planned per-artist view will join against.

The favorites `artists` text column stays, as a denormalized mirror of each credited
artist's display name, written on every create and update. It keeps the JSON export and the
favorite card's display free of a live join. The cost is that a future rename must also
rewrite this column on every favorite crediting that artist, or the export keeps emitting
the old spelling and a re-import resolves it to a second artist -- a cost accepted now and
paid when renaming ships with the per-artist view.

Because production held no favorites at the time of this decision, the migration adding the
`artists` collection and the `artistIds` relation is schema-only and destructive: no
client-side conversion job populates it from existing data, and neither migration keeps a
pre-migration snapshot for a rollback path. The account's own JSON export, taken before the
migration, is the operator-level safety net; artists are otherwise populated only by
ordinary use of the artist field and by resolving names on import.

### Consequences

- Good, because filtering, search, and the future per-artist view operate on identity, so a
  retyped spelling never creates a second, disconnected artist
- Good, because the migration and its down function stay simple plain-drop operations, with
  no data-preservation logic to keep correct
- Bad, because a favorite saved before this shipped -- or any local-mode data untouched by an
  import -- carries no `artistIds` relation and drops out of the identity-based filter list
  until it is next saved through the artist field; it still renders its names via the
  untouched text column (`src/services/localFavoritesRepository.ts` defaults a missing
  `artistIds` to `[]` at the storage read boundary rather than treating it as an error)
- Bad, because renaming an artist is deferred until the per-artist view ships: two spellings
  created independently -- once from the artist field, once from a separate import -- stay
  two artists until then

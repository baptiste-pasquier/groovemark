---
status: accepted
date: 2026-09-10
decision-makers: [baptiste-pasquier]
---

# Events and performances as separate records, saved as one transaction

## Context and Problem Statement

The app knew only mixes. A night out is a different object: a name, a date attended, a venue,
and a line-up of artists seen there, each carrying at most one verdict on how it went. Nothing
in the schema could hold it, and the per-artist view the artists destination needs has to join
a night's line-up against the same artist identity a mix credits -- so the shape chosen for a
line-up decides whether that join exists at all.

The line-up is what makes the choice non-obvious. It is a list owned entirely by one night,
edited as a whole on one surface, ordered as it was typed, and it must disappear with the night
it belongs to -- while each of its rows must still be addressable from the artist it credits.

## Decision Drivers

- A night saves or fails as a whole: an event with half its line-up written is not a state the
  interface offers, so it must not be a state the storage can reach
- Deleting a night must remove its line-up, with no cleanup pass to keep correct
- Each row must join to an `artists` record, so the artist page and the artists table read one
  identity rather than a name
- A line-up must read back in the order it was typed, in both persistence modes
- A backup must restore onto a different account and instance, as a mixes backup already does

## Considered Options

- One `events` record with the line-up as a nested JSON array, like `timestamps` on a favorite
- Two owner-scoped collections, `events` and `performances`, joined by a relation
- One flat record per performance, with the night's name, date and venue repeated on each row

## Decision Outcome

Chosen option: two owner-scoped collections (see
[PocketBase Schema](../../reference/pocketbase-schema.md#collection-events)). `events` holds
the night; `performances` holds one artist's appearance at it, referencing the event and the
artist by relation. A nested JSON array cannot be joined against an artist record at all, and
the flat repeated record makes renaming or re-dating a night a multi-row write with no
transaction around it.

The `eventId` relation cascades on delete and the `artistId` relation does not. A performance
exists as part of its night and nowhere else, so the cascade replaces cleanup code; an artist
outlives the performances crediting it, and nothing in the app deletes an artist, so a
performer whose only credit was a deleted night keeps their record and leaves the catalogue.

A save is one `POST /api/batch` transaction: the event write plus the creates, updates and
deletes its line-up implies. The alternative -- sequential writes with a compensating delete --
puts the guarantee in the compensation, which can itself fail, and what it leaves behind is an
event with a partial line-up. The event id is therefore minted client-side, because no request
in a batch can reference an id the server would generate for an earlier request in the same
batch.

Order within a line-up is a client-set `position` field, not the write order. Every row of one
batch shares a `created` timestamp, so the rows tie and a random id decides -- see
[the server-behaviour entry](../solutions/database-issues/pocketbase-batch-writes-and-field-shapes.md)
for what that produced. Every row is restamped on each save, because removing or reordering one
row shifts the index of the rest.

The backup file becomes one versioned envelope, `{ formatVersion: 1, mixes: [...],
events: [...] }`, and an import refuses anything that does not declare a version it knows. This
supersedes the file shape [ADR-0002](0002-artists-as-a-first-class-record.md) left in place --
a bare array of mixes -- while keeping its rule that a relation id is never exported: an event
credits its performers by display name alone, and the restore resolves those names on the
target account. An export taken before this is refused, and the operator brings it forward by
wrapping the array under `mixes` and adding the version.

### What this inherits from ADR-0002

| Pattern from ADR-0002                                     | How events use it                                                    |
| --------------------------------------------------------- | -------------------------------------------------------------------- |
| An artist is a record, joined by relation, never a string | A performance credits an `artists` record through `artistId`         |
| A denormalized display-name mirror alongside the relation | `performances.artistName`, so an exported event reads without a join |
| Owner relation plus user-scoped list/view/update/delete   | Both new collections, unchanged                                      |
| A relation id is never written into a backup file         | An exported performance carries `artistName` and a verdict, no ids   |

One thing had to be added rather than inherited. The owner-scoped rules validate a record's own
`owner` field and not its relations, so nothing stopped a performance owned by the caller from
pointing at another account's event or artist. The `performances` create and update rules
correlate each submitted relation id with the caller through a collection lookup.

### Consequences

- Good, because deleting a night is one delete and the line-up follows, with no application
  code that can be skipped, retried wrongly, or forgotten in a second mode
- Good, because the artist page and the artists table join on identity, so a line-up typed with
  a different spelling still reaches the right performer
- Good, because a whole-event repository interface keeps local mode free to nest performances
  under their event in one storage key while the cloud path keeps two collections, without any
  caller branching on mode
- Bad, because the `/api/batch` endpoint is disabled in a default PocketBase instance, so an
  instance that never applies the settings migration reads and lists events normally and
  refuses only to save one
- Bad, because a save is bounded by the batch's request count, so a line-up long enough to
  exceed it is refused with an instruction to split the night rather than saved
- Bad, because `performances.artistName` carries the same rename debt ADR-0002 accepted for the
  favorites `artists` column: renaming an artist must rewrite it on every performance crediting
  them, or an export keeps emitting the old spelling
- Bad, because a backup taken before the envelope is refused outright, and an operator with an
  older file has to edit it by hand

### Confirmation

The migrations were applied against the pinned PocketBase 0.40.2 binary on a clean database and
reverted in reverse order; the relation guard was proven to accept an own-account row and to
reject a foreign event id, a foreign artist id and a submitted foreign owner, using a second
account owning its own event. Four behaviours of that server that the schema does not state are
recorded in
[the server-behaviour entry](../solutions/database-issues/pocketbase-batch-writes-and-field-shapes.md).

---
title: 'What PocketBase 0.40.2 actually does with a batch, a select, a date and a relation guard'
date: 2026-09-10
category: database-issues
module: events
problem_type: database_issue
component: data_model
symptoms:
  - A five-artist line-up written in one batch read back as 1-3-4-2-5 instead of the typed order
  - An unrated performance satisfied the "most recent rated verdict" selector, because the select field returned '' rather than null
  - The same night printed a different date string in local mode and in cloud mode
  - It was unknown whether a `?=` relation guard correlates within one row, and whether it can see an event created earlier in the same batch
root_cause: platform_behavior
resolution_type: code_change
severity: high
tags:
  [
    pocketbase,
    batch,
    api-batch,
    created-timestamp,
    select-field,
    date-field,
    api-rules,
    relation-guard,
    events,
  ]
framework_version: pocketbase 0.40.2
---

# What PocketBase 0.40.2 actually does with a batch, a select, a date and a relation guard

## Problem

The `events` and `performances` collections are written through `POST /api/batch` and read
back through the SDK, and four behaviours of the pinned server decide whether that round trip
preserves what was saved. None of them is visible in the collection schema, and each was found
only by running against the server: two produced a wrong read, one produced a cosmetic
divergence between the two persistence modes, and one was an open question the whole rules
design depended on.

## Symptoms

### 1. Rows written in one batch tie on `created`, so a line-up came back scrambled

Every row committed in one batch is stamped with the same `created` value. `created` has
millisecond precision and a batch commits well inside a millisecond, so sorting a line-up on
`created` alone leaves the rows tied, and the tiebreak falls to the random record id.

Measured against the pinned server: a five-row line-up typed 1,2,3,4,5 read back 1,3,4,2,5.
Nothing errored -- the line-up simply reordered itself on the next reload. Local mode never
showed the symptom, because it nests performances under their event and so gets entry order
for free; only the cloud mode had nothing to sort on.

### 2. A `select` field returns `''` for an absent value, never `null`

The `verdict` field is optional, and an absent verdict was written as `null`. The server
returns `''` for it, and returns `''` whether the write sent `''` or `null`.

Read back as-is, that empty string passes the `verdict !== null` test the per-artist selectors
use. The "most recent _rated_ verdict" the artist page leads with, and the artists table's
verdict column that sorts on the same value, would both have accepted an unrated performance
as a rated one.

### 3. A `date` field normalises a bare day to a timestamp

`dateAttended` is a `date` field. A write of `2026-05-04` is stored and returned as
`2026-05-04 00:00:00.000Z`, while local mode keeps the bare day the date input produced.

There is no time of day to preserve for a night attended, so the divergence buys nothing and
costs a visible one: the same night would print different text depending on which persistence
mode the session happened to be in.

### 4. `?=` in a relation guard: two unknowns the design rested on

The `performances` create rule guards both relations by correlating the submitted id with the
caller through a collection lookup:

```text
@collection.events.id ?= @request.body.eventId && @collection.events.owner ?= @request.auth.id
```

Two things about that were unknown before running it:

- whether `?=` correlates **within one row** -- that is, whether the two clauses must be
  satisfied by the same `events` row, or whether any row matching each clause independently
  would satisfy the rule and let a caller reference a foreign event;
- whether the lookup can see an event created by an **earlier request of the same batch**,
  since an event and its performances are created in one transaction and the event does not
  exist before it.

A guard that fails to evaluate rejects every request, which from the client looks exactly like
a batch endpoint left disabled. So the accepting case had to be proven, not only the rejecting
one -- a rules design proven only by its rejections is indistinguishable from a rules design
that rejects everything.

## Solution

| Finding                       | Fix                                                                                     |
| ----------------------------- | --------------------------------------------------------------------------------------- |
| Batch rows tie on `created`   | A client-set `position` field; the read sorts `position,created,id`                     |
| `select` returns `''`         | `''` and any unknown value map to `null` at the read boundary                           |
| `date` returns a timestamp    | The read boundary cuts the timestamp back to the bare `YYYY-MM-DD` day                  |
| `?=` correlation and batching | No fix needed -- both resolved in the design's favour, and the guard shipped as written |

`position` is written by the client from the row's index in the submitted line-up, and
restamped for **every** row on each save, because removing or reordering one row shifts the
index of the rest. `created,id` stays on as the tiebreak so rows written before the field
existed -- all of them reading as `0` -- keep a total, stable order among themselves. The same
five-row line-up then read back 1,2,3,4,5.

Both normalisations happen at the read boundary in
`src/services/pocketbaseEventsRepository.ts` (`toVerdict`, `toDayAttended`), not in the
surfaces, so every consumer sees one shape regardless of which mode produced it.

The relation guard was proven with a second account owning **both** its own event and its own
artist, which is the only configuration where an uncorrelated guard would show: an attacker who
owns nothing satisfies neither clause, so a rejection would prove nothing. Four cases were run
against that account. A row referencing the caller's own event and artist is accepted -- the
case that distinguishes a working guard from one that fails to evaluate and so rejects
everything. A foreign event id, a foreign artist id, and a submitted foreign owner are each
rejected, as is a nonexistent event id. An event plus three performance rows commit in one
batch, so the lookup does see the event created earlier in the same transaction; and a
mid-batch rejection leaves no event and no row.

## Why This Works

`position` moves the ordering off a server-assigned value the server does not vary within a
batch and onto a value the client controls. It is a correctness field, not a tidiness one: the
repository interface promises performances in entry order in both modes, and in the cloud mode
there was no other column that could keep that promise.

Normalising at the read boundary rather than at each consumer is what makes the two persistence
modes substitutable. `''` and `null` are the same fact -- no verdict -- and only one of them can
be the fact the app reasons about; the same holds for a bare day and a midnight timestamp.

## Prevention

- **Never sort rows written in one PocketBase batch on `created`.** Every row of one batch
  shares the timestamp, so the sort is decided by the random record id. Carry an explicit
  client-set ordering field and sort on it first, keeping `created,id` as a tiebreak.
- **Never treat a PocketBase `select` field's absent value as `null` on read.** It comes back
  as `''`, whatever was written. Map `''` -- and anything outside the declared values -- to the
  app's absent value at the read boundary, or every `!== null` test downstream is wrong.
- **Never assume a PocketBase `date` field round-trips a bare day.** It returns a full
  timestamp. Decide which form is canonical for the interface and normalise to it once, at the
  read boundary, or two persistence modes will render the same value differently.
- **Prove an API rule by what it accepts before trusting what it rejects.** A rule that fails
  to evaluate rejects everything, and a rejection-only test suite passes against it. For an
  owner-scoped relation guard, that means a second account with its own records: accept the
  caller's own row, reject a foreign relation id in each position.
- **Check whether a rule's lookup can see a record created earlier in the same batch before
  designing around it.** In PocketBase 0.40.2 it can -- an event created by request 1 satisfies
  a guard evaluated for request 2 in the same transaction -- which is what makes a
  create-event-and-line-up-in-one-batch design legal at all.

## Related Issues

- [ADR-0003](../../decisions/0003-events-and-performances-as-records.md) -- the decision these
  four behaviours were found while implementing.
- [PocketBase Schema](../../../reference/pocketbase-schema.md#collection-performances) -- the
  distilled rules: the sort order, the guard, and the batch settings.
- [`pocketbase-maxselect-single-select.md`](pocketbase-maxselect-single-select.md) -- the same
  lesson one collection earlier: verify a PocketBase field's behaviour against the pinned
  binary rather than against its configuration.

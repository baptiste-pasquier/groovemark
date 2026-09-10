---
title: PocketBase collection schema
type: reference
audience: [human, agent]
status: stable
stale_after: 2026-12-15
---

# Pocketbase Collection Schema

## Collection: favorites

This collection stores user favorites (music mixes/sets from YouTube and SoundCloud). The canonical source of this schema is `pocketbase/pb_migrations/*.js`, baked into the PocketBase Docker image at build time and applied automatically on container start; the tables below describe what those migrations produce.

### Fields

| Field Name | Type              | Required | Description                                                                                                                                        |
| ---------- | ----------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| id         | Text (auto)       | Yes      | Auto-generated unique identifier                                                                                                                   |
| url        | URL               | Yes      | URL of the YouTube or SoundCloud mix                                                                                                               |
| title      | Text              | Yes      | Title of the mix/set                                                                                                                               |
| artists    | JSON              | No       | Array of artist names, e.g., `["Artist 1", "Artist 2"]`                                                                                            |
| artistIds  | Relation(artists) | No       | Multi-select relation to the artist(s) a favorite credits; `artists` above stays as the denormalized display-name mirror kept in sync alongside it |
| type       | Text              | Yes      | Platform type: either "youtube" or "soundcloud"                                                                                                    |
| thumbnail  | URL               | No       | URL to the thumbnail image                                                                                                                         |
| timestamps | JSON              | No       | Array of timestamp objects with label, time, and rated fields                                                                                      |
| owner      | Relation(users)   | Yes      | Authenticated user who owns the favorite                                                                                                           |
| created_at | Date              | Yes      | Client-settable creation date, preserved on import -- the source of truth for a favorite's creation date                                           |
| created    | DateTime (auto)   | Yes      | Auto-generated creation timestamp (audit only, not client-settable)                                                                                |
| updated    | DateTime (auto)   | Yes      | Auto-generated last update timestamp                                                                                                               |

### JSON Field Structures

#### artists

```json
["Artist Name 1", "Artist Name 2"]
```

#### timestamps

```json
[
  {
    "label": "Intro",
    "time": "0:00",
    "rated": false
  },
  {
    "label": "Drop",
    "time": "1:23:45",
    "rated": true
  }
]
```

### Example Record

```json
{
  "id": "abc123xyz",
  "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  "title": "Epic Mix 2024",
  "artists": ["DJ Example", "Artist Two"],
  "type": "youtube",
  "thumbnail": "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
  "owner": "users_record_id",
  "timestamps": [
    {
      "label": "Intro",
      "time": "0:00",
      "rated": false
    },
    {
      "label": "Main Drop",
      "time": "2:15",
      "rated": true
    }
  ],
  "created_at": "2024-01-01 12:00:00.000Z",
  "created": "2024-01-01 12:00:00.000Z",
  "updated": "2024-01-01 12:00:00.000Z"
}
```

### Collection Settings

Use user-scoped rules in both development and production so the client only ever sees the current user's favorites:

- **List/Search Rule**: `@request.auth.id != "" && owner = @request.auth.id`
- **View Rule**: `@request.auth.id != "" && owner = @request.auth.id`
- **Create Rule**: `@request.auth.id != "" && @request.body.owner = @request.auth.id`
- **Update Rule**: `@request.auth.id != "" && owner = @request.auth.id && (@request.body.owner:isset = false || @request.body.owner = @request.auth.id)`
- **Delete Rule**: `@request.auth.id != "" && owner = @request.auth.id`

### Collection Settings (Production)

For production, implement proper authentication and authorization:

- Enable user authentication
- Keep rules restricted to the authenticated user's own records
- Enable HTTPS
- Configure CORS appropriately

### Migration from localStorage

If you have existing data in localStorage, you can:

1. Export your favorites using the "Export JSON" button in the app
2. Start Pocketbase and create the collection
3. Use the "Import JSON" button to import your favorites

## Collection: artists

This collection stores artist identities referenced by a favorite's `artistIds` relation. The canonical source of this schema is `pocketbase/pb_migrations/1788815913_created_artists.js`.

### Fields

| Field Name  | Type            | Required | Description                                                                                                    |
| ----------- | --------------- | -------- | -------------------------------------------------------------------------------------------------------------- |
| id          | Text (auto)     | Yes      | Auto-generated unique identifier                                                                               |
| displayName | Text            | Yes      | The artist's display name, e.g. `Amelie Lens`                                                                  |
| slug        | Text            | Yes      | Normalized name (NFD-folded, diacritics stripped, lowercased, trimmed, whitespace-collapsed), unique per owner |
| owner       | Relation(users) | Yes      | Authenticated user who owns the artist record                                                                  |
| created     | DateTime (auto) | Yes      | Auto-generated creation timestamp                                                                              |
| updated     | DateTime (auto) | Yes      | Auto-generated last update timestamp                                                                           |

A unique index on `(owner, slug)` rejects a second artist with the same normalized name for the same owner, which is what makes a rejected create the signal to look the existing artist up instead.

### Example Record

```json
{
  "id": "abc123xyz456789",
  "displayName": "Amelie Lens",
  "slug": "amelie lens",
  "owner": "users_record_id",
  "created": "2024-01-01 12:00:00.000Z",
  "updated": "2024-01-01 12:00:00.000Z"
}
```

### Collection Settings

- **List/Search Rule**: `@request.auth.id != "" && owner = @request.auth.id`
- **View Rule**: `@request.auth.id != "" && owner = @request.auth.id`
- **Create Rule**: `@request.auth.id != "" && @request.body.owner = @request.auth.id`
- **Update Rule**: `@request.auth.id != "" && owner = @request.auth.id && (@request.body.owner:isset = false || @request.body.owner = @request.auth.id)`
- **Delete Rule**: `@request.auth.id != "" && owner = @request.auth.id`

## Collection: events

This collection stores a night out: what it was called, when it happened and where. The performances seen there live in the `performances` collection and reference the event, rather than being nested inside this record. The canonical source of this schema is `pocketbase/pb_migrations/1789067400_created_events.js`, and the collection id it fixes is `pbc_1093733721`.

### Fields

| Field Name   | Type            | Required | Description                                                                                                |
| ------------ | --------------- | -------- | ---------------------------------------------------------------------------------------------------------- |
| id           | Text (auto)     | Yes      | Auto-generated unique identifier, 15 characters matching `^[a-z0-9]+$`                                     |
| name         | Text            | Yes      | The event's name, e.g. `Dour Festival`                                                                     |
| dateAttended | Date            | Yes      | The night the event was attended -- client-settable, so an imported or back-dated event keeps its own date |
| venue        | Text            | No       | Where the event took place                                                                                 |
| owner        | Relation(users) | Yes      | Authenticated user who owns the event                                                                      |
| created      | DateTime (auto) | Yes      | Auto-generated creation timestamp                                                                          |
| updated      | DateTime (auto) | Yes      | Auto-generated last update timestamp                                                                       |

An index on `(owner, dateAttended)` backs the newest-first listing of one account's events.

### Collection Settings

- **List/Search Rule**: `@request.auth.id != "" && owner = @request.auth.id`
- **View Rule**: `@request.auth.id != "" && owner = @request.auth.id`
- **Create Rule**: `@request.auth.id != "" && @request.body.owner = @request.auth.id`
- **Update Rule**: `@request.auth.id != "" && owner = @request.auth.id && (@request.body.owner:isset = false || @request.body.owner = @request.auth.id)`
- **Delete Rule**: `@request.auth.id != "" && owner = @request.auth.id`

## Collection: performances

This collection stores one artist's appearance at one event, with at most one verdict on it. A performance exists as part of its event and nowhere else: its `eventId` relation cascades on delete, so removing an event removes its whole line-up. The canonical source of this schema is `pocketbase/pb_migrations/1789067401_created_performances.js`, and the collection id it fixes is `pbc_2758201643`.

### Fields

| Field Name | Type              | Required | Description                                                                                            |
| ---------- | ----------------- | -------- | ------------------------------------------------------------------------------------------------------ |
| id         | Text (auto)       | Yes      | Auto-generated unique identifier, 15 characters matching `^[a-z0-9]+$`                                 |
| eventId    | Relation(events)  | Yes      | Single-select (`maxSelect: 1`) relation to the event; `cascadeDelete: true`                            |
| artistId   | Relation(artists) | Yes      | Single-select (`maxSelect: 1`) relation to the credited artist; `cascadeDelete: false`                 |
| artistName | Text              | Yes      | The credited artist's display name, denormalized so an exported event reads without the artist records |
| verdict    | Select            | No       | One of `dislike`, `one-star`, `two-stars`, `three-stars`; empty means no verdict, not a lowest step    |
| position   | Number            | No       | The row's zero-based index in its event's line-up, set by the client (`onlyInt`, `min: 0`)             |
| owner      | Relation(users)   | Yes      | Authenticated user who owns the performance                                                            |
| created    | DateTime (auto)   | Yes      | Auto-generated creation timestamp                                                                      |
| updated    | DateTime (auto)   | Yes      | Auto-generated last update timestamp                                                                   |

Indexes on `(owner, eventId)` and `(owner, artistId)` back the two ways a performance is read: the line-up of one event, and one artist's live history.

Read a line-up with `sort: 'position,created,id'`. `position` is required for correctness, not for tidiness: a batch writes every row of one save inside the same millisecond and `created` has millisecond precision, so rows of one line-up tie and the random id would decide the order. `created,id` remains as the tiebreak, which keeps rows written before `position` existed -- all of them reading as `0` -- in a total, stable order among themselves. A client sets `position` from the row's index in the submitted line-up, and rewrites it for every row on each save, because removing or reordering one row shifts the index of the rest. `position` was added by `pocketbase/pb_migrations/1789067403_updated_performances_position.js`. The server behaviour behind this sort order is recorded in [What PocketBase 0.40.2 actually does with a batch, a select, a date and a relation guard](../journal/solutions/database-issues/pocketbase-batch-writes-and-field-shapes.md).

`owner` is a denormalized copy of the owning account, matching the other collections, and the relation guard below is what keeps it consistent with the event and artist the row points at.

### Collection Settings

The owner-scoped rules match the other collections, and the create and update rules carry an additional guard on both relations: a row may only reference an event and an artist belonging to the caller. Each guard correlates the submitted id with the caller through a collection lookup, rather than traversing the submitted relation.

- **List/Search Rule**: `@request.auth.id != "" && owner = @request.auth.id`
- **View Rule**: `@request.auth.id != "" && owner = @request.auth.id`
- **Create Rule**: `@request.auth.id != "" && @request.body.owner = @request.auth.id && @collection.events.id ?= @request.body.eventId && @collection.events.owner ?= @request.auth.id && @collection.artists.id ?= @request.body.artistId && @collection.artists.owner ?= @request.auth.id`
- **Update Rule**: `@request.auth.id != "" && owner = @request.auth.id && (@request.body.owner:isset = false || @request.body.owner = @request.auth.id) && (@request.body.eventId:isset = false || (@collection.events.id ?= @request.body.eventId && @collection.events.owner ?= @request.auth.id)) && (@request.body.artistId:isset = false || (@collection.artists.id ?= @request.body.artistId && @collection.artists.owner ?= @request.auth.id))`
- **Delete Rule**: `@request.auth.id != "" && owner = @request.auth.id`

The update rule guards each relation only when the request submits it, so an edit that touches the verdict alone does not have to resubmit `eventId` or `artistId`. Each `?=` comparison correlates within one matched row, and the lookup resolves an event created by an earlier request of the same batch, which is what makes creating an event and its line-up in one transaction legal -- see [the server-behaviour journal entry](../journal/solutions/database-issues/pocketbase-batch-writes-and-field-shapes.md).

## Value Shapes On Read

Three stored values do not come back in the shape the client sent. `PocketBaseEventsRepository` normalises each at the read boundary, so a surface reads one shape whichever persistence mode produced it.

| Value                  | What the server returns                                           | The interface's canonical form            |
| ---------------------- | ----------------------------------------------------------------- | ----------------------------------------- |
| `performances.verdict` | `''` for an absent verdict, whether the write sent `''` or `null` | `null`                                    |
| `events.dateAttended`  | `2026-05-04 00:00:00.000Z` for a written `2026-05-04`             | the bare `YYYY-MM-DD` day                 |
| A line-up's order      | every row of one batch carrying the same `created` timestamp      | `position`, with `created,id` as tiebreak |

An empty `verdict` read as-is satisfies every `verdict !== null` test downstream, so the mapping to `null` is a correctness requirement rather than a convenience. The evidence for all three is in [the server-behaviour journal entry](../journal/solutions/database-issues/pocketbase-batch-writes-and-field-shapes.md).

## Instance Settings

The `/api/batch` endpoint is **disabled** in a default PocketBase instance. An event and all of its performance rows are written as one batch transaction, so `pocketbase/pb_migrations/1789067402_enable_batch.js` enables it and pins its two bounds:

| Setting             | Value | Meaning                                                 |
| ------------------- | ----- | ------------------------------------------------------- |
| `batch.enabled`     | true  | The `/api/batch` endpoint accepts requests              |
| `batch.maxRequests` | 50    | Maximum number of sub-requests in one batch             |
| `batch.timeout`     | 3     | Seconds to wait before cancelling the batch transaction |

Setting this in a migration rather than the dashboard keeps it reproducible in the Docker image: an instance that never applies the migration reads and lists events normally and refuses only to save one. The same two bounds are exported from `src/utils/event.ts` as `BATCH_MAX_REQUESTS` and `BATCH_TIMEOUT_SECONDS`, because the settings endpoint is superuser-only and the client cannot read them back from the server.

## Storage Keys

Current browser storage keys:

- `groovemark_auth_mode`
- `groovemark_locale`
- `groovemark:favorites:local`
- `groovemark:favorites:google:<userId>`
- `groovemark:artists:local`
- `groovemark:artists:google:<userId>`
- `groovemark:events:local`
- `groovemark:events:google:<userId>`

The events keys hold whole events with their performances nested, so a line-up is never a key of its own.

The app also contains a legacy migration path for the old `favorites` key when entering
local mode.

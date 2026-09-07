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

## Storage Keys

Current browser storage keys:

- `groovemark_auth_mode`
- `groovemark_locale`
- `groovemark:favorites:local`
- `groovemark:favorites:google:<userId>`
- `groovemark:artists:local`
- `groovemark:artists:google:<userId>`

The app also contains a legacy migration path for the old `favorites` key when entering
local mode.

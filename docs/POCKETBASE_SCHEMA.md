# Pocketbase Collection Schema

## Collection: favorites

This collection stores user favorites (music mixes/sets from YouTube and SoundCloud).

> **Note:** Artists from favorites and DJ names from events are unified into a single shared artist list within the application, enabling cross-feature filtering.

### Fields

| Field Name | Type            | Required | Description                                                   |
| ---------- | --------------- | -------- | ------------------------------------------------------------- |
| id         | Text (auto)     | Yes      | Auto-generated unique identifier                              |
| url        | URL             | Yes      | URL of the YouTube or SoundCloud mix                          |
| title      | Text            | Yes      | Title of the mix/set                                          |
| artists    | JSON            | No       | Array of artist names, e.g., `["Artist 1", "Artist 2"]`       |
| type       | Text            | Yes      | Platform type: either "youtube" or "soundcloud"               |
| thumbnail  | URL             | No       | URL to the thumbnail image                                    |
| timestamps | JSON            | No       | Array of timestamp objects with label, time, and rated fields |
| created    | DateTime (auto) | Yes      | Auto-generated creation timestamp                             |
| updated    | DateTime (auto) | Yes      | Auto-generated last update timestamp                          |

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
  "created": "2024-01-01 12:00:00.000Z",
  "updated": "2024-01-01 12:00:00.000Z"
}
```

### Collection Settings (Development)

For development purposes, you can use the following API Rules to allow access:

- **List/Search Rule**: `@request.auth.id != ""`
- **View Rule**: `@request.auth.id != ""`
- **Create Rule**: `@request.auth.id != ""`
- **Update Rule**: `@request.auth.id != ""`
- **Delete Rule**: `@request.auth.id != ""`

### Collection Settings (Production)

For production, implement proper authentication and authorization:

- Enable user authentication
- Update rules to restrict access to user's own records
- Consider using `@request.auth.id = owner` pattern if you add an owner field
- Enable HTTPS
- Configure CORS appropriately

---

## Collection: events

This collection stores live events/parties with DJ lineups and ratings.

### Fields

| Field Name | Type             | Required | Description                                              |
| ---------- | ---------------- | -------- | -------------------------------------------------------- |
| id         | Text (auto)      | Yes      | Auto-generated unique identifier                         |
| name       | Text             | Yes      | Name of the event/party                                  |
| venue      | Text             | No       | Venue or location name                                   |
| date       | Text             | No       | Event date in YYYY-MM-DD format                          |
| djs        | JSON             | No       | Array of DJ objects with name, score, and optional time  |
| owner      | Relation (users) | No       | Reference to the authenticated user who owns this record |
| created    | DateTime (auto)  | Yes      | Auto-generated creation timestamp                        |
| updated    | DateTime (auto)  | Yes      | Auto-generated last update timestamp                     |

### JSON Field Structures

#### djs

```json
[
  {
    "name": "DJ Example",
    "score": 3,
    "time": "23:30"
  },
  {
    "name": "Another DJ",
    "score": -1
  },
  {
    "name": "Third DJ",
    "score": 0
  }
]
```

Score values:

- `-1` -- Thumbs down (negative rating)
- `0` -- No rating
- `1` -- 1 heart
- `2` -- 2 hearts
- `3` -- 3 hearts

The `time` field is optional and represents the DJ's set time (e.g., "23:30").

### Example Record

```json
{
  "id": "evt456def",
  "name": "Warehouse Party",
  "venue": "Rex Club, Paris",
  "date": "2024-06-15",
  "djs": [
    {
      "name": "DJ Shadow",
      "score": 3,
      "time": "22:00"
    },
    {
      "name": "Bonobo",
      "score": 2,
      "time": "00:30"
    },
    {
      "name": "Opening Act",
      "score": -1,
      "time": "21:00"
    }
  ],
  "owner": "user123",
  "created": "2024-06-16 10:00:00.000Z",
  "updated": "2024-06-16 10:00:00.000Z"
}
```

### Collection Settings (Development)

Same rules as the `favorites` collection:

- **List/Search Rule**: `@request.auth.id != ""`
- **View Rule**: `@request.auth.id != ""`
- **Create Rule**: `@request.auth.id != ""`
- **Update Rule**: `@request.auth.id != ""`
- **Delete Rule**: `@request.auth.id != ""`

### Collection Settings (Production)

- Use `@request.auth.id = owner` to restrict access to the user's own records
- Enable HTTPS
- Configure CORS appropriately

---

## Migration from localStorage

If you have existing data in localStorage, you can:

- **Favorites** (key: `favorites`): Export using the "Export JSON" button, then import after setting up PocketBase
- **Events** (key: `groovemark_events`): Currently no built-in import/export for events; data will be used automatically when in local mode

The application will automatically sync with Pocketbase once it's available.

# Pocketbase Collection Schema

## Collection: favorites

This collection stores user favorites (music mixes/sets from YouTube and SoundCloud).

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

### Migration from localStorage

If you have existing data in localStorage (key: `favorites`), you can:

1. Export your favorites using the "Export JSON" button in the app
2. Start Pocketbase and create the collection
3. Use the "Import JSON" button to import your favorites

The application will automatically sync with Pocketbase once it's available.

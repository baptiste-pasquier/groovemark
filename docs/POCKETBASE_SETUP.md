# Pocketbase Setup

This application uses [Pocketbase](https://pocketbase.io/) as a backend for storing favorites.

## 1. Install Pocketbase

Download Pocketbase from [pocketbase.io/docs](https://pocketbase.io/docs/) for your operating system.

## 2. Start Pocketbase

Place the `pocketbase` executable in the root of the project (or in a `pb/` directory).

```sh
# Run the server
./pocketbase serve
```

By default, Pocketbase runs on `http://localhost:8090`.

## 3. Configure the Collection

1. Open the Pocketbase admin UI at `http://localhost:8090/_/`
2. Create a new collection named `favorites`
3. Add the following fields:
   - `url` (URL, required)
   - `title` (Text, required)
   - `artists` (JSON, optional) - for storing array of artist names
   - `type` (Text, required) - either "youtube" or "soundcloud"
   - `thumbnail` (URL, optional)
   - `timestamps` (JSON, optional) - for storing array of timestamp objects

See [Pocketbase Schema](./POCKETBASE_SCHEMA.md) for more details.

## 4. Configure API Rules (Optional)

For development, you can allow public access to the `favorites` collection:

- List/Search Rule: `@request.auth.id != ""`
- View Rule: `@request.auth.id != ""`
- Create Rule: `@request.auth.id != ""`
- Update Rule: `@request.auth.id != ""`
- Delete Rule: `@request.auth.id != ""`

For production, ensure proper authentication is enforced.

## 5. Environment Configuration

Copy `.env.example` to `.env` and update the Pocketbase URL if needed:

```sh
cp .env.example .env
```

Default configuration:

```
VITE_POCKETBASE_URL=http://localhost:8090
```

## Fallback to localStorage

If Pocketbase is not available, the application automatically falls back to using localStorage for data persistence. This provides offline support and ensures the app works even without a backend connection.

# PocketBase Setup

This application uses [PocketBase](https://pocketbase.io/) as the backend for
authenticated favorites and cloud sync. Local mode still works without PocketBase.

## 1. Install PocketBase

Download PocketBase from [pocketbase.io/docs](https://pocketbase.io/docs/) for your
operating system.

## 2. Start PocketBase

Place the `pocketbase` executable in the repository root and run:

```sh
./pocketbase serve
```

By default, PocketBase runs on `http://localhost:8090`.

If you prefer Docker:

```sh
cd docker
docker-compose up pocketbase -d
```

## 3. Configure the `favorites` Collection

1. Open the PocketBase admin UI at `http://localhost:8090/_/`
2. Create a new collection named `favorites`
3. Add the following fields:
   - `url` (URL, required)
   - `title` (Text, required)
   - `artists` (JSON, optional)
   - `type` (Text, required, either `youtube` or `soundcloud`)
   - `thumbnail` (URL, optional)
   - `timestamps` (JSON, optional)
   - `owner` (Relation to `users`, required)

PocketBase will also manage auto-generated fields such as `id`, `created`, and
`updated`.

See [Pocketbase Schema](./POCKETBASE_SCHEMA.md) for the full schema and example payloads.

## 4. Configure API Rules

Use user-scoped rules so authenticated users only read and write their own favorites:

- **List/Search Rule**: `@request.auth.id != "" && owner = @request.auth.id`
- **View Rule**: `@request.auth.id != "" && owner = @request.auth.id`
- **Create Rule**: `@request.auth.id != "" && @request.body.owner = @request.auth.id`
- **Update Rule**: `@request.auth.id != "" && owner = @request.auth.id`
- **Delete Rule**: `@request.auth.id != "" && owner = @request.auth.id`

This matches the current client behavior for authenticated sync and offline fallback.

## 5. Environment Configuration

Copy `.env.example` to `.env` and update the PocketBase URL if needed:

```sh
cp .env.example .env
```

Default configuration:

```sh
VITE_POCKETBASE_URL=http://localhost:8090
```

`VITE_POCKETBASE_URL` is embedded at build time, so rebuild the app after changing it.

## 6. Offline Cache and Fallback

The app uses separate local persistence modes:

- **Local mode** stores favorites in `groovemark:favorites:local`
- **Authenticated fallback** stores the signed-in user's offline cache in
  `groovemark:favorites:google:<userId>`

The app also contains a legacy migration path for the old `favorites` key when entering
local mode.

## 7. Authentication Integration

If you want Google SSO, continue with
[Authentication Setup](./AUTHENTICATION.md). That guide covers OAuth provider
configuration and the `users` collection flow.

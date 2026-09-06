---
title: PocketBase setup
type: how-to
audience: [human, agent]
status: stable
stale_after: 2026-12-20
---

# PocketBase Setup

This application uses [PocketBase](https://pocketbase.io/) as the backend for
authenticated favorites and cloud sync. Local mode still works without PocketBase.

## 1. Install PocketBase

Download PocketBase from [pocketbase.io/docs](https://pocketbase.io/docs/) for your
operating system.

## 2. Start PocketBase

Place the `pocketbase` executable in `pocketbase/` and run:

```sh
cd pocketbase
./pocketbase serve
```

Run it from the `pocketbase/` directory as shown -- PocketBase resolves `pb_migrations` relative to its working directory, and this is the invocation that keeps it reading the same `pocketbase/pb_migrations/` directory the Docker build copies from.

By default, PocketBase runs on `http://localhost:8090`.

If you prefer Docker:

```sh
cd docker
docker-compose up pocketbase -d
```

The Docker setup pins PocketBase `v0.40.2` by default. Back up `pocketbase/pb_data` before
upgrading an existing instance to a newer server release.

## 3. The `favorites` Collection

The migrations in `pocketbase/pb_migrations/` create the `favorites` collection and its API rules automatically the first time PocketBase starts -- no admin UI setup step is required. The collection has the following fields:

- `url` (URL, required)
- `title` (Text, required)
- `artists` (JSON, optional)
- `type` (Text, required, either `youtube` or `soundcloud`)
- `thumbnail` (URL, optional)
- `timestamps` (JSON, optional)
- `owner` (Relation to `users`, required)
- `created_at` (Date, required) -- the favorite's creation date, preserved on import; unlike
  `created`/`updated` below, it is client-settable and not auto-generated

PocketBase also manages auto-generated fields such as `id`, `created`, and
`updated`.

See [Pocketbase Schema](../reference/pocketbase-schema.md) for the full schema and example payloads.

### Adding a new migration

To change the schema:

1. Start PocketBase locally as shown in step 2 above (`cd pocketbase && ./pocketbase serve`).
2. Make the change through the admin UI, or run `./pocketbase migrate collections` to snapshot the current schema into a new migration file. Either way, PocketBase writes the generated file into `pocketbase/pb_migrations/`.
3. Commit the generated migration file.
4. Rebuild the Docker image (dev) or merge to `main`/`develop` to trigger the CI build and redeploy (production) to ship it -- see [Docker Deployment](./docker-deployment.md#pocketbase-image-dockerfilepocketbase).

## 4. API Rules

The migrations set these user-scoped rules so authenticated users only read and write their own favorites -- no manual configuration is required:

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

See [PocketBase Schema](../reference/pocketbase-schema.md#storage-keys) for the full list of
storage keys and the legacy migration note.

## 7. Authentication Integration

If you want Google SSO, continue with
[Authentication Setup](./authentication-setup.md). That guide covers OAuth provider
configuration and the `users` collection flow.

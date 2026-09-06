---
title: Architecture notes
type: explanation
audience: [human, agent]
status: stable
stale_after: 2026-12-15
---

# Architecture Notes

This document captures the application-level behavior that complements the high-level
architecture overview in the main [README](../../README.md).

## Bootstrap Flow

The app resolves locale, auth state, and favorites readiness before rendering the main
UI. This keeps the shell from rendering an inconsistent state while stores are still
hydrating.

## App States

The main shell explicitly transitions through three states:

- `booting`
- `unauthenticated`
- `ready`

This keeps startup behavior predictable and separates login flow from the main
application view.

A failure during bootstrap or authenticated-session initialization recovers to
`unauthenticated` rather than leaving the shell stuck on `booting`: `useAppStore` clears the
auth session and favorites state and surfaces an alert, then the user lands back on the
login screen instead of a permanent loading spinner.

## Persistence Model

The persistence strategy is intentionally split by auth mode:

- PocketBase is the source of truth for authenticated sessions when available
- `localStorage` is the source of truth for local mode
- Authenticated offline fallback uses a user-scoped cache

This avoids mixing anonymous favorites with authenticated user data.

The authenticated offline fallback (`google-cache` mode) is read-only: `useFavoritesStore`
blocks add/edit/delete/import while backend is unavailable, since the cache has no queue to
replay writes against PocketBase once the connection returns. Reconnecting always treats the
PocketBase list as the source of truth and re-mirrors it into the cache.

## Storage Keys

See [PocketBase Schema](../reference/pocketbase-schema.md#storage-keys) for the current
list of browser storage keys and the legacy migration note.

## Import Flow

JSON parsing and validation happen before favorites are written. Invalid files surface a
UI alert instead of mutating state.

In cloud mode, records are created sequentially through the repository behind a shared
`ImportRateLimiter` (in `useFavoritesStore`). A create rejected by the backend's rate limit
is retried with escalating backoff; a successful create resets the limiter back to full
speed for the rest of the batch, rather than every following item paying the same delay.
`useFavoritesStore.importProgress` exposes a live `{ processed, total }` count (`total` is
`null` while the file is still being parsed) so the UI can show the import is still running
instead of appearing to hang, and disables the import control for the same window.

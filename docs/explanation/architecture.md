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

## Artist Identity

An artist is a first-class PocketBase record (`artists`), not a name copied into each
favorite. A favorite references artists by `artistIds`, a multi-select relation; the
existing `artists` text column stays as a denormalized display-name mirror, written on every
save, so export and the card's display never need a live join.

`useArtistsStore` loads independently from `useAppStore`'s bootstrap, not from inside
`useFavoritesStore` -- the store-responsibility split in `AGENTS.md` scopes bootstrapping to
`useAppStore` and favorites to `useFavoritesStore`. A failed artists load does not sign the
user out or show an empty artist list: it puts the session into read-only mode through a
`degradedReadOnly` flag `useFavoritesStore` owns, because a writable UI over an empty
resolution index would recreate artists that already exist server-side and collide with the
`(owner, slug)` unique index.

`selectRepositories()` (in `favoritesRepository.ts`) returns one favorites repository pair,
one artists repository pair, and one mode from a single call, so the two domains can never
independently disagree about being in cache mode. `useFavoritesStore` and `useArtistsStore`
each call it once, with the same session context, rather than one store handing the other a
result.

The artists cache (`groovemark:artists:local` / `groovemark:artists:google:<userId>`) is
mirrored from `useArtistsStore` -- after a successful load, and after every artist create --
rather than populated independently, because it is the only writer: nothing else in the app
ever touches that storage key, so a second writer would only be a second place the mirror
could drift from what `useArtistsStore.artists` actually resolved.

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

Importing also resolves artist names. Every distinct name across the whole file is resolved
to an artist identity in one pass before any favorite is created, so two rows crediting the
same name (once case, accents, and whitespace are normalized away) collapse into one artist
named by the most frequent spelling in the file; an existing artist always wins over the
file's own election. Artist creates share the same `ImportRateLimiter` and retry path as
favorite creates, drawing on the same budget rather than a second, unpaced burst of
requests. A row whose artist cannot be created is left unimported rather than credited with
fewer artists than the file lists.

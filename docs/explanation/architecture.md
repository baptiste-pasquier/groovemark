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

The app resolves locale, auth state, and the readiness of the favorites, artists and events
stores before rendering the main UI. This keeps the shell from rendering an inconsistent state
while stores are still hydrating. The three domain loads are awaited together, and each swallows
its own failure rather than rejecting -- a rejection here lands in the recovery path, which signs
the operator out, so one unreadable blob would end a session whose other halves loaded perfectly.

## App States

The main shell explicitly transitions through three states:

- `booting`
- `unauthenticated`
- `ready`

This keeps startup behavior predictable and separates login flow from the main
application view.

A failure during bootstrap or authenticated-session initialization recovers to
`unauthenticated` rather than leaving the shell stuck on `booting`: `useAppStore` clears the
auth session and every domain store's state and surfaces an alert, then the user lands back on the
login screen instead of a permanent loading spinner.

## Persistence Model

The persistence strategy is intentionally split by auth mode:

- PocketBase is the source of truth for authenticated sessions when available
- `localStorage` is the source of truth for local mode
- Authenticated offline fallback uses a user-scoped cache

This avoids mixing anonymous favorites with authenticated user data.

The authenticated offline fallback (`google-cache` mode) is read-only, because the cache has
no queue to replay writes against PocketBase once the connection returns. Reconnecting always
treats the PocketBase list as the source of truth and re-mirrors it into the cache.

`useAppStore.isReadOnly` is the one switch that decides this, derived rather than pushed, over
five inputs: the load-failure flag of each of the three domain stores, plus the effective mode
favorites and events are actually running in after a fallback.

Both kinds of input are load bearing. The flags alone would leave a session that started in
cache mode writable over that cache; the modes alone would miss a domain whose own load failed
and fell back, which is the only way artists can diverge -- one `selectRepositories()` call
hands all three domains the same initial mode, so the artists store reports no mode of its own.

`useFavoritesStore.isReadOnly` is a pass-through to that switch and owns no state, so no second
switch exists to disagree with the first.

## Artist Identity

An artist is a first-class PocketBase record (`artists`), not a name copied into each
favorite. A favorite references artists by `artistIds`, a multi-select relation; the
existing `artists` text column stays as a denormalized display-name mirror, written on every
save, so export and the card's display never need a live join.

`useArtistsStore` loads independently from `useAppStore`'s bootstrap, not from inside
`useFavoritesStore` -- the store-responsibility split in `AGENTS.md` scopes bootstrapping to
`useAppStore` and favorites to `useFavoritesStore`. A failed artists load does not sign the
user out or show an empty artist list: it puts the session into read-only mode through
`useArtistsStore.loadFailed`, one of the five inputs `useAppStore.isReadOnly` reads, because a
writable UI over an empty resolution index would recreate artists that already exist
server-side and collide with the `(owner, slug)` unique index.

`selectRepositories()` (in `favoritesRepository.ts`) returns a favorites, an artists and an
events repository pair, plus one mode, from a single call. `useAppStore` computes that selection
exactly once per session initialization and hands the same object to all three domain stores, so
no two domains can independently resolve a different mode for one session.

The artists cache (`groovemark:artists:local` / `groovemark:artists:google:<userId>`) is
mirrored from `useArtistsStore` -- after a successful load, and after every artist create --
rather than populated independently, because it is the only writer: nothing else in the app
ever touches that storage key, so a second writer would only be a second place the mirror
could drift from what `useArtistsStore.artists` actually resolved.

## Events And Performances

A night out is two PocketBase collections, not one record with a nested array: `events` holds
the night, and each `performances` row holds one artist's appearance at it. The event relation
cascades on delete so removing a night removes its whole line-up with no cleanup code; the
artist relation does not, because an artist outlives the performances crediting it and nothing
in the app deletes an artist. See
[PocketBase Schema](../reference/pocketbase-schema.md#collection-performances) for the fields
and rules.

`EventsRepository` speaks only in whole events, line-up included, so no store, export or import
path ever assembles a performance row. That is what lets local mode nest performances under
their event in one storage key while the cloud path keeps two normalized collections, without a
caller branching on mode. `update` takes the complete line-up and diffs it: a row carrying a
known id is edited in place, one without gets a freshly minted id, and a stored row absent from
the input is deleted.

A cloud event and its line-up are written in one `POST /api/batch` transaction, so a save
either lands whole or leaves nothing behind. The alternative -- sequential writes with a
compensating delete -- can fail in its compensation, and what it leaves behind is an event with
a partial line-up, which is exactly what saving as a whole forbids. The event id is therefore
minted client-side, because no request in a batch can reference an id the server would generate
for an earlier request in the same batch.

Two batch failures name themselves rather than surfacing as a generic refusal.
`PocketBaseEventsRepository` counts the sub-requests a save needs and refuses an over-sized
batch before sending anything, so the operator is told to split the line-up; and a batch
endpoint left disabled answers `403` where a rule rejection answers `400`, so it maps to its own
message naming the migration to apply. Deleting an event is deliberately not a batch: the event
relation cascades, so a delete never depends on the endpoint being enabled.

State is split the same way the mixes destination splits it. `useEventsStore` owns events domain
data -- load, save, delete, the import pass and the per-artist performance views --
`useEventsUiStore` owns the events tab's search and the direction it is read in -- the ordering
itself stays in `useEventsStore`, so the UI store filters, then reverses what the filter left.
`useArtistsUiStore` owns slug lookup for the artist address plus the artists table's sort, search
and single column descriptor.

Every per-artist number is read from the store that owns it rather than derived a second time:
the artist page and the artists table both read the live half from
`useEventsStore.performanceAggregateFor` and the mixes half from
`useFavoritesUiStore.mixAggregateFor`, so the page and the table cannot report different values
for the same performer.

An artist a performance names is created only after the event holding it has saved, so a save
that fails does not leave a new artist behind as a suggestion.

## Navigation

The app has three top-level destinations -- mixes, events, artists -- plus an addressable
artist page, on `vue-router` 4 with HTML5 history whose base comes from the build, so the
subpath deploy and the container image work from one source. The boot state machine stays the
outer gate: `booting` and `unauthenticated` short-circuit before any route renders.

An artist address is keyed on the artist's **slug** and is always built from the named route
plus a `slug` param, never by concatenation. A slug is a folded display name rather than a URL
token -- `AC/DC` folds to `ac/dc` -- so it resolves only percent-encoded, which is what the
router does for a param and not for a hand-built string.

The header is rendered by each destination view rather than by `App.vue`, because a route
outlet cannot forward the emits the artist sidebar needs. The sidebar artist filter, the mixes
search and the grid sort are therefore derived from the active destination rather than threaded
through a prop, so every destination added later starts out without them; locale, import, export
and sign-out stay app-level and appear everywhere.

An unresolved artist address means two different things and the page says which: with the
artist set loaded it is "no such artist", and with the load failed it is "cannot say", because
the events tab still renders fully from its denormalized names and would otherwise look healthy
beside a page reading as not-found.

## Storage Keys

See [PocketBase Schema](../reference/pocketbase-schema.md#storage-keys) for the current
list of browser storage keys and the legacy migration note.

## Backup Flow

A backup file is one envelope carrying both domains: `{ formatVersion: 1, mixes: [...],
events: [...] }`. An import reads the version first and nothing else until it matches, so a
bare array, a string, or an envelope declaring an unknown version is refused whole rather than
read partially -- and the refusal spells out the envelope, which is how an older export is
brought forward by hand. This is a deliberate break with the previous shape, which had no
version to recognize; see
[ADR-0003](../journal/decisions/0003-events-and-performances-as-records.md).

An exported event credits its performers by display name alone. A relation id is local to one
account and one instance, so leaving it out is what lets a backup restore onto a different
account, exactly as a mix's artist names already did.

A restore resolves the whole file's artists in one pass, then the mixes, then the events, so a
performance credits the same record a mix in the same file does. A performance name resolves an
artist like any name but votes on the winning spelling only when that artist has no mix-side
name in the file; otherwise several casual spellings across one line-up could rename an artist
whose mixes spell it properly. An event whose line-up exceeds the transaction's request bound is
reported as a failed row rather than split across transactions, and an event naming an artist
that could not be resolved is left unimported rather than credited with fewer performers.

Importing is an app-level action, handled in the header where the file input, the disabled
state and the progress label already live, rather than a mixes-destination one -- one file
restores both domains, so a per-destination wiring would leave the menu item dead on the events
and artists tabs.

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

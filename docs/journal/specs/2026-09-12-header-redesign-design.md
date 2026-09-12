---
title: 'feat: Header redesign — unified account menu and shared controls row'
date: 2026-09-12
type: feat
status: draft
---

# feat: Header redesign — unified account menu and shared controls row

## Summary

The header sheds everything that is not identity. The search field, the calendar sort and the
create button leave it for a controls row that the three destinations share, and the account
badge, the settings button and the logout button collapse into one avatar menu carrying a status
dot. On a phone this removes two rows above the first card, and it gives the mixes tab the same
controls row the events and artists tabs already have.

---

## Problem Frame

The mixes tab puts its search field and its create button in the left sidebar, while the events
and artists tabs put theirs in a row above the grid. The same two controls therefore sit in two
different places depending on which tab is open, and the mixes tab mounts its create button
twice — once for the sidebar, once for a phone-only row.

The calendar sort sits in the header, far from the list it orders, and only the mixes tab has one
at all: the events tab offers no way to read a history oldest-first.

The signed-in header carries four separate identity controls — a progress pill, a mode or status
badge, a settings button and a red logout button. On a phone they wrap onto two rows, and with
the title, the subtitle, the destination tabs, the search field and the create button, five rows
stand between the top of the screen and the first card.

---

## Requirements

- **R1.** The mixes, events and artists tabs present their search field at the same size, in a row
  of the same shape, in the same place.
- **R2.** The calendar sort sits beside the search field it orders, on the mixes tab and on the
  events tab.
- **R3.** A signed-in session has exactly one identity control in the header.
- **R4.** That control reports, without being opened, whether the session is synchronised,
  read-only, or importing.
- **R5.** A local-mode session keeps a distinct warning badge and a distinct settings button, and
  keeps a way back to the sign-in screen.
- **R6.** On a phone, at most three rows stand between the top of the screen and the first card.
- **R7.** No destination loses a control it has today.

---

## Validated Design Decisions

Each was chosen from mockups, recorded here with the alternative it beat.

| Decision            | Chosen                                                  | Rejected                                             |
| ------------------- | ------------------------------------------------------- | ---------------------------------------------------- |
| Account trigger     | Round avatar with a status dot at its lower right       | Name pill with a dot; icon button with a dot         |
| Avatar content      | The Google photo, initial letter as fallback            | Initial letter only                                  |
| Mixes controls row  | Spans the sidebar and the grid together                 | Starts to the right of the sidebar                   |
| Search field size   | 38px tall, capped at 24rem                              | 46px (today); 34px; full width                       |
| Row alignment       | Left, empty space at the right                          | Right-aligned; create button pushed to the far right |
| Phone create button | Keeps its full width and its label                      | Reduced to a square `+` in the controls row          |
| Local-mode exit     | Last item of the settings menu                          | Red button kept in the header; removed entirely      |
| Avatar position     | Beside the tabs on desktop, beside the title on a phone | One position at every width                          |

The avatar renders the Google photo, falling back to the first letter of the display name on a
tinted disc.

The photo is the `avatar` file field of the `users` collection, which the Google OAuth2 flow
populates. It is unprotected, so no file token is needed:

```ts
pb.files.getURL(user, user.avatar, { thumb: '100x100' })
```

Two guards, both load bearing. The URL is built only when `user.avatar` is a non-empty string —
a record signed in before the provider returned a photo has none, and the SDK would otherwise
produce an address ending in a bare slash. And an `error` on the image falls back to the initial,
because the address stays valid-looking after the file is removed server-side.

`thumb` takes any `WxH`, and PocketBase serves the original when it cannot produce that size —
which is what happens for the `image/svg+xml` the field also accepts. The fallback is the
server's, so nothing here has to special-case it.

---

## Components

`src/components/layout/` gains four components. `HeaderBar.vue` keeps the logo, the title, the
subtitle and the destination tabs, and nothing else.

| Component              | Rendered when                  | Contents                                                                                                                                         |
| ---------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `AccountMenu.vue`      | `authMode === 'google'`        | Trigger: avatar + status dot. Panel: "signed in as" + email, status chip, `AppMenuItems`, sign out.                                              |
| `LocalModeMenu.vue`    | `authMode === 'local'`         | Trigger: settings button at today's gabarit. Panel: `AppMenuItems`, leave local mode. The warning badge stays a sibling, outside this component. |
| `AppMenuItems.vue`     | inside both panels             | Language, import, export. One copy, so the two panels cannot drift.                                                                              |
| `SortToggleButton.vue` | mixes and events controls rows | The calendar icon button. Props `order`, emits `toggle`. One pair of i18n keys for both destinations.                                            |

The dropdown keeps the pattern already in `HeaderBar.vue` — absolutely positioned panel plus a
fixed backdrop that closes it. The header is not `sticky` and creates no stacking context, so the
portal and focus trap that `tablemarks` uses in `src/features/account/AccountMenu.tsx` would
solve a problem GrooveMark does not have.

### Status dot

One computed over sources that already exist. It introduces no state and no second read-only
switch, so the rule in `AGENTS.md` that `useAppStore.isReadOnly` is the only switch still holds.

| Condition                       | Dot   | Chip text in the open panel               |
| ------------------------------- | ----- | ----------------------------------------- |
| `favoritesStore.importProgress` | blue  | the existing importing label, with counts |
| `appStore.isReadOnly`           | amber | `auth.offline_read_only`                  |
| otherwise                       | green | `auth.status_synced` (new key)            |

The dot signals; it never explains. The full wording lives in the open panel only.

---

## Layout

### Shared classes and tokens

`.artists-controls` is renamed `.view-controls` and adopted by all three destinations. The
convention in `docs/conventions/frontend-layout.md` requires the rename in one change: pin each
surface's rendering with a test that does not name the class, grep the whole tree including
`src/assets/tailwind.css`, the templates, `src/__tests__/`, `e2e/` and `docs/`, then rename and
re-point every occurrence together.

| Name                        | Value                                                | Purpose                                                              |
| --------------------------- | ---------------------------------------------------- | -------------------------------------------------------------------- |
| `--layout-search-max-width` | `24rem`                                              | caps the search field on all three destinations                      |
| `.view-controls`            | flex column, row from `sm`                           | the shared controls row                                              |
| `.view-search`              | capped width, `py-2`                                 | the shared search field, 46px → 38px                                 |
| `.mixes-body`               | the width recipe `.favorites-header` already carries | wraps the mixes row and the mixes layout so both share one left edge |

`.favorites-mobile-controls` is deleted. `.favorites-layout` loses its own `mx-auto` and `w-fit`,
which move up to `.mixes-body`.

### Mixes structure

```
<HeaderBar />
<div class="mixes-body">
  <div class="view-controls">     search · sort · filter (phone only) · create
  <div class="favorites-layout">
    <aside class="favorites-sidebar-desktop">   artist list alone
    <main class="favorites-main">               FavoritesGrid
```

`AddFavoriteButton` is mounted once instead of twice. Both copies are in the DOM today and only
one is ever visible, so `getByRole('button', { name: 'Nouveau favori' })` in
`e2e/favorite-creation.spec.ts` still resolves to one element — this is a simplification, not a
bug fix.

The phone-only filter button moves into the controls row, keeping `.favorites-desktop-hidden`.
`MixesView.vue` opens its own sidebar, so `HeaderBar.vue` loses the `openFilters` emit entirely.

### Header

The subtitle takes `hidden sm:block`. The avatar is mounted beside the tabs from `sm` up and
beside the title below it.

---

## Stores

`useEventsUiStore` gains `sortOrder` (`'newest' | 'oldest'`), `toggleSort()`, and reverses
`filteredEvents` when the order is `oldest`. `$reset()` returns it to `'newest'`.

The canonical ordering by `dateAttended` stays in `useEventsStore`, as R11 requires: the UI store
filters and reverses, it never orders. This mirrors how `useFavoritesUiStore` already treats the
mixes list.

The sort is not cleared when the tab is left. Only the search is, through the single
`router.afterEach` guard in `src/router/index.ts` — the sort stays visible in its own control, so
it cannot lie about what is ordering the list.

No other store changes. `useAuthStore.signOut()` already serves both the sign-out item and the
leave-local-mode item.

---

## i18n

New keys in `src/i18n/locales/en.json` and `fr.json`:

| Key                      | Purpose                                   |
| ------------------------ | ----------------------------------------- |
| `auth.account_menu_aria` | accessible name of the avatar trigger     |
| `auth.status_synced`     | the green state, written out in the panel |
| `auth.exit_local_mode`   | the last item of the local-mode menu      |

`auth.signed_in_as`, `auth.offline_read_only`, `auth.local_mode`, `app.settings`,
`app.sort_toggle_title_newest` and `app.sort_toggle_title_oldest` are reused as they are. The
sort keys are deliberately shared by both destinations rather than duplicated per tab.

`src/__tests__/locales.spec.ts` already asserts the two locale files agree, so it covers the new
keys without modification.

---

## Tests

| File                                                         | Change                                                                                                                             |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| `src/__tests__/HeaderBar.spec.ts`                            | rewritten: no sort or filter button; avatar menu in google mode; badge plus settings menu in local mode                            |
| `src/__tests__/AccountMenu.spec.ts`                          | new: the three dot states, the panel contents, sign out, and the avatar's three renderings — photo, no `avatar` value, image error |
| `src/__tests__/LocalModeMenu.spec.ts`                        | new: the panel contents and leaving local mode                                                                                     |
| `src/__tests__/MixesView.spec.ts`                            | the sort and filter buttons now belong to the view; the create button is mounted once                                              |
| `src/__tests__/EventsGrid.spec.ts`                           | the sort button is present and toggles                                                                                             |
| `src/__tests__/eventsUi.spec.ts`                             | `toggleSort` reverses the list; `$reset` restores newest-first                                                                     |
| `src/__tests__/artistsUi.spec.ts` and `ArtistsTable.spec.ts` | pin the artists controls rendering before the `.artists-controls` rename                                                           |

No Playwright spec references a control that moves. `#add-event-btn`, `#artists-search`,
`#artists-sort-select` and the artists sort headers all keep their identifiers and their places.

---

## Documentation

| File                                                            | Update                                                                                             |
| --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `docs/reference/responsive-layout.md`                           | `.view-controls`, `.view-search`, `.mixes-body`, the new token, and the `.artists-controls` rename |
| `docs/explanation/architecture.md`                              | the sort `useEventsUiStore` now owns                                                               |
| `AGENTS.md`                                                     | the same, in the store-responsibilities list                                                       |
| `docs/journal/decisions/0004-one-account-menu-in-the-header.md` | new ADR: one account menu replaces four identity controls                                          |
| `CHANGELOG.md`                                                  | the user-facing change                                                                             |

---

## Out of Scope

The artists tab keeps sorting through its column headers and its phone-width select; no calendar
sort is added there. The header does not become sticky. No control gains a keyboard shortcut.

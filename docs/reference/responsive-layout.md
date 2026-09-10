---
title: Responsive layout tokens
type: reference
audience: [human, agent]
status: stable
stale_after: 2026-12-10
---

# Responsive Layout Notes

This document explains the desktop and tablet layout sizing used by GrooveMark's card
destinations: the mixes view and the events view.

## Source Of Truth

Layout tokens live in [src/assets/tailwind.css](../../src/assets/tailwind.css).

```css
@theme {
  --breakpoint-layout-2col: 65.5rem;
  --breakpoint-layout-3col: 87rem;
  --breakpoint-layout-4col: 108.5rem;
  --layout-shell-2col: 65.5rem;
  --layout-shell-3col: 87rem;
  --layout-shell-4col: 108.5rem;
  --layout-sidebar-width: 18rem;
  --layout-card-width: 20rem;
  --layout-desktop-gap: 2rem;
  --layout-grid-gap: 1.5rem;
  --layout-grid-width-2col: calc(var(--layout-card-width) * 2 + var(--layout-grid-gap));
  --layout-switcher-padding: 0.1875rem;
  --layout-switcher-radius: 0.625rem;
}
```

## Token Meaning

- `--layout-sidebar-width`: desktop sidebar width.
  `18rem = 288px`
- `--layout-card-width`: fixed card width.
  `20rem = 320px`
- `--layout-desktop-gap`: gap between sidebar and content area.
  `2rem = 32px`
- `--layout-grid-gap`: gap between cards in the grid.
  `1.5rem = 24px`
- `--layout-grid-width-2col`: width of two cards plus one grid gap.
  `20rem * 2 + 1.5rem = 41.5rem`
- `--layout-switcher-padding`: inner padding of the destination switcher track.
  `0.1875rem = 3px`
- `--layout-switcher-radius`: outer corner radius of the destination switcher track.
  `0.625rem = 10px`

## Shell Width Formula

The shell width includes:

1. Left page padding
2. Sidebar width
3. Desktop gap between sidebar and content
4. Grid width
5. Right page padding

Desktop page padding comes from `md:p-8`, which means `2rem` on the left and `2rem` on the
right, so `4rem` total.

### Two Columns

```text
shell = sidebar + desktop gap + grid(2 cards) + page padding
      = 18rem + 2rem + 41.5rem + 4rem
      = 65.5rem
```

### Three Columns

```text
grid width = 20rem * 3 + 1.5rem * 2 = 63rem
shell      = 18rem + 2rem + 63rem + 4rem = 87rem
```

### Four Columns

```text
grid width = 20rem * 4 + 1.5rem * 3 = 84.5rem
shell      = 18rem + 2rem + 84.5rem + 4rem = 108.5rem
```

## Breakpoint Strategy

The app does not switch to `3` or `4` columns on Tailwind's default `xl` or `2xl` breakpoints.
Instead, it switches only when the full shell can actually fit.

- `layout-2col`: desktop layout with sidebar + 2 cards
- `layout-3col`: desktop layout with sidebar + 3 cards
- `layout-4col`: desktop layout with sidebar + 4 cards

This avoids:

- cards shrinking before wrapping
- header and grid using different effective widths
- desktop sidebar appearing before there is enough room

## Mobile And Tablet Behavior

Before the desktop sidebar appears, the page uses a simpler stacked layout.

### Small Mobile

Below `md` (`48rem` / `768px`):

- `.app-shell` uses page padding only:
  - `p-4` by default
  - `sm:p-6` from `40rem`
- `.favorites-header` is stacked vertically, then becomes a horizontal row at `sm`
- `.favorites-main` stays fluid with `w-full`
- `.favorites-mobile-controls` is visible above the grid
- `.card-grid` uses `grid-cols-1`

This means the page is full-width, minus the shell padding.

### Tablet / Two-Column Pre-Desktop Stage

From `md` (`48rem` / `768px`) up to `layout-2col` (`65.5rem`):

- `.favorites-header` is centered and constrained to `--layout-grid-width-2col`
- `.favorites-main` is centered and constrained to `--layout-grid-width-2col`
- `.favorites-mobile-controls` is still visible
- `.card-grid` becomes exactly `2` fixed-width cards
- `.favorites-sidebar-desktop` is still hidden
- `.favorites-desktop-hidden` keeps the mobile filter button visible

This is the stage where:

- search
- add button
- header block
- two-card grid

all share the same effective width.

### Desktop Sidebar Stage

From `layout-2col` (`65.5rem`) and up:

- `.favorites-layout` becomes a row
- `.favorites-sidebar-desktop` becomes visible
- `.favorites-mobile-controls` is hidden
- `.favorites-header` returns to full shell width
- `.favorites-main` returns to auto width inside the desktop layout

At this point the page is no longer centered around the `2`-column grid width, but around the
full desktop shell width.

## Shared Card Grid

`.card-grid` is the single owner of the card column progression: one column below `md`, then
`2`, `3` and `4` fixed-width columns at `md`, `layout-3col` and `layout-4col`. The mixes grid
and the events grid both carry it, so one breakpoint change reaches both surfaces. The class is
named after what it lays out rather than after either destination, and neither grid template
carries a raw breakpoint literal.

Each grid keeps its own element id, `#favorites-grid` and `#events-grid`, so a test or a script
addresses one surface without addressing the layout.

The two grids differ in one respect, deliberately:

| Grid                    | Rendering                                                |
| ----------------------- | -------------------------------------------------------- |
| `FavoritesGrid` (mixes) | batches of 20 behind an `IntersectionObserver` sentinel  |
| `EventsGrid` (events)   | every card in one pass, no batch counter and no sentinel |

The mixes grid batches because a mixes collection reaches the card count where rendering all of
them at once costs a phone visibly. A list of nights attended does not reach that scale, so the
events grid iterates plainly. Batching the events grid is a change to make if that list ever
grows that large, not an omission to correct.

## Destination Switcher

The three top-level destinations (mixes, events, artists) are one segmented control, the same
object at every width. It lives in the header's control row, so it shares that row with the
sort button, the mobile filter button, the settings menu and the sign-out button.

`.favorites-header-controls` wraps that row, so the switcher never pushes the other controls
off screen: below `md` it takes a whole line and the buttons wrap onto the next one.

The switcher itself has two forms, driven by one class:

- Below `md` (`48rem` / `768px`): `.destination-switcher` is `w-full` and each
  `.destination-tab` is `flex-1`, so the three tabs span the full width and share it equally.
- From `md` and up: the track is `w-auto` and each tab is `flex-none`, so the tabs size to
  their labels and the switcher sits inline beside the other header controls.

`.destination-tab-active` marks the current destination with a white fill, a heavier weight and
a small shadow. The active tab also carries `aria-current="page"`, so the state does not depend
on colour alone. An artist page keeps the artists tab marked.

## Utility Scale Reminder

Tailwind spacing is based on `0.25rem`.

- `p-4 = 1rem`
- `p-6 = 1.5rem`
- `p-8 = 2rem`
- `gap-6 = 1.5rem`
- `w-72 = 18rem`

Responsive prefixes are mobile-first:

- `sm`: `40rem` / `640px`
- `md`: `48rem` / `768px`
- `lg`: `64rem` / `1024px`
- `xl`: `80rem` / `1280px`
- `2xl`: `96rem` / `1536px`

Example:

```text
p-4 sm:p-6 md:p-8
```

means:

- default padding: `1rem`
- from `sm` and up: `1.5rem`
- from `md` and up: `2rem`

## Reusable Classes

These classes translate the tokens into layout behavior:

- `.app-shell`: global page shell width and page padding
- `.favorites-header`: shared width for header before sidebar appears
- `.favorites-layout`: desktop row layout
- `.favorites-sidebar-desktop`: desktop sidebar
- `.favorites-main`: main content width before and after desktop sidebar
- `.favorites-mobile-controls`: search/add controls above the grid before desktop sidebar
- `.card-grid`: shared fixed-width card grid at 2/3/4 columns, carried by both the mixes
  grid and the events grid
- `.favorites-header-controls`: wrapping header control row that holds the destination switcher
- `.destination-switcher`: segmented track for the three destinations, full width below `md`
- `.destination-tab`: one destination tab inside the track
- `.destination-tab-active`: the current destination's tab

## Editing Guidance

See [Frontend Layout Conventions](../conventions/frontend-layout.md) for the rule on
changing these tokens.

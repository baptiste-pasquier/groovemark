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
  --layout-artist-section-gap: 2.5rem;
  --layout-table-cell-padding-x: 0.75rem;
  --layout-table-cell-padding-y: 0.625rem;
  --layout-table-name-min-width: 11rem;
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
- `--layout-artist-section-gap`: gap between the artist page's two stacked halves.
  `2.5rem = 40px`
- `--layout-table-cell-padding-x`: horizontal padding inside an artists-table cell.
  `0.75rem = 12px`
- `--layout-table-cell-padding-y`: vertical padding inside an artists-table cell.
  `0.625rem = 10px`
- `--layout-table-name-min-width`: floor on the artists table's name column.
  `11rem = 176px`

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

## Header Layout

`.favorites-header` is one `flex flex-wrap` row carrying three slots, each marked with a
`data-header-slot` attribute: `brand`, `identity`, `tabs`. `HeaderIdentity` mounts once, inside
the `identity` slot -- never twice behind a hidden/visible pair, which would duplicate every id
beneath it (the import control is a `<label for>` bound to an `<input id>`, which a duplicate id
breaks). See [ADR-0004](../journal/decisions/0004-one-account-menu-in-the-header.md).

- Below `sm` (`40rem` / `640px`): the `tabs` slot is `basis-full` and wraps onto its own row,
  leaving `brand` and `identity` sharing the first row beside the title.
- From `sm` up: the row stays single. `identity` carries `sm:order-last`, so it moves past
  `tabs` to the end of the row.

One mount, two positions, driven by flex order and wrapping rather than by a second template.

Local mode adds a warning badge beside the settings button inside the `identity` slot. From `md`
the badge is `absolute top-full right-0`, hanging under the row and right-aligned on that button,
so the header's bottom margin absorbs it and the controls row below keeps its place. The slot
carries `relative` as its anchor. Below `md` the badge stays in the flex row, left of the button.

## Mobile And Tablet Behavior

Before the desktop sidebar appears, the page uses a simpler stacked layout.

### Small Mobile

Below `md` (`48rem` / `768px`):

- `.app-shell` uses page padding only:
  - `p-4` by default
  - `sm:p-6` from `40rem`
- `.favorites-header` wraps its `tabs` slot onto its own row; see Header Layout above
- `.favorites-main` stays fluid with `w-full`
- `.view-controls` stacks: search + sort + filter on one line, then the create button
- `.card-grid` uses `grid-cols-1`

This means the page is full-width, minus the shell padding.

### Tablet / Two-Column Pre-Desktop Stage

From `md` (`48rem` / `768px`) up to `layout-2col` (`65.5rem`):

- `.favorites-header` is centered and constrained to `--layout-grid-width-2col`
- `.favorites-main` is centered and constrained to `--layout-grid-width-2col`
- `.view-controls` is a single row above the grid
- `.card-grid` becomes exactly `2` fixed-width cards
- `.favorites-sidebar-desktop` is still hidden
- `.favorites-desktop-hidden` keeps the mobile filter button visible

This is the stage where:

- the controls row
- header block
- two-card grid

all share the same effective width.

### Desktop Sidebar Stage

From `layout-2col` (`65.5rem`) and up:

- `.favorites-layout` becomes a row
- `.favorites-sidebar-desktop` becomes visible
- `.view-controls` sits inside `.mixes-body`, above the sidebar and the grid
- `.favorites-header` returns to full shell width
- `.mixes-body` is centred on the sidebar-plus-grid width, which the controls row therefore
  shares
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
object at every width. It lives in the header's `tabs` slot (see Header Layout above), which
holds nothing else -- the sort button, the mobile filter button and the account menu all live
outside the header's `tabs` slot, in `.view-controls` and the `identity` slot respectively.

The switcher itself has two forms, driven by one class:

- Below `md` (`48rem` / `768px`): `.destination-switcher` is `w-full` and each
  `.destination-tab` is `flex-1`, so the three tabs span the full width and share it equally.
- From `md` and up: the track is `w-auto` and each tab is `flex-none`, so the tabs size to
  their labels and the switcher sits inline beside the other header controls. It is also sized a
  step up there -- a larger label, roomier tabs, and a track padded and rounded to match -- because
  an inline control has to earn the eye that a full-width strip gets for free.

`.destination-tab-active` marks the current destination with a white fill, a heavier weight and
a small shadow. The active tab also carries `aria-current="page"`, so the state does not depend
on colour alone. An artist page keeps the artists tab marked.

## Artist Page

The artist page is two stacked sections at every width: the mixes crediting the performer, then
the performances seen live. Neither is a sidebar to the other, so no breakpoint reflows them
side by side. `.artist-page` stacks them with `--layout-artist-section-gap`, which is wider than
the grid gap so the break between the halves reads as a section break rather than one more row.

`.artist-section` stacks a heading, its counts and its list at the grid gap. `.artist-stats`
wraps the three count tiles, so they sit on one line when there is room and wrap on a phone.
Only the mixes grid inside the first half becomes multi-column, through `.card-grid`.

`.credited-artist-link` carries the credited-name treatment -- grey with a subtle underline,
blue on hover -- for the mix card and the event card alike, so the two surfaces cannot drift
apart.

## Artists Table

The artists tab is one table with two forms, driven by the same seven columns: artist, mixes,
moments, starred moments, performances, most recent verdict and date last seen.

- From `md` (`48rem` / `768px`) up, every column is a table column. `.artists-value-column`
  carries the six value columns and `.artists-name-column` the performer's name, which never
  narrows past `--layout-table-name-min-width`.
- Below `md`, a row is the name plus the value of the active sort column and nothing else.
  `.artists-value-column` hides a value column at that width, and `.artists-column-active`
  puts the active one back on screen -- so it must stay **after** `.artists-value-column` in
  `tailwind.css`, where source order decides between two component-layer rules of equal
  specificity.
- `.artists-sort-control` holds the compact select that changes the sort below `md`, and is
  the one control that disappears from `md` up, where every header is a visible button.

The active column is named once, in the artists-UI store's column descriptor. The header row,
the cells and the select all read that descriptor, so the set of columns the table sorts by
and the set the phone can switch between are the same set by construction.

The table has its own three tokens rather than reusing the card destinations' ones: those are
computed from sidebar width plus gaps plus a fixed card width, which describes nothing about a
table that reduces to two columns. `.artists-view` still stacks the tab's controls and its
table at `--layout-grid-gap`, so the catalogue keeps the vertical rhythm of the card
destinations.

The table itself never scrolls horizontally, and no width is read in JavaScript: the
breakpoint lives only in these classes.

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
- `.mixes-body`: the mixes zone as one block -- the controls row and the sidebar-plus-grid share
  one left edge because the row is the outer element's first child. Carries the centring
  `.favorites-layout` used to carry.
- `.header-menu-panel`: the dropdown shell both header menus use, anchored to its trigger.
- `.card-grid`: shared fixed-width card grid at 2/3/4 columns, carried by both the mixes
  grid and the events grid
- `.destination-switcher`: segmented track for the three destinations, full width below `md`,
  inline and a step larger from `md`
- `.destination-tab`: one destination tab inside the track
- `.destination-tab-active`: the current destination's tab
- `.artist-page`: the artist page's stacked-section shell
- `.artist-section`: one half of the artist page
- `.artist-stats`: the wrapping row of count tiles
- `.credited-artist-link`: a credited artist's name, on the mix card and the event card
- `.artists-view`: the artists tab's stacked shell
- `.view-controls`: the controls row the mixes, events and artists destinations share. Stacks on
  a phone, becomes a row from `sm`, sets no outer margin -- each host spaces its own stack.
- `.view-controls-search`: the search field and the controls that read with it (sort, and the
  phone-only artist filter on the mixes tab) on one line at every width.
- `.view-controls-action`: the create button, full width on a phone and label-width from `sm`.
- `.card-grid-body`: the box a `.card-grid` sits in together with whatever is laid out over it,
  sized to the grid's own width at each breakpoint (`--layout-grid-width-2col` / `-3col` / `-4col`).
  Without it the grid stays centred while the controls row above starts at the shell's edge, and
  the two stop sharing a left edge. The mixes tab uses `.mixes-body` instead, which also has a
  sidebar to account for.
- `.view-control-button`: an icon button on the controls row — the date sort on both card
  destinations, the phone-only artist filter on the mixes tab. Square, sized by
  `--layout-control-height`.
- `.view-control-action`: the create button at the end of the row, full width on a phone and its
  own width from `sm`, sized by `--layout-control-height`.
- `.view-search` / `.view-search-input`: the search field, `--layout-search-width` (20rem) wide
  **from `sm` up only**, and sized by `--layout-control-height` (2.75rem), the height every control
  on the row shares. It has to be a definite width rather than a `max-width`: the group holding the
  field and its buttons is shrink-to-fit, so a percentage width inside it resolves against the
  input's intrinsic size and a `max-width` never binds. Below `sm` the field takes the full width:
  the row is stacked there and the create button under it is full width, so a narrower field would
  stop short of an edge everything else reaches. The width is on the wrapper so the sort button
  stays beside the field.
- `.artists-sort-control`: the compact sort select, below `md` only
- `.artists-table`: the artists table's own frame
- `.artists-table-header` / `.artists-table-cell`: one header cell and one body cell
- `.artists-name-column`: the performer's name column, on screen at every width
- `.artists-value-column`: one of the six value columns, hidden below `md`
- `.artists-column-active`: the active sort column, on screen at every width

## Editing Guidance

See [Frontend Layout Conventions](../conventions/frontend-layout.md) for the rule on
changing these tokens.

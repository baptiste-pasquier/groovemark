# Responsive Layout Notes

This document explains the desktop and tablet layout sizing used by GrooveMark's
favorites view.

## Source Of Truth

Layout tokens live in [src/assets/tailwind.css](../src/assets/tailwind.css).

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
- `.favorites-grid` uses `grid-cols-1`

This means the page is full-width, minus the shell padding.

### Tablet / Two-Column Pre-Desktop Stage

From `md` (`48rem` / `768px`) up to `layout-2col` (`65.5rem`):

- `.favorites-header` is centered and constrained to `--layout-grid-width-2col`
- `.favorites-main` is centered and constrained to `--layout-grid-width-2col`
- `.favorites-mobile-controls` is still visible
- `.favorites-grid` becomes exactly `2` fixed-width cards
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
- `.favorites-grid`: fixed-width card grid at 2/3/4 columns

## Editing Guidance

If the layout changes, prefer this order:

1. Change the token in `@theme`
2. Recompute the shell width formulas if needed
3. Keep component templates using semantic classes instead of arbitrary values

Avoid reintroducing raw values like `min-[87rem]` or `max-w-[108.5rem]` directly in Vue
templates unless the layout system is being redesigned.

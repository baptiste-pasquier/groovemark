---
status: accepted
date: 2026-09-12
decision-makers: [baptiste-pasquier]
---

# One account menu in the header

## Context and Problem Statement

A signed-in header carried four identity controls: an import progress pill, a mode or status
badge, a settings button and a red logout button. On a phone they wrapped onto two rows, and
five rows stood between the top of the screen and the first card.

The same period left the mixes tab with its search and create button in the sidebar while the
events and artists tabs kept theirs in a row above the grid, so one control sat in two places
depending on the tab.

## Decision Drivers

- A phone header needs fewer rows before the first card, not the same four controls rearranged
- Local mode has no account to name, so whatever replaces the four controls must still work with
  nothing to show but a mode and a way out
- A control mounted at two breakpoints must not duplicate an id that something else binds to --
  the import control is a `<label for="import-json">` bound to an `<input id="import-json">`
- The three destinations' search, sort and create controls should occupy one shared row rather
  than each destination inventing its own placement

## Considered Options

- One account menu with a status dot, versus keeping the four separate identity controls
- The identity mounted once and repositioned by flex order, versus mounted twice behind a
  hidden/visible pair
- For local mode: a separate badge plus a settings menu whose last item leaves local mode, versus
  folding local mode into the same account menu, versus removing the exit entirely

## Decision Outcome

Chosen option: one account menu with a status dot, mounted once and repositioned by flex order;
local mode keeps its own badge and settings menu rather than folding into the account menu.

One avatar carries the account, replacing the import pill, the status badge, the settings button
and the logout button. A status dot on it reports synchronised, read-only or importing; the
wording for those states exists only inside the open panel. The panel holds the identity, the
language, the import, the export and the sign-out.

Local mode keeps a separate warning badge and a separate settings button rather than folding into
the account menu, because it has no account to name -- a status dot and an avatar have nothing to
represent there. Removing the exit from local mode was rejected outright: the settings menu's
last item is the only route back to the sign-in screen, so leaving it out would strand a local
session. Leaving local mode therefore moves into that settings menu, so the mode is never a dead
end.

The search field, the date sort and the create button live in one controls row that the three
destinations share, named `.view-controls` after what it lays out.

The header mounts the identity once rather than twice behind a hidden/visible pair. Two mounts
put every id beneath it in the document twice -- `#account-menu-btn`, `#logout-btn`,
`#settings-menu-btn`, `#exit-local-mode-btn`, `#import-json`, `#export-json-btn` -- and one of
those duplications is a functional bug, not only an offence against uniqueness: the import
control is a `<label for="import-json">` bound to an `<input id="import-json">`, so a duplicate
id resolves the second label to the first input. `HeaderBar.vue` instead renders the identity
once, in a slot ordered by `sm:order-last`, alongside a tabs slot that takes `basis-full` and
wraps onto its own row below `sm` -- one mount, two positions, driven by flex order and wrapping
rather than by a duplicated subtree.

### Consequences

- Good, because the phone header is three rows instead of five
- Good, because no id beneath the identity is ever duplicated, so the import control's
  `<label for>` / `<input id>` pairing cannot silently resolve to the wrong input
- Good, because a future change to where the identity sits is a flex-order or basis change in
  `HeaderBar.vue` and `tailwind.css`, not a second template kept in sync with the first
- Bad, because a header control that must exist in both a signed-in and a local-mode session now
  has two components to be added to, not one -- `AppMenuItems` exists to keep that from becoming
  two divergent lists
- Neutral, because the header emits nothing: no destination view wires up a header control any
  more
- Neutral, because `useEventsUiStore` gains a sort order, applied over the domain store's
  canonical date ordering rather than replacing it

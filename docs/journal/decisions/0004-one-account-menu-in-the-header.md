---
status: accepted
date: 2026-09-12
decision-makers: [baptiste-pasquier]
---

# 4. One account menu in the header

## Context

A signed-in header carried four identity controls: an import progress pill, a mode or status
badge, a settings button and a red logout button. On a phone they wrapped onto two rows, and
five rows stood between the top of the screen and the first card.

The same period left the mixes tab with its search and create button in the sidebar while the
events and artists tabs kept theirs in a row above the grid, so one control sat in two places
depending on the tab.

## Decision

One avatar carries the account. A status dot on it reports synchronised, read-only or importing;
the wording for those states exists only inside the open panel. The panel holds the identity,
the language, the import, the export and the sign-out.

Local mode keeps a separate warning badge and a separate settings button, because it has no
account to name. Leaving local mode moves into that menu, so the mode is never a dead end.

The search field, the date sort and the create button live in one controls row that the three
destinations share, named `.view-controls` after what it lays out.

The header mounts this identity once rather than twice behind a hidden/visible pair. Two mounts
put every id beneath it in the document twice -- `#account-menu-btn`, `#logout-btn`,
`#settings-menu-btn`, `#exit-local-mode-btn`, `#import-json`, `#export-json-btn` -- and one of
those duplications is a functional bug, not only an offence against uniqueness: the import
control is a `<label for="import-json">` bound to an `<input id="import-json">`, so a duplicate
id resolves the second label to the first input. `HeaderBar.vue` instead renders the identity
once, in a slot ordered by `sm:order-last`, alongside a tabs slot that takes `basis-full` and
wraps onto its own row below `sm` -- one mount, two positions, driven by flex order and wrapping
rather than by a duplicated subtree.

## Consequences

The phone header is three rows instead of five.

`useEventsUiStore` gains a sort order, applied over the domain store's canonical date ordering
rather than replacing it.

The header emits nothing: no destination view wires up a header control any more.

A header control that must exist in both a signed-in and a local-mode session now has two
components to be added to, not one. `AppMenuItems` exists to keep that from becoming two
divergent lists.

A future change to where the identity sits is a flex-order or basis change in `HeaderBar.vue`
and `tailwind.css`, not a second template kept in sync with the first.

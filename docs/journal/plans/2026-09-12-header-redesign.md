---
title: 'feat: Header redesign — unified account menu and shared controls row'
date: 2026-09-12
type: feat
origin: ../specs/2026-09-12-header-redesign-design.md
status: draft
---

# Header Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Strip the header down to identity, give the three destinations one shared controls row carrying search and sort, and collapse the four signed-in identity controls into one avatar menu.

**Architecture:** Layout behaviour moves into semantic classes in `src/assets/tailwind.css` that all three destinations share, so a breakpoint change cannot reach one surface and miss another. The header keeps the logo, the title and the destination tabs; everything else becomes either a controls-row component owned by a destination view, or one of three new menu components in `src/components/layout/`. No store gains a new responsibility except `useEventsUiStore`, which gains a sort order it applies on top of the domain store's canonical date ordering.

**Tech Stack:** Vue 3 `<script setup lang="ts">`, Pinia setup stores, Tailwind CSS v4 (`@theme` tokens + `@layer components`), vue-i18n, Vitest + `@vue/test-utils`, Playwright.

**Spec:** `../specs/2026-09-12-header-redesign-design.md`

## Global Constraints

- Prettier: no semicolons, single quotes, 100-character line width, 2-space indent. Run `npm run format` before every commit.
- Imports use relative paths (`../`, `./`). The `@/` alias exists but is never used. Order: Vue/framework, third-party, local components, local stores/services/types/utils, side-effect imports last.
- `function` declarations for named component and store methods; arrow functions only for callbacks, computed bodies and watchers.
- Layout values live in `@theme` tokens and `@layer components` classes, never as arbitrary values in templates. See `docs/conventions/frontend-layout.md`.
- A layout class shared by two or more destinations is named after what it lays out, never after one destination.
- `useAppStore.isReadOnly` is the single read-only switch. Do not add a second one, and do not push a read-only flag from a domain store.
- Icons are named Vue component imports from `lucide-vue-next`.
- Every new i18n key is added to **both** `src/i18n/locales/en.json` and `src/i18n/locales/fr.json`. `src/__tests__/locales.spec.ts` asserts the two files agree.
- Tests live in `src/__tests__/`, named `[name].spec.ts`. They are never co-located with the component.
- Commit messages carry no AI attribution footer and no `Co-Authored-By` line.

## Before Task 1

The repository is on `main`. Create the working branch first:

```bash
git checkout -b feat/header-redesign
```

---

### Task 1: Shared controls row and the smaller search field

Renames `.artists-controls` to `.view-controls` and gives the events and artists tabs one row shape and one search size. The mixes tab joins them in Task 2.

**Files:**

- Modify: `src/assets/tailwind.css` (the `@theme` block, and `.artists-controls` at line 143)
- Modify: `src/components/artists/ArtistsView.vue`
- Modify: `src/components/events/EventsGrid.vue`
- Modify: `src/components/events/EventsSearchBar.vue`
- Modify: `docs/reference/responsive-layout.md:304`
- Test: `src/__tests__/ArtistsTable.spec.ts`, `src/__tests__/EventsGrid.spec.ts`

**Interfaces:**

- Consumes: nothing.
- Produces: the classes `.view-controls`, `.view-controls-search`, `.view-controls-action`, `.view-search`, `.view-search-input`, and the token `--layout-search-max-width`. Tasks 2 and 4 mount into them.

- [ ] **Step 1: Pin the artists controls rendering before renaming anything**

The convention in `docs/conventions/frontend-layout.md` requires the current rendering to be pinned by a test that does **not** name the class, so the rename can be proved not to have degraded it. Add to `src/__tests__/ArtistsTable.spec.ts`, inside the existing top-level `describe`:

```ts
it('keeps the search box in a container that stacks on a phone and becomes a row from sm', async () => {
  const { wrapper } = await mountArtists()
  const search = wrapper.get('#artists-search')
  const row = search.element.closest('div[class*="flex-col"]') as HTMLElement | null

  expect(row).not.toBeNull()
  expect(row!.className).toMatch(/\bflex\b/)
  expect(row!.className).toMatch(/sm:flex-row/)
})
```

`mountArtists()` is the file's existing helper at line 100 — it is `async` and returns
`{ wrapper, router }`. Do not add a second mount helper.

The assertion walks up from the input to the nearest ancestor carrying `flex-col` rather than
naming `.artists-controls`, which is exactly what lets it survive the rename two steps later.

- [ ] **Step 2: Run it and confirm it passes against today's code**

Run: `npx vitest run src/__tests__/ArtistsTable.spec.ts`
Expected: PASS. This test pins the behaviour; it is not meant to fail first.

- [ ] **Step 3: Write the failing test for the new classes and the capped search**

Add to `src/__tests__/EventsGrid.spec.ts`, which already reads `tailwind.css` through its `layoutRuleFor` helper:

```ts
it('caps the search field at the shared token and stands it 38px tall', () => {
  expect(TAILWIND_CSS).toContain('--layout-search-max-width: 24rem;')

  const searchRule = layoutRuleFor('view-search')
  expect(searchRule).toContain('var(--layout-search-max-width)')
  expect(layoutRuleFor('view-search-input')).toMatch(/\bpy-2\b/)
  expect(layoutRuleFor('view-search-input')).not.toMatch(/\bp-3\b/)
})

it('lays the events controls out with the class the three destinations share', async () => {
  const { wrapper } = await mountEventsGrid()
  const row = wrapper.get('.view-controls')

  expect(row.find('.view-search').exists()).toBe(true)
  expect(row.find('#add-event-btn').exists()).toBe(true)
  expect(layoutRuleFor('view-controls')).toMatch(/sm:flex-row/)
})
```

- [ ] **Step 4: Run it to verify it fails**

Run: `npx vitest run src/__tests__/EventsGrid.spec.ts -t 'shared'`
Expected: FAIL with `no component rule for .view-controls in tailwind.css`.

- [ ] **Step 5: Add the token**

In `src/assets/tailwind.css`, inside `@theme`, after `--layout-table-name-min-width`:

```css
/* Caps the search field on all three destinations. A search term is a few
     words; past this width the field reads as a text area and pushes the
     controls beside it off the eye's path. */
--layout-search-max-width: 24rem;
```

- [ ] **Step 6: Replace `.artists-controls` with the shared classes**

In `src/assets/tailwind.css`, replace the `.artists-controls` rule (line 143) with:

```css
/* The one controls row of the three card and table destinations: search and
     its adjacent controls on one side, the create button on the other. Named
     after what it lays out rather than after a destination, because all three
     carry it -- see docs/conventions/frontend-layout.md. It sets no outer
     margin: each host already spaces its own stack. */
.view-controls {
  @apply flex flex-col gap-3 sm:flex-row sm:items-center;
}

/* Search, sort and the phone-only artist filter travel together: on a phone
     they share one line rather than each taking a row of their own. */
.view-controls-search {
  @apply flex w-full items-center gap-2 sm:w-auto;
}

/* The create button fills the width on a phone, where it is the row, and
     shrinks to its label once the row is horizontal. */
.view-controls-action {
  @apply w-full sm:w-auto;
}

/* The cap sits on the wrapper, not on the input: the sort button is the
     wrapper's next sibling, so capping the input alone would leave the button
     stranded at the far end of a full-width box. */
.view-search {
  @apply relative w-full min-w-0;
  max-width: var(--layout-search-max-width);
}

.view-search-input {
  @apply w-full rounded-lg border border-gray-200 bg-white py-2 pr-3 pl-10 shadow-sm transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500;
}
```

- [ ] **Step 7: Re-point `ArtistsView.vue`**

Replace the controls block in `src/components/artists/ArtistsView.vue` (lines 40-53) with:

```vue
      <div class="view-controls">
        <div class="view-controls-search">
          <div class="view-search">
            <input
              id="artists-search"
              type="text"
              :placeholder="t('artists.search_placeholder')"
              class="view-search-input"
              @input="onSearch"
            />
            <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <Search class="h-5 w-5 text-gray-400" />
            </div>
          </div>
        </div>
      </div>
```

- [ ] **Step 8: Re-point `EventsSearchBar.vue`**

Replace the template of `src/components/events/EventsSearchBar.vue` with:

```vue
<template>
  <div class="view-search">
    <input
      id="events-search"
      type="text"
      :placeholder="$t('events.search_placeholder')"
      class="view-search-input"
      @input="onSearch"
    />
    <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
      <Search class="h-5 w-5 text-gray-400" />
    </div>
  </div>
</template>
```

- [ ] **Step 9: Re-point `EventsGrid.vue`**

Replace its controls block (lines 69-76) with:

```vue
      <div class="view-controls mb-6">
        <div class="view-controls-search">
          <EventsSearchBar />
        </div>
        <div class="view-controls-action">
          <AddEventButton :disabled="appStore.isReadOnly" @click="createEvent" />
        </div>
      </div>
```

- [ ] **Step 10: Update the layout reference**

In `docs/reference/responsive-layout.md`, replace the line `- \`.artists-controls\`: the artists tab's search row` with:

```markdown
- `.view-controls`: the controls row the mixes, events and artists destinations share. Stacks on
  a phone, becomes a row from `sm`, sets no outer margin — each host spaces its own stack.
- `.view-controls-search`: the search field and the controls that read with it (sort, and the
  phone-only artist filter on the mixes tab) on one line at every width.
- `.view-controls-action`: the create button, full width on a phone and label-width from `sm`.
- `.view-search` / `.view-search-input`: the search field, capped at
  `--layout-search-max-width` (24rem) and 38px tall. The cap is on the wrapper so the sort
  button stays beside the field.
```

- [ ] **Step 11: Run the full suite**

Run: `npm run test:unit -- run && npm run type-check && npm run lint && npm run format`
Expected: PASS. `ArtistsTable.spec.ts`'s pin from Step 1 must still pass — it never named the class, so the rename cannot have broken it.

- [ ] **Step 12: Commit**

```bash
git add src/assets/tailwind.css src/components/artists/ArtistsView.vue src/components/events/EventsGrid.vue src/components/events/EventsSearchBar.vue src/__tests__/ArtistsTable.spec.ts src/__tests__/EventsGrid.spec.ts docs/reference/responsive-layout.md
git commit -m "refactor(layout): share one controls row across destinations and cap the search field"
```

---

### Task 2: The mixes tab adopts the controls row

Lifts the search, the create button and the phone-only artist filter out of the sidebar and the header into one row above the whole mixes zone.

**Files:**

- Modify: `src/assets/tailwind.css` (`.favorites-layout`, `.favorites-mobile-controls`)
- Modify: `src/components/favorites/MixesView.vue`
- Modify: `src/components/favorites/FavoriteSearchBar.vue`
- Modify: `src/components/layout/HeaderBar.vue`
- Test: `src/__tests__/MixesView.spec.ts`, `src/__tests__/HeaderBar.spec.ts`

**Interfaces:**

- Consumes: `.view-controls`, `.view-controls-search`, `.view-controls-action`, `.view-search`, `.view-search-input` from Task 1.
- Produces: `.mixes-body`. `HeaderBar` no longer declares an `openFilters` emit and no longer renders `#filter-menu-btn`.

- [ ] **Step 1: Write the failing test**

Replace the test `'opens the artist filter sidebar from the header filter control'` in `src/__tests__/MixesView.spec.ts` with:

```ts
it('opens the artist filter sidebar from the controls row', async () => {
  const { wrapper } = await mountMixesView()

  expect(wrapper.findComponent(ArtistSidebar).props('open')).toBe(false)

  const filterButton = wrapper.get('#filter-menu-btn')
  expect(filterButton.element.closest('.view-controls')).not.toBeNull()

  await filterButton.trigger('click')

  expect(wrapper.findComponent(ArtistSidebar).props('open')).toBe(true)
})

it('mounts the search and the create button once, above the sidebar and the grid', async () => {
  const { wrapper } = await mountMixesView()

  expect(wrapper.findAllComponents(FavoriteSearchBar)).toHaveLength(1)
  expect(wrapper.findAllComponents(AddFavoriteButton)).toHaveLength(1)

  const row = wrapper.get('.view-controls')
  expect(row.element.closest('.favorites-layout')).toBeNull()
  expect(wrapper.get('.mixes-body').element.contains(row.element)).toBe(true)
})

it('leaves the sidebar holding the artist list alone', async () => {
  const { wrapper } = await mountMixesView()
  const sidebar = wrapper.get('.favorites-sidebar-desktop')

  expect(sidebar.findComponent(ArtistList).exists()).toBe(true)
  expect(sidebar.findComponent(FavoriteSearchBar).exists()).toBe(false)
  expect(sidebar.findComponent(AddFavoriteButton).exists()).toBe(false)
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/__tests__/MixesView.spec.ts`
Expected: FAIL — `#filter-menu-btn` is not found, because it still lives in `HeaderBar`.

- [ ] **Step 3: Add `.mixes-body` and trim `.favorites-layout`**

In `src/assets/tailwind.css`, add above `.favorites-layout`:

```css
/* The mixes zone as one block: the controls row and the sidebar-plus-grid
     below it share one left edge, because the row is the outer element's first
     child rather than a sibling laid out against a different width. Carries the
     centring that .favorites-layout used to carry alone. */
.mixes-body {
  @apply layout-2col:mx-auto layout-2col:w-fit flex w-full flex-col gap-[var(--layout-grid-gap)] md:mx-auto md:w-[var(--layout-grid-width-2col)];
}
```

and replace `.favorites-layout` with:

```css
.favorites-layout {
  @apply layout-2col:flex-row layout-2col:gap-[var(--layout-desktop-gap)] flex flex-col;
}
```

Then delete the `.favorites-mobile-controls` rule entirely — no surface carries it after Step 4.

- [ ] **Step 4: Restructure `MixesView.vue`**

Replace its whole `<template>` with:

```vue
<template>
  <HeaderBar />

  <div class="mixes-body">
    <div class="view-controls">
      <div class="view-controls-search">
        <FavoriteSearchBar />
        <button
          id="filter-menu-btn"
          type="button"
          class="favorites-desktop-hidden rounded-lg border border-gray-300 bg-white p-2 shadow-sm transition duration-300 hover:bg-gray-200 focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 focus:outline-none"
          :title="t('app.filter_by_artist')"
          @click="showSidebar = true"
        >
          <Filter class="h-5 w-5 text-gray-700" />
        </button>
      </div>
      <div class="view-controls-action">
        <AddFavoriteButton :disabled="favoritesStore.isReadOnly" @click="addFavorite" />
      </div>
    </div>

    <div class="favorites-layout">
      <aside class="favorites-sidebar-desktop">
        <div class="flex flex-1 flex-col overflow-hidden">
          <h3 class="mb-3 text-xs font-bold tracking-wider text-gray-500 uppercase">
            {{ t('app.artists') }}
          </h3>
          <ArtistList class="flex-1 overflow-y-auto" />
        </div>
      </aside>

      <main class="favorites-main">
        <FavoritesGrid @edit="editFavorite" />
      </main>
    </div>
  </div>

  <FavoriteModal v-model="showModal" :edit-id="editId" />
  <ArtistSidebar :open="showSidebar" @close="showSidebar = false" />
</template>
```

and add to its `<script setup>`, after the existing imports:

```ts
import { Filter } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
```

placing `Filter` with the third-party imports and `useI18n` with the framework ones, then below the store declarations:

```ts
const { t } = useI18n()
```

- [ ] **Step 5: Re-point `FavoriteSearchBar.vue`**

Replace its template with:

```vue
<template>
  <div class="view-search">
    <input
      id="favorites-search"
      type="text"
      :placeholder="$t('app.search_placeholder')"
      class="view-search-input"
      @input="onSearch"
    />
    <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
      <Search class="h-5 w-5 text-gray-400" />
    </div>
  </div>
</template>
```

- [ ] **Step 6: Take the filter button out of `HeaderBar.vue`**

Delete the `#filter-menu-btn` button (lines 190-197), the `openFilters` function, the `defineEmits` block declaring it, and the `Filter` import. `showsMixesControls` still gates the sort button, which Task 4 removes.

- [ ] **Step 7: Update the header test that asserted the filter button**

In `src/__tests__/HeaderBar.spec.ts`, change the test `'offers the grid sort and artist filter on the mixes destination only'` to assert the sort alone, and add the emit assertion:

```ts
it('offers the grid sort on the mixes destination only', async () => {
  const router = createTestRouter()
  await router.push('/')
  await router.isReady()

  const wrapper = mountHeaderBar(router)
  expect(wrapper.find('#sort-btn').exists()).toBe(true)

  for (const destination of ['/events', '/artists']) {
    await router.push(destination)
    await flushPromises()
    expect(wrapper.find('#sort-btn').exists()).toBe(false)
  }
})

it('emits nothing, so no destination view has to wire a header control up', () => {
  const wrapper = mountHeaderBar()

  expect(Object.keys(wrapper.vm.$options.emits ?? {})).toEqual([])
})
```

and delete the old `'emits no import event, so no destination view has to wire the file up'` test, which the assertion above subsumes.

- [ ] **Step 8: Run the tests**

Run: `npx vitest run src/__tests__/MixesView.spec.ts src/__tests__/HeaderBar.spec.ts src/__tests__/FavoritesGrid.spec.ts`
Expected: PASS.

- [ ] **Step 9: Run the full suite and the formatters**

Run: `npm run test:unit -- run && npm run type-check && npm run lint && npm run format`
Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add src/assets/tailwind.css src/components/favorites/MixesView.vue src/components/favorites/FavoriteSearchBar.vue src/components/layout/HeaderBar.vue src/__tests__/MixesView.spec.ts src/__tests__/HeaderBar.spec.ts
git commit -m "feat(mixes): move search, create and artist filter into the shared controls row"
```

---

### Task 3: `useEventsUiStore` gains a sort order

Store-only. The events tab can be read oldest-first, without the domain store's canonical ordering moving.

**Files:**

- Modify: `src/stores/eventsUi.ts`
- Test: `src/__tests__/eventsUi.spec.ts`

**Interfaces:**

- Consumes: `useEventsStore().events`, already ordered newest-first by `dateAttended`.
- Produces: `useEventsUiStore().sortOrder` (`'newest' | 'oldest'`) and `useEventsUiStore().toggleSort()`. Task 4 binds a button to both.

- [ ] **Step 1: Write the failing tests**

Add to `src/__tests__/eventsUi.spec.ts`, inside the existing `describe`:

```ts
it('starts newest-first, matching the order the domain store returns', async () => {
  await seedLocalEvents()
  const eventsUiStore = useEventsUiStore()

  expect(eventsUiStore.sortOrder).toBe('newest')
  expect(eventsUiStore.filteredEvents.map((event) => event.id)).toEqual(['new', 'mid', 'old'])
})

it('reverses the list when the sort is toggled, and back when it is toggled again', async () => {
  await seedLocalEvents()
  const eventsUiStore = useEventsUiStore()

  eventsUiStore.toggleSort()

  expect(eventsUiStore.sortOrder).toBe('oldest')
  expect(eventsUiStore.filteredEvents.map((event) => event.id)).toEqual(['old', 'mid', 'new'])

  eventsUiStore.toggleSort()

  expect(eventsUiStore.sortOrder).toBe('newest')
  expect(eventsUiStore.filteredEvents.map((event) => event.id)).toEqual(['new', 'mid', 'old'])
})

it('reverses what the search left, not the whole list', async () => {
  await seedLocalEvents([
    ...SEEDED_EVENTS,
    storedEvent('also-dour', 'Dour Warm-up', '2025-07-14', 'Dour Grounds'),
  ])
  const eventsUiStore = useEventsUiStore()

  eventsUiStore.setSearch('dour')
  eventsUiStore.toggleSort()

  expect(eventsUiStore.filteredEvents.map((event) => event.id)).toEqual(['also-dour', 'new'])
})

it('never reorders the domain store, which stays the canonical date ordering (R11)', async () => {
  const eventsStore = await seedLocalEvents()
  const eventsUiStore = useEventsUiStore()

  eventsUiStore.toggleSort()

  expect(eventsStore.events.map((event) => event.id)).toEqual(['new', 'mid', 'old'])
})

it('restores the newest-first order on reset', async () => {
  await seedLocalEvents()
  const eventsUiStore = useEventsUiStore()

  eventsUiStore.toggleSort()
  eventsUiStore.$reset()

  expect(eventsUiStore.sortOrder).toBe('newest')
  expect(eventsUiStore.filteredEvents.map((event) => event.id)).toEqual(['new', 'mid', 'old'])
})

it('keeps the sort when only the search is cleared, as the route guard does on leave', async () => {
  await seedLocalEvents()
  const eventsUiStore = useEventsUiStore()

  eventsUiStore.toggleSort()
  eventsUiStore.setSearch('')

  expect(eventsUiStore.sortOrder).toBe('oldest')
})
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run src/__tests__/eventsUi.spec.ts`
Expected: FAIL with `eventsUiStore.toggleSort is not a function`.

- [ ] **Step 3: Implement the sort**

Replace the body of `src/stores/eventsUi.ts` with:

```ts
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { MusicEvent } from '../types/event'
import { useEventsStore } from './events'

export const useEventsUiStore = defineStore('eventsUi', () => {
  // The events tab's own search box, and nothing else's. Three independent
  // search boxes now exist, so sharing the ref that filters the mixes grid
  // would let typing in one tab silently narrow another (KTD7).
  const searchTerm = ref('')

  // The direction the tab is read in, never the ordering itself. The domain
  // store returns one canonical date ordering (R11); this reverses what comes
  // out of it, exactly as the mixes tab's own sort does.
  const sortOrder = ref<'newest' | 'oldest'>('newest')

  const eventsStore = useEventsStore()

  // Filters, then reverses -- in that order, so the reversal acts on what the
  // search left rather than on the full list. Both the event name and the
  // venue are searched, because a night is remembered by either (R27).
  const filteredEvents = computed<MusicEvent[]>(() => {
    const normalizedSearchTerm = searchTerm.value.toLowerCase().trim()
    const matchingEvents = normalizedSearchTerm
      ? eventsStore.events.filter(
          (event) =>
            event.name.toLowerCase().includes(normalizedSearchTerm) ||
            event.venue.toLowerCase().includes(normalizedSearchTerm),
        )
      : eventsStore.events

    // Copied before reversing: `events` is the domain store's own array when
    // nothing is searched, and `reverse()` mutates in place.
    return sortOrder.value === 'newest' ? matchingEvents : [...matchingEvents].reverse()
  })

  function setSearch(term: string) {
    searchTerm.value = term
  }

  function toggleSort() {
    sortOrder.value = sortOrder.value === 'newest' ? 'oldest' : 'newest'
  }

  function $reset() {
    searchTerm.value = ''
    sortOrder.value = 'newest'
  }

  return {
    searchTerm,
    sortOrder,
    filteredEvents,
    setSearch,
    toggleSort,
    $reset,
  }
})
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/__tests__/eventsUi.spec.ts`
Expected: PASS, including the existing test `'exposes every event in the order the domain store returns when nothing is searched'`.

- [ ] **Step 5: Commit**

```bash
npm run format
git add src/stores/eventsUi.ts src/__tests__/eventsUi.spec.ts
git commit -m "feat(events): let the events tab be read oldest-first"
```

---

### Task 4: One sort button, beside the search on both card destinations

**Files:**

- Create: `src/components/layout/SortToggleButton.vue`
- Modify: `src/components/favorites/MixesView.vue`
- Modify: `src/components/events/EventsGrid.vue`
- Modify: `src/components/layout/HeaderBar.vue`
- Test: `src/__tests__/MixesView.spec.ts`, `src/__tests__/EventsGrid.spec.ts`, `src/__tests__/HeaderBar.spec.ts`

**Interfaces:**

- Consumes: `useFavoritesUiStore().sortOrder` / `.toggleSort()`, and `useEventsUiStore().sortOrder` / `.toggleSort()` from Task 3.
- Produces: `SortToggleButton` with props `{ order: 'newest' | 'oldest'; buttonId: string }` and the emit `{ (e: 'toggle'): void }`.

- [ ] **Step 1: Write the failing tests**

In `src/__tests__/MixesView.spec.ts`, replace the `#sort-btn` assertion in `'keeps the grid, the search bar, the add control and the artist filter list'` with a dedicated test:

```ts
it('puts the sort beside the search and toggles the mixes order', async () => {
  const favoritesUiStore = useFavoritesUiStore()
  const { wrapper } = await mountMixesView()

  const sortButton = wrapper.get('#sort-btn')
  expect(sortButton.element.closest('.view-controls-search')).not.toBeNull()
  expect(favoritesUiStore.sortOrder).toBe('newest')

  await sortButton.trigger('click')

  expect(favoritesUiStore.sortOrder).toBe('oldest')
})
```

In `src/__tests__/EventsGrid.spec.ts`, add:

```ts
it('puts the sort beside the search and reverses the rendered order', async () => {
  const { wrapper } = await mountEventsGrid()
  const eventsUiStore = useEventsUiStore()

  const sortButton = wrapper.get('#events-sort-btn')
  expect(sortButton.element.closest('.view-controls-search')).not.toBeNull()

  await sortButton.trigger('click')
  await nextTick()

  expect(eventsUiStore.sortOrder).toBe('oldest')
  expect(wrapper.findAll('.event-card')).toHaveLength(3)
})
```

In `src/__tests__/HeaderBar.spec.ts`, replace the test `'offers the grid sort on the mixes destination only'` (added in Task 2) with:

```ts
it('carries no list control at all, on any destination', async () => {
  const router = createTestRouter()

  for (const destination of ['/', '/events', '/artists']) {
    await router.push(destination)
    await router.isReady()

    const wrapper = mountHeaderBar(router)
    expect(wrapper.find('#sort-btn').exists()).toBe(false)
    expect(wrapper.find('#filter-menu-btn').exists()).toBe(false)
  }
})
```

and delete the assertion `expect(wrapper.get('#sort-btn').element.closest('.favorites-header-controls')).not.toBeNull()` from the test `'uses the documented switcher classes so the tabs collapse to full width below md'`.

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run src/__tests__/EventsGrid.spec.ts -t 'reverses the rendered order'`
Expected: FAIL — `#events-sort-btn` not found.

- [ ] **Step 3: Create the shared button**

Create `src/components/layout/SortToggleButton.vue`:

```vue
<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { CalendarArrowDown, CalendarArrowUp } from 'lucide-vue-next'

// The one date-reversal control, shared by the mixes and events destinations.
// The caller passes the order it holds and reacts to the toggle, so this
// button reads no store and neither destination can grow a second wording for
// the same gesture. The id is a prop because each destination keeps its own,
// which is what the unit specs address it by.
defineProps<{ order: 'newest' | 'oldest'; buttonId: string }>()
defineEmits<{ (e: 'toggle'): void }>()

const { t } = useI18n()
</script>

<template>
  <button
    :id="buttonId"
    type="button"
    class="shrink-0 rounded-lg border border-gray-300 bg-white p-2 shadow-sm transition duration-300 hover:bg-gray-200 focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 focus:outline-none"
    :title="
      order === 'newest' ? t('app.sort_toggle_title_oldest') : t('app.sort_toggle_title_newest')
    "
    @click="$emit('toggle')"
  >
    <component
      :is="order === 'newest' ? CalendarArrowDown : CalendarArrowUp"
      class="h-5 w-5 text-gray-700"
    />
  </button>
</template>
```

- [ ] **Step 4: Mount it in `MixesView.vue`**

Import it with the other local components:

```ts
import SortToggleButton from '../layout/SortToggleButton.vue'
```

add the UI store alongside the existing one:

```ts
import { useFavoritesUiStore } from '../../stores/favoritesUi'

const favoritesUiStore = useFavoritesUiStore()
```

and insert it inside `.view-controls-search`, between `<FavoriteSearchBar />` and the filter button:

```vue
<SortToggleButton
  button-id="sort-btn"
  :order="favoritesUiStore.sortOrder"
  @toggle="favoritesUiStore.toggleSort()"
/>
```

- [ ] **Step 5: Mount it in `EventsGrid.vue`**

Import it with the other local components:

```ts
import SortToggleButton from '../layout/SortToggleButton.vue'
```

and put it inside `.view-controls-search`, after `<EventsSearchBar />`:

```vue
<SortToggleButton
  button-id="events-sort-btn"
  :order="eventsUiStore.sortOrder"
  @toggle="eventsUiStore.toggleSort()"
/>
```

- [ ] **Step 6: Take the sort out of `HeaderBar.vue`**

Delete from `src/components/layout/HeaderBar.vue`: the `#sort-btn` button, the `toggleSort` function, the `showsMixesControls` computed, the `useFavoritesUiStore` import with its `favoritesUiStore` constant, and the `CalendarArrowDown` and `CalendarArrowUp` imports.

Keep `useRoute`, the `route` constant and the `activeDestination` computed: the destination tabs still read them to mark the current tab.

- [ ] **Step 7: Run the tests**

Run: `npx vitest run src/__tests__/MixesView.spec.ts src/__tests__/EventsGrid.spec.ts src/__tests__/HeaderBar.spec.ts src/__tests__/favoritesUi.spec.ts`
Expected: PASS.

- [ ] **Step 8: Run the full suite and the formatters**

Run: `npm run test:unit -- run && npm run type-check && npm run lint && npm run format`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/components/layout/SortToggleButton.vue src/components/favorites/MixesView.vue src/components/events/EventsGrid.vue src/components/layout/HeaderBar.vue src/__tests__/
git commit -m "feat(sort): move the date sort beside the search and give the events tab one"
```

---

### Task 5: Extract the app-level menu items

Pure refactor, no behaviour change. The language, import and export items become one component, so the two panels Tasks 6 and 7 build cannot drift apart.

**Files:**

- Create: `src/components/layout/AppMenuItems.vue`
- Modify: `src/components/layout/HeaderBar.vue`
- Test: `src/__tests__/HeaderBar.spec.ts` (unchanged assertions must still pass)

**Interfaces:**

- Consumes: `useFavoritesStore().importProgress`, `.isReadOnly`, `.importFromFile()`, `.exportFavorites()`; `SUPPORTED_LOCALES` from `../../i18n`; `updateLocale` from `../../services/locale`.
- Produces: `AppMenuItems` with no props and the emit `{ (e: 'done'): void }`, fired after any item completes so the host panel can close itself. It keeps the ids `#import-json` and `#export-json-btn`.

- [ ] **Step 1: Create the component**

Create `src/components/layout/AppMenuItems.vue`:

```vue
<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Upload, Download, Languages, Check, LoaderCircle } from 'lucide-vue-next'
import { useFavoritesStore } from '../../stores/favorites'
import { SUPPORTED_LOCALES } from '../../i18n'
import { updateLocale } from '../../services/locale'

// The app-level actions, in one copy. Both header panels mount this rather
// than each restating the list, so the signed-in menu and the local-mode menu
// cannot offer different actions or different wording for the same action.
const favoritesStore = useFavoritesStore()

const { t, locale } = useI18n()

const emit = defineEmits<{ (e: 'done'): void }>()

const importingLabel = computed(() => {
  const progress = favoritesStore.importProgress
  if (!progress) return ''
  if (progress.total === null) return t('app.importing_preparing')
  return t('app.importing', { processed: progress.processed, total: progress.total })
})

// Single source of truth for the import control's disabled state and styling,
// so the label class and the input's disabled binding can never drift apart.
const importControlState = computed<'importing' | 'readonly' | 'enabled'>(() => {
  if (favoritesStore.importProgress) return 'importing'
  if (favoritesStore.isReadOnly) return 'readonly'
  return 'enabled'
})
const isImportDisabled = computed(() => importControlState.value !== 'enabled')

function setAndPersistLocale(code: string) {
  locale.value = code
  updateLocale(code)
  emit('done')
}

// The import restores both domains from one file (R22), so it is an app-level
// action rather than a destination one. It is handled here, where the file
// input, the disabled state and the progress label already live.
async function handleImport(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  emit('done')
  if (!file) return

  try {
    await favoritesStore.importFromFile(file)
  } finally {
    // Cleared so selecting the same file again still fires a change event.
    input.value = ''
  }
}

function handleExport() {
  favoritesStore.exportFavorites()
  emit('done')
}
</script>

<template>
  <div
    class="flex items-center gap-2 px-4 py-2 text-xs font-semibold tracking-wider text-gray-500 uppercase"
  >
    <Languages class="h-4 w-4" />
    {{ t('app.language') }}
  </div>
  <button
    v-for="l in SUPPORTED_LOCALES"
    :key="l.code"
    class="flex w-full items-center justify-between px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 focus:bg-gray-100 focus:outline-none"
    role="menuitem"
    @click="setAndPersistLocale(l.code)"
  >
    <span>{{ l.label }}</span>
    <Check v-if="locale === l.code" class="h-4 w-4 text-blue-500" />
  </button>
  <div class="my-1 border-t border-gray-100"></div>
  <label
    for="import-json"
    class="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-gray-700 focus-within:bg-gray-100 focus-within:outline-none hover:bg-gray-100"
    :class="{
      'cursor-not-allowed opacity-60': importControlState === 'importing',
      'pointer-events-none opacity-50': importControlState === 'readonly',
      'cursor-pointer': importControlState === 'enabled',
    }"
  >
    <LoaderCircle v-if="favoritesStore.importProgress" class="h-4 w-4 animate-spin" />
    <Upload v-else class="h-4 w-4" />
    {{ favoritesStore.importProgress ? importingLabel : t('app.import_json') }}
  </label>
  <input
    id="import-json"
    type="file"
    class="hidden"
    accept=".json"
    :disabled="isImportDisabled"
    @change="handleImport"
  />
  <button
    id="export-json-btn"
    class="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 focus:bg-gray-100 focus:outline-none"
    role="menuitem"
    @click="handleExport"
  >
    <Download class="h-4 w-4" />
    {{ t('app.export_json') }}
  </button>
</template>
```

- [ ] **Step 2: Mount it in `HeaderBar.vue`**

In the settings dropdown, replace everything between `role="menu"` and the closing `</div>` of that panel with:

```vue
<AppMenuItems @done="isMenuOpen = false" />
```

and import it with the other local components:

```ts
import AppMenuItems from './AppMenuItems.vue'
```

Then delete from `HeaderBar.vue` the now-unused `importControlState`, `isImportDisabled`, `setAndPersistLocale`, `handleImport`, the `SUPPORTED_LOCALES` and `updateLocale` imports, and the `Upload`, `Download`, `Languages`, `Check` icon imports. Keep `importingLabel` and the `LoaderCircle` import: the header still renders the importing pill.

- [ ] **Step 3: Run the header tests unchanged**

Run: `npx vitest run src/__tests__/HeaderBar.spec.ts`
Expected: PASS with no test edits. This is the proof the extraction changed no behaviour — `#import-json` and `#export-json-btn` are still found, still disabled under the same conditions, and the import still runs from a non-mixes destination.

- [ ] **Step 4: Run the full suite and the formatters**

Run: `npm run test:unit -- run && npm run type-check && npm run lint && npm run format`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/layout/AppMenuItems.vue src/components/layout/HeaderBar.vue
git commit -m "refactor(header): extract the app-level menu items into one component"
```

---

### Task 6: The local-mode menu

Local mode keeps its warning badge and its settings button, and gains the exit that the red logout button used to be.

**Files:**

- Create: `src/components/layout/LocalModeMenu.vue`
- Modify: `src/components/layout/HeaderBar.vue`
- Modify: `src/i18n/locales/en.json`, `src/i18n/locales/fr.json`
- Test: `src/__tests__/LocalModeMenu.spec.ts` (new), `src/__tests__/HeaderBar.spec.ts`

**Interfaces:**

- Consumes: `AppMenuItems` from Task 5; `useAuthStore().signOut()`; `useAppStore().handleSignedOut()`.
- Produces: `LocalModeMenu`, no props, no emits. Trigger id `#settings-menu-btn`, exit item id `#exit-local-mode-btn`.

- [ ] **Step 1: Add the i18n key**

In `src/i18n/locales/en.json`, inside `auth`:

```json
    "exit_local_mode": "Leave local mode"
```

In `src/i18n/locales/fr.json`, inside `auth`:

```json
    "exit_local_mode": "Quitter le mode local"
```

- [ ] **Step 2: Write the failing test**

Create `src/__tests__/LocalModeMenu.spec.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import './mocks/pocketbase'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import LocalModeMenu from '../components/layout/LocalModeMenu.vue'
import i18n from '../i18n'
import { useAppStore } from '../stores/app'
import { useAuthStore } from '../stores/auth'
import { resetPocketbaseMocks } from './mocks/pocketbase'
import { resetLocalStorageMock } from './mocks/localStorage'

function mountLocalModeMenu() {
  return mount(LocalModeMenu, { global: { plugins: [i18n] } })
}

describe('LocalModeMenu', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    resetPocketbaseMocks()
    resetLocalStorageMock()
    i18n.global.locale.value = 'en'
  })

  it('keeps the panel closed until the settings button is used', async () => {
    const wrapper = mountLocalModeMenu()

    expect(wrapper.find('#export-json-btn').exists()).toBe(false)

    await wrapper.get('#settings-menu-btn').trigger('click')

    expect(wrapper.find('#export-json-btn').exists()).toBe(true)
  })

  it('offers the same app actions the signed-in menu offers', async () => {
    const wrapper = mountLocalModeMenu()
    await wrapper.get('#settings-menu-btn').trigger('click')

    expect(wrapper.find('#import-json').exists()).toBe(true)
    expect(wrapper.find('#export-json-btn').exists()).toBe(true)
    expect(wrapper.text()).toContain('Language')
  })

  it('leaves local mode, so the mode is never a dead end', async () => {
    const authStore = useAuthStore()
    const appStore = useAppStore()
    authStore.continueInLocalMode()

    const handleSignedOut = vi.spyOn(appStore, 'handleSignedOut').mockImplementation(() => {})

    const wrapper = mountLocalModeMenu()
    await wrapper.get('#settings-menu-btn').trigger('click')
    await wrapper.get('#exit-local-mode-btn').trigger('click')
    await flushPromises()

    expect(authStore.authMode).toBeNull()
    expect(handleSignedOut).toHaveBeenCalledTimes(1)
  })

  it('closes the panel when the backdrop is used', async () => {
    const wrapper = mountLocalModeMenu()
    await wrapper.get('#settings-menu-btn').trigger('click')

    await wrapper.get('[data-menu-backdrop]').trigger('click')

    expect(wrapper.find('#export-json-btn').exists()).toBe(false)
  })
})
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npx vitest run src/__tests__/LocalModeMenu.spec.ts`
Expected: FAIL — the module `../components/layout/LocalModeMenu.vue` does not exist.

- [ ] **Step 4: Create the component**

Create `src/components/layout/LocalModeMenu.vue`:

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Settings, LogOut } from 'lucide-vue-next'
import AppMenuItems from './AppMenuItems.vue'
import { useAppStore } from '../../stores/app'
import { useAuthStore } from '../../stores/auth'

// Local mode has no account, so it has no account menu: a settings button and
// a warning badge stay two separate things, as they are today. What it does
// need is a way out -- leaving local mode is the only route back to the
// sign-in screen, so it lives here rather than disappearing with the red
// button this menu replaces.
const appStore = useAppStore()
const authStore = useAuthStore()

const { t } = useI18n()

const isMenuOpen = ref(false)

async function handleExitLocalMode() {
  isMenuOpen.value = false
  await authStore.signOut()
  appStore.handleSignedOut()
}
</script>

<template>
  <div class="relative">
    <button
      id="settings-menu-btn"
      type="button"
      class="rounded-lg border border-gray-300 bg-white p-2 shadow-sm transition duration-300 hover:bg-gray-200 focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 focus:outline-none"
      :title="t('app.settings')"
      aria-haspopup="true"
      :aria-expanded="isMenuOpen"
      @click="isMenuOpen = !isMenuOpen"
    >
      <Settings class="h-6 w-6 text-gray-700" />
    </button>

    <div
      v-if="isMenuOpen"
      data-menu-backdrop
      class="fixed inset-0 z-10 cursor-default"
      @click="isMenuOpen = false"
    ></div>

    <div v-if="isMenuOpen" class="header-menu-panel" role="menu">
      <AppMenuItems @done="isMenuOpen = false" />
      <div class="my-1 border-t border-gray-100"></div>
      <button
        id="exit-local-mode-btn"
        class="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 focus:bg-red-50 focus:outline-none"
        role="menuitem"
        @click="handleExitLocalMode"
      >
        <LogOut class="h-4 w-4" />
        {{ t('auth.exit_local_mode') }}
      </button>
    </div>
  </div>
</template>
```

- [ ] **Step 5: Add the shared panel class**

In `src/assets/tailwind.css`, inside `@layer components`, after `.destination-tab-active`:

```css
/* The dropdown shell both header menus use. Anchored to its trigger rather
     than portalled: the header is not sticky and creates no stacking context,
     so nothing here can be trapped underneath a later sibling. */
.header-menu-panel {
  @apply absolute right-0 z-20 mt-2 w-56 origin-top-right rounded-md border border-gray-300 bg-white py-1 shadow-xl focus:outline-none;
}
```

- [ ] **Step 6: Render it from `HeaderBar.vue` in local mode**

Import it:

```ts
import LocalModeMenu from './LocalModeMenu.vue'
```

Make two edits in the template, and change nothing else in that block.

First, insert one line immediately **before** the existing `<div class="relative">` that wraps the settings button:

```vue
<LocalModeMenu v-if="authStore.authMode === 'local'" />
```

Second, add `v-else` to that existing wrapper, leaving its button, backdrop and panel exactly as they are:

```vue
        <div v-else class="relative">
```

Task 7 deletes this `v-else` branch outright when `AccountMenu` takes over the signed-in path; until then it keeps serving it unchanged.

Then gate the red logout button so local mode no longer shows it:

```vue
        <button
          v-if="authStore.authMode !== 'local'"
          id="logout-btn"
```

- [ ] **Step 7: Update the header test that drove the import from local mode**

In `src/__tests__/HeaderBar.spec.ts`, the test `'runs the import from a non-mixes destination, not only from the mixes view'` calls `authStore.continueInLocalMode()` and then clicks `#settings-menu-btn`. That id now belongs to `LocalModeMenu`, which renders `AppMenuItems` all the same, so the test passes unchanged. Confirm it does; if it fails, the gating in Step 6 is wrong, not the test.

- [ ] **Step 8: Run the tests**

Run: `npx vitest run src/__tests__/LocalModeMenu.spec.ts src/__tests__/HeaderBar.spec.ts src/__tests__/locales.spec.ts`
Expected: PASS.

- [ ] **Step 9: Run the full suite and the formatters**

Run: `npm run test:unit -- run && npm run type-check && npm run lint && npm run format`
Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add src/components/layout/LocalModeMenu.vue src/components/layout/HeaderBar.vue src/assets/tailwind.css src/i18n/locales/en.json src/i18n/locales/fr.json src/__tests__/LocalModeMenu.spec.ts
git commit -m "feat(header): give local mode its own settings menu with a way out"
```

---

### Task 7: The account menu

The four signed-in identity controls become one avatar carrying a status dot.

**Files:**

- Create: `src/components/layout/AccountMenu.vue`
- Modify: `src/components/layout/HeaderBar.vue`
- Modify: `src/i18n/locales/en.json`, `src/i18n/locales/fr.json`
- Modify: `src/__tests__/mocks/pocketbase.ts`
- Test: `src/__tests__/AccountMenu.spec.ts` (new), `src/__tests__/HeaderBar.spec.ts`

**Interfaces:**

- Consumes: `AppMenuItems` from Task 5; `.header-menu-panel` from Task 6; `useAuthStore().user` / `.signOut()`; `useAppStore().isReadOnly` / `.handleSignedOut()`; `useFavoritesStore().importProgress`.
- Produces: `AccountMenu`, no props, no emits. Trigger id `#account-menu-btn`, sign-out item id `#logout-btn`, status dot `[data-account-status]` carrying the status name as its value.

- [ ] **Step 1: Add the i18n keys**

All three at once, so no step below references a key that does not exist yet.

In `src/i18n/locales/en.json`, inside `auth`:

```json
    "account_menu_aria": "Account menu",
    "account_signed_in_label": "Signed in as",
    "status_synced": "Synced"
```

In `src/i18n/locales/fr.json`, inside `auth`:

```json
    "account_menu_aria": "Menu du compte",
    "account_signed_in_label": "Connecté en tant que",
    "status_synced": "Synchronisé"
```

- [ ] **Step 2: Teach the PocketBase mock to build file URLs**

In `src/__tests__/mocks/pocketbase.ts`, add to the `mockPocketbase` object, after `filter`:

```ts
  // The avatar is a plain unprotected file field, so the real SDK just
  // assembles an address. The double returns a recognisable one rather than a
  // realistic one: specs assert that an address was produced from the record's
  // own filename, never what a PocketBase deployment would serve.
  files: {
    getURL: vi.fn(
      (record: { id?: string }, filename: string, options?: { thumb?: string }) =>
        `https://pb.test/api/files/users/${record?.id}/${filename}${
          options?.thumb ? `?thumb=${options.thumb}` : ''
        }`,
    ),
  },
```

and add to `resetPocketbaseMocks()`:

```ts
mockPocketbase.files.getURL.mockClear()
```

- [ ] **Step 3: Write the failing test**

Create `src/__tests__/AccountMenu.spec.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import './mocks/pocketbase'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import type { RecordModel } from 'pocketbase'
import AccountMenu from '../components/layout/AccountMenu.vue'
import i18n from '../i18n'
import { useAppStore } from '../stores/app'
import { useAuthStore } from '../stores/auth'
import { useFavoritesStore } from '../stores/favorites'
import { resetPocketbaseMocks } from './mocks/pocketbase'
import { resetLocalStorageMock } from './mocks/localStorage'

function createUser(overrides: Partial<RecordModel> = {}): RecordModel {
  return {
    id: 'user-1',
    collectionId: 'users',
    collectionName: 'users',
    name: 'Baptiste Pasquier',
    email: 'baptiste@example.com',
    avatar: 'photo.jpg',
    ...overrides,
  } as RecordModel
}

function mountAccountMenu() {
  return mount(AccountMenu, { global: { plugins: [i18n] } })
}

function signIn(user: RecordModel = createUser()) {
  const authStore = useAuthStore()
  authStore.authMode = 'google'
  authStore.user = user
  return authStore
}

describe('AccountMenu', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    resetPocketbaseMocks()
    resetLocalStorageMock()
    i18n.global.locale.value = 'en'
  })

  it('renders the Google photo when the record carries one', () => {
    signIn()

    const wrapper = mountAccountMenu()
    const image = wrapper.get('img')

    expect(image.attributes('src')).toBe(
      'https://pb.test/api/files/users/user-1/photo.jpg?thumb=100x100',
    )
  })

  it('falls back to the initial when the record carries no avatar', () => {
    signIn(createUser({ avatar: '' }))

    const wrapper = mountAccountMenu()

    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.get('#account-menu-btn').text()).toBe('B')
  })

  it('falls back to the initial when the photo fails to load', async () => {
    signIn()

    const wrapper = mountAccountMenu()
    await wrapper.get('img').trigger('error')

    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.get('#account-menu-btn').text()).toBe('B')
  })

  it('shows a green dot on a healthy session', () => {
    signIn()

    const wrapper = mountAccountMenu()

    expect(wrapper.get('[data-account-status]').attributes('data-account-status')).toBe('synced')
  })

  it('shows an amber dot when the session fell back to the read-only cache', () => {
    signIn()
    const favoritesStore = useFavoritesStore()
    favoritesStore.repositoryMode = 'google-cache'

    const wrapper = mountAccountMenu()

    expect(wrapper.get('[data-account-status]').attributes('data-account-status')).toBe('readonly')
  })

  it('shows a blue dot while an import is running, ahead of every other state', () => {
    signIn()
    const favoritesStore = useFavoritesStore()
    favoritesStore.repositoryMode = 'google-cache'
    favoritesStore.importProgress = { processed: 12, total: 80 }

    const wrapper = mountAccountMenu()

    expect(wrapper.get('[data-account-status]').attributes('data-account-status')).toBe('importing')
  })

  it('names the account and its state only once the panel is open', async () => {
    signIn()

    const wrapper = mountAccountMenu()
    expect(wrapper.text()).not.toContain('baptiste@example.com')

    await wrapper.get('#account-menu-btn').trigger('click')

    expect(wrapper.text()).toContain('baptiste@example.com')
    expect(wrapper.text()).toContain('Synced')
  })

  it('carries the app actions and signs out', async () => {
    const authStore = signIn()
    const appStore = useAppStore()
    const handleSignedOut = vi.spyOn(appStore, 'handleSignedOut').mockImplementation(() => {})

    const wrapper = mountAccountMenu()
    await wrapper.get('#account-menu-btn').trigger('click')

    expect(wrapper.find('#import-json').exists()).toBe(true)
    expect(wrapper.find('#export-json-btn').exists()).toBe(true)

    await wrapper.get('#logout-btn').trigger('click')
    await flushPromises()

    expect(authStore.authMode).toBeNull()
    expect(handleSignedOut).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 4: Run it to verify it fails**

Run: `npx vitest run src/__tests__/AccountMenu.spec.ts`
Expected: FAIL — the module `../components/layout/AccountMenu.vue` does not exist.

- [ ] **Step 5: Create the component**

Create `src/components/layout/AccountMenu.vue`:

```vue
<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { LogOut } from 'lucide-vue-next'
import AppMenuItems from './AppMenuItems.vue'
import pb from '../../services/pocketbase'
import { useAppStore } from '../../stores/app'
import { useAuthStore } from '../../stores/auth'
import { useFavoritesStore } from '../../stores/favorites'

// The one identity control of a signed-in session: what used to be an import
// pill, a status badge, a settings button and a red logout button. The dot
// signals the session's state; the wording for that state exists only inside
// the open panel.
const appStore = useAppStore()
const authStore = useAuthStore()
const favoritesStore = useFavoritesStore()

const { t } = useI18n()

const isMenuOpen = ref(false)
const hasImageFailed = ref(false)

const displayName = computed(
  () => authStore.user?.name || authStore.user?.email || t('auth.local_mode'),
)

const initial = computed(() => (displayName.value.charAt(0) || '?').toUpperCase())

// Built only from a non-empty filename: an account signed in before the
// provider returned a photo carries none, and the SDK would otherwise hand
// back an address ending in a bare slash.
const avatarUrl = computed(() => {
  const user = authStore.user
  const filename = typeof user?.avatar === 'string' ? user.avatar : ''
  if (!user || !filename) return null
  return pb.files.getURL(user, filename, { thumb: '100x100' })
})

// The address stays valid-looking after the file is removed server-side, so a
// load error is the only signal that the photo is gone.
const showsImage = computed(() => Boolean(avatarUrl.value) && !hasImageFailed.value)

// Read over the sources that already exist -- no new state, and no second
// read-only switch beside useAppStore.isReadOnly (KTD6). An import in flight
// outranks the rest: it is the state that is about to change the others.
const status = computed<'importing' | 'readonly' | 'synced'>(() => {
  if (favoritesStore.importProgress) return 'importing'
  if (appStore.isReadOnly) return 'readonly'
  return 'synced'
})

const STATUS_DOT_CLASS: Record<'importing' | 'readonly' | 'synced', string> = {
  importing: 'bg-blue-500',
  readonly: 'bg-amber-500',
  synced: 'bg-green-500',
}

const STATUS_CHIP_CLASS: Record<'importing' | 'readonly' | 'synced', string> = {
  importing: 'border-blue-200 bg-blue-50 text-blue-700',
  readonly: 'border-amber-200 bg-amber-50 text-amber-700',
  synced: 'border-green-200 bg-green-50 text-green-700',
}

const statusLabel = computed(() => {
  const progress = favoritesStore.importProgress
  if (progress) {
    return progress.total === null
      ? t('app.importing_preparing')
      : t('app.importing', { processed: progress.processed, total: progress.total })
  }
  if (appStore.isReadOnly) return t('auth.offline_read_only')
  return t('auth.status_synced')
})

async function handleSignOut() {
  isMenuOpen.value = false
  await authStore.signOut()
  appStore.handleSignedOut()
}
</script>

<template>
  <div class="relative">
    <button
      id="account-menu-btn"
      type="button"
      class="relative rounded-full transition hover:ring-2 hover:ring-gray-300 focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 focus:outline-none"
      :aria-label="t('auth.account_menu_aria')"
      :title="t('auth.signed_in_as', { name: displayName })"
      aria-haspopup="true"
      :aria-expanded="isMenuOpen"
      @click="isMenuOpen = !isMenuOpen"
    >
      <img
        v-if="showsImage"
        :src="avatarUrl ?? undefined"
        alt=""
        class="h-9 w-9 rounded-full object-cover ring-1 ring-black/5"
        @error="hasImageFailed = true"
      />
      <span
        v-else
        class="grid h-9 w-9 place-items-center rounded-full bg-blue-100 text-sm font-semibold text-blue-700 ring-1 ring-black/5"
      >
        {{ initial }}
      </span>
      <span
        :data-account-status="status"
        aria-hidden="true"
        class="absolute -right-0.5 -bottom-0.5 h-3 w-3 rounded-full ring-2 ring-[#f0f2f5]"
        :class="STATUS_DOT_CLASS[status]"
      ></span>
    </button>

    <div
      v-if="isMenuOpen"
      data-menu-backdrop
      class="fixed inset-0 z-10 cursor-default"
      @click="isMenuOpen = false"
    ></div>

    <div v-if="isMenuOpen" class="header-menu-panel" role="menu">
      <div class="px-4 pt-2 pb-3">
        <p class="text-xs font-semibold tracking-wider text-gray-500 uppercase">
          {{ t('auth.account_signed_in_label') }}
        </p>
        <p class="truncate text-sm font-medium text-gray-900">{{ displayName }}</p>
        <p class="truncate text-xs text-gray-500">{{ authStore.user?.email }}</p>
        <span
          class="mt-2 inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-semibold"
          :class="STATUS_CHIP_CLASS[status]"
        >
          <span class="h-1.5 w-1.5 rounded-full" :class="STATUS_DOT_CLASS[status]"></span>
          {{ statusLabel }}
        </span>
      </div>
      <div class="my-1 border-t border-gray-100"></div>
      <AppMenuItems @done="isMenuOpen = false" />
      <div class="my-1 border-t border-gray-100"></div>
      <button
        id="logout-btn"
        class="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 focus:bg-red-50 focus:outline-none"
        role="menuitem"
        @click="handleSignOut"
      >
        <LogOut class="h-4 w-4" />
        {{ t('auth.logout') }}
      </button>
    </div>
  </div>
</template>
```

- [ ] **Step 6: Run the account tests**

Run: `npx vitest run src/__tests__/AccountMenu.spec.ts`
Expected: PASS.

- [ ] **Step 7: Render it from `HeaderBar.vue` and delete what it replaces**

Import it:

```ts
import AccountMenu from './AccountMenu.vue'
```

Replace the whole identity block — the `<div class="mt-4 flex flex-col …">`'s first child holding the import pill and the three badges, plus the settings `<div class="relative">` and the red `#logout-btn` — with, inside `.favorites-header-controls` after the `<nav>`:

```vue
<span
  v-if="authStore.authMode === 'local'"
  class="flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-sm font-medium text-amber-700"
  :title="t('login.local_mode_info')"
>
          <TriangleAlert class="h-4 w-4" />
          {{ t('auth.local_mode') }}
        </span>
<LocalModeMenu v-if="authStore.authMode === 'local'" />
<AccountMenu v-else />
```

Then delete from `HeaderBar.vue`: the `importingLabel` computed, the `authDisplayName` computed, the `handleLogout` function, the `useFavoritesStore` and `useAppStore` imports with their constants, the `AppMenuItems` import, the `isMenuOpen` ref, and the `Settings`, `LoaderCircle` and `LogOut` icon imports. `TriangleAlert` stays.

- [ ] **Step 8: Rewrite the header tests for the new shape**

In `src/__tests__/HeaderBar.spec.ts`, replace the tests `'shows the offline read-only badge and disables import when the cache fallback is active'`, `'does not show the offline badge when signed in online'`, `'keeps the app-level settings menu on every destination'` and `'runs the import from a non-mixes destination, not only from the mixes view'` with:

```ts
it('gives a signed-in session one identity control and no loose buttons', () => {
  const authStore = useAuthStore()
  authStore.authMode = 'google'
  authStore.user = createUser('user-1')

  const wrapper = mountHeaderBar()

  expect(wrapper.find('#account-menu-btn').exists()).toBe(true)
  expect(wrapper.find('#settings-menu-btn').exists()).toBe(false)
  expect(wrapper.find('#logout-btn').exists()).toBe(false)
  expect(wrapper.text()).not.toContain('Local Mode')
})

it('gives local mode a warning badge and a settings menu, and no account control', () => {
  const authStore = useAuthStore()
  authStore.continueInLocalMode()

  const wrapper = mountHeaderBar()

  expect(wrapper.text()).toContain('Local Mode')
  expect(wrapper.find('#settings-menu-btn').exists()).toBe(true)
  expect(wrapper.find('#account-menu-btn').exists()).toBe(false)
})

it('keeps an identity control on every destination', async () => {
  const authStore = useAuthStore()
  authStore.authMode = 'google'
  authStore.user = createUser('user-1')

  const router = createTestRouter()

  for (const destination of ['/', '/events', '/artists']) {
    await router.push(destination)
    await router.isReady()

    const wrapper = mountHeaderBar(router)
    expect(wrapper.find('#account-menu-btn').exists()).toBe(true)
  }
})
```

The import behaviour those deleted tests covered now lives in `AccountMenu.spec.ts` and `LocalModeMenu.spec.ts`, both of which assert `#import-json` and `#export-json-btn` are reachable.

- [ ] **Step 9: Run the full suite and the formatters**

Run: `npm run test:unit -- run && npm run type-check && npm run lint && npm run format`
Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add src/components/layout/AccountMenu.vue src/components/layout/HeaderBar.vue src/i18n/locales/en.json src/i18n/locales/fr.json src/__tests__/mocks/pocketbase.ts src/__tests__/AccountMenu.spec.ts src/__tests__/HeaderBar.spec.ts
git commit -m "feat(header): collapse the signed-in identity controls into one account menu"
```

---

### Task 8: The phone header loses two rows

**Files:**

- Create: `src/components/layout/HeaderIdentity.vue`
- Modify: `src/components/layout/HeaderBar.vue`
- Modify: `src/assets/tailwind.css` (`.favorites-header`)
- Test: `src/__tests__/HeaderBar.spec.ts`

**Interfaces:**

- Consumes: `AccountMenu` and `LocalModeMenu` from Tasks 6 and 7.
- Produces: `HeaderIdentity`, no props, no emits — the session's identity in one definition, mounted twice by the header.

- [ ] **Step 1: Write the failing test**

Add to `src/__tests__/HeaderBar.spec.ts`:

```ts
it('hides the subtitle below sm, where the row is the scarce thing', () => {
  const wrapper = mountHeaderBar()
  const subtitle = wrapper.get('[data-app-subtitle]')

  expect(subtitle.text()).toBe('Save your favorite mixes and their highlights.')
  expect(subtitle.classes()).toContain('hidden')
  expect(subtitle.classes()).toContain('sm:block')
})

it('sits the identity control beside the title below sm and beside the tabs above it', () => {
  const authStore = useAuthStore()
  authStore.authMode = 'google'
  authStore.user = createUser('user-1')

  const wrapper = mountHeaderBar()
  const controls = wrapper.findAll('#account-menu-btn')

  expect(controls).toHaveLength(2)

  const besideTitle = controls[0].element.closest('[data-header-identity="title"]')
  const besideTabs = controls[1].element.closest('[data-header-identity="tabs"]')

  expect(besideTitle).not.toBeNull()
  expect(besideTabs).not.toBeNull()
})
```

Both positions are in the DOM at once; which one is visible is decided by `sm:hidden` and
`hidden sm:flex`, which jsdom does not evaluate. Asserting two mounts is therefore the honest
assertion — the breakpoint behaviour itself is covered by the manual check at the end of this
plan.

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/__tests__/HeaderBar.spec.ts -t 'subtitle'`
Expected: FAIL — no element carries `data-app-subtitle`.

- [ ] **Step 3: Give the two positions one definition**

The identity is a badge-plus-menu pair in local mode and a single menu when signed in. It is
about to be mounted at two places in the header, so it gets one definition first.

Create `src/components/layout/HeaderIdentity.vue`:

```vue
<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { TriangleAlert } from 'lucide-vue-next'
import AccountMenu from './AccountMenu.vue'
import LocalModeMenu from './LocalModeMenu.vue'
import { useAuthStore } from '../../stores/auth'

// Whatever the session's identity is, in one definition. The header mounts it
// at two positions -- beside the title on a phone, beside the tabs from sm --
// so this component exists to keep those two from drifting apart.
const authStore = useAuthStore()

const { t } = useI18n()
</script>

<template>
  <template v-if="authStore.authMode === 'local'">
    <span
      class="flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-sm font-medium text-amber-700"
      :title="t('login.local_mode_info')"
    >
      <TriangleAlert class="h-4 w-4" />
      {{ t('auth.local_mode') }}
    </span>
    <LocalModeMenu />
  </template>
  <AccountMenu v-else />
</template>
```

- [ ] **Step 4: Mark the subtitle and mount the identity at both positions**

In `src/components/layout/HeaderBar.vue`, import the new component with the other local ones:

```ts
import HeaderIdentity from './HeaderIdentity.vue'
```

Replace the brand block with:

```vue
    <div class="flex w-full items-center justify-between gap-4 sm:w-auto sm:justify-start">
      <div class="flex items-center gap-4">
        <img src="/icon.svg" alt="GrooveMark Logo" class="h-16 w-16" />
        <div>
          <h1 class="text-4xl font-bold text-gray-900">{{ t('app.title') }}</h1>
          <p data-app-subtitle class="hidden text-gray-600 sm:block">{{ t('app.subtitle') }}</p>
        </div>
      </div>
      <!-- Below sm the identity rides with the title, which is what frees the
           two rows it used to occupy. From sm up the header is one line and it
           belongs at its right end, beside the tabs. Two mounts rather than one
           moved by `order`, because the two positions sit in different flex
           containers. -->
      <div data-header-identity="title" class="flex items-center gap-2 sm:hidden">
        <HeaderIdentity />
      </div>
    </div>
```

and mount the second position inside `.favorites-header-controls`, after the `<nav>`:

```vue
<div data-header-identity="tabs" class="hidden items-center gap-2 sm:flex">
          <HeaderIdentity />
        </div>
```

Then delete the inline warning badge, the `<LocalModeMenu />` and the `<AccountMenu />` that Task 7
left directly in `HeaderBar.vue`, together with their two imports and the now-unused
`TriangleAlert` import. `HeaderIdentity` is the only thing that renders them from here on.

- [ ] **Step 5: Let the header row breathe on a phone**

In `src/assets/tailwind.css`, replace `.favorites-header` with:

```css
/* The gap below the header is halved on a phone, where the controls stack
     into their own rows and the screen has no height to spare. From sm up the
     header sits on one line and keeps its original room. */
.favorites-header {
  @apply layout-2col:mx-0 layout-2col:w-full mb-4 flex flex-col items-center justify-between gap-3 sm:flex-row md:mx-auto md:mb-8 md:w-[var(--layout-grid-width-2col)];
}
```

- [ ] **Step 6: Run the tests**

Run: `npx vitest run src/__tests__/HeaderBar.spec.ts`
Expected: PASS.

- [ ] **Step 7: Run the full suite, the formatters and the e2e**

Run: `npm run test:unit -- run && npm run type-check && npm run lint && npm run format && npm run test:e2e`
Expected: PASS. The Playwright specs address `#add-event-btn`, `#artists-search`, `#artists-sort-select`, `.artists-sort-header` and the `Nouveau favori` button by name — none of those moved or changed name.

- [ ] **Step 8: Commit**

```bash
git add src/components/layout/HeaderBar.vue src/components/layout/HeaderIdentity.vue src/assets/tailwind.css src/__tests__/HeaderBar.spec.ts
git commit -m "feat(header): drop two rows from the phone header"
```

---

### Task 9: Documentation

**Files:**

- Create: `docs/journal/decisions/0004-one-account-menu-in-the-header.md`
- Modify: `docs/reference/responsive-layout.md`
- Modify: `docs/explanation/architecture.md`
- Modify: `AGENTS.md`
- Modify: `CHANGELOG.md`

**Interfaces:**

- Consumes: everything above.
- Produces: nothing.

- [ ] **Step 1: Write the ADR**

Create `docs/journal/decisions/0004-one-account-menu-in-the-header.md`, following the shape of `docs/journal/decisions/0003-events-and-performances-as-records.md`:

```markdown
# 4. One account menu in the header

Date: 2026-09-12

## Status

Accepted

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

## Consequences

The phone header is three rows instead of five.

`useEventsUiStore` gains a sort order, applied over the domain store's canonical date ordering
rather than replacing it.

The header emits nothing: no destination view wires up a header control any more.

A header control that must exist in both a signed-in and a local-mode session now has two
components to be added to, not one. `AppMenuItems` exists to keep that from becoming two
divergent lists.
```

- [ ] **Step 2: Record the store change**

`docs/explanation/architecture.md:123` currently opens with:

```markdown
`useEventsUiStore` owns the events tab's search, and `useArtistsUiStore` owns slug lookup for
```

Replace that clause so the sentence reads:

```markdown
`useEventsUiStore` owns the events tab's search and the direction it is read in — the ordering
itself stays in `useEventsStore`, so the UI store filters, then reverses what the filter left.
`useArtistsUiStore` owns slug lookup for
```

leaving the rest of the original sentence untouched.

In `AGENTS.md`, change the store-responsibilities line to:

```markdown
- `useEventsUiStore`: the events tab's search, its sort direction and its filtered list
```

- [ ] **Step 3: Record the layout classes**

`docs/reference/responsive-layout.md` already gained the `.view-*` entries in Task 1. Add, to the same glossary list:

```markdown
- `.mixes-body`: the mixes zone as one block — the controls row and the sidebar-plus-grid share
  one left edge because the row is the outer element's first child. Carries the centring
  `.favorites-layout` used to carry.
- `.header-menu-panel`: the dropdown shell both header menus use, anchored to its trigger.
```

`.favorites-mobile-controls` no longer exists, and it is named in **four** places in this file. Each needs its own replacement:

| Line | Section                         | Replace with                                                                              |
| ---- | ------------------------------- | ----------------------------------------------------------------------------------------- |
| 128  | Small Mobile                    | `- \`.view-controls\` stacks: search + sort + filter on one line, then the create button` |
| 139  | Tablet / Two-Column Pre-Desktop | `- \`.view-controls\` is a single row above the grid`                                     |
| 159  | Desktop Sidebar Stage           | `- \`.view-controls\` sits inside \`.mixes-body\`, above the sidebar and the grid`        |
| 292  | Class glossary                  | delete the line outright — the `.view-controls` entry from Task 1 replaces it             |

Two neighbouring claims in the same file also stop being true and must be corrected in the same pass:

- Under **Desktop Sidebar Stage**, `- \`.favorites-header\` returns to full shell width`stays true, but add`- \`.mixes-body\` is centred on the sidebar-plus-grid width, which the controls row therefore shares`.
- Under **Tablet / Two-Column Pre-Desktop**, the list ending "all share the same effective width" names `search` and `add button` as separate items. Replace those two bullets with one: `- the controls row`.

Run `grep -n 'favorites-mobile-controls' docs/` afterwards and confirm it returns nothing.

- [ ] **Step 4: Update the changelog**

In `CHANGELOG.md`, under the unreleased heading:

```markdown
### Changed

- The account badge, the settings button and the logout button are now one account menu, with a
  status dot reporting whether the session is synced, read-only or importing.
- The search field, the date sort and the create button sit in the same row on all three tabs.
- The events tab can be read oldest-first.
- The phone header is two rows shorter.
```

- [ ] **Step 5: Run the docs gate**

Run: `npm run check:docs`
Expected: `docs/ structure OK`.

- [ ] **Step 6: Run everything one last time**

Run: `npm run test:unit -- run && npm run type-check && npm run lint && npm run format && npm run check:docs`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add docs AGENTS.md CHANGELOG.md
git commit -m "docs: record the header redesign"
```

---

## Manual Verification

Run `npm run dev` and check, at a phone width and at a desktop width:

| Check                          | Expected                                                                                               |
| ------------------------------ | ------------------------------------------------------------------------------------------------------ |
| Phone, signed in               | Three rows above the first card: title + avatar, tabs, search + sort + filter. Then the create button. |
| Phone, local mode              | Same three rows, with the warning badge and the settings button beside the title.                      |
| Desktop, mixes                 | The controls row shares its left edge with the sidebar; the sidebar holds the artist list alone.       |
| Desktop, all tabs              | The search field is the same size and in the same place on all three.                                  |
| Avatar dot                     | Green signed in; amber with the backend stopped; blue while a large import runs.                       |
| Account panel                  | Name, email, status chip, language, import, export, sign out.                                          |
| Events sort                    | Toggling reverses the grid; typing in the search then toggling reverses only the matches.              |
| Leaving and returning to a tab | The search box is empty and the list unfiltered; the sort direction is unchanged.                      |

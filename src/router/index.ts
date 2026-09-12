import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw, Router } from 'vue-router'
import ArtistPage from '../components/artists/ArtistPage.vue'
import ArtistsView from '../components/artists/ArtistsView.vue'
import EventsGrid from '../components/events/EventsGrid.vue'
import MixesView from '../components/favorites/MixesView.vue'
import { useArtistsUiStore } from '../stores/artistsUi'
import { useEventsUiStore } from '../stores/eventsUi'
import { useFavoritesUiStore } from '../stores/favoritesUi'

export const routes: RouteRecordRaw[] = [
  { path: '/', name: 'mixes', component: MixesView },
  { path: '/events', name: 'events', component: EventsGrid },
  { path: '/artists', name: 'artists', component: ArtistsView },
  // An artist address is keyed on the artist's slug. A slug is a folded display
  // name, not a URL token, so it travels percent-encoded: always build this
  // address from the route name and a `slug` param, never by concatenation.
  { path: '/artists/:slug', name: 'artist', component: ArtistPage },
  // An unrecognized address lands on the mixes destination rather than an empty shell.
  { path: '/:pathMatch(.*)*', redirect: { name: 'mixes' } },
]

// A search box is uncontrolled -- the input holds what was typed, the store
// holds the term -- while the term lives in an app-scoped store that outlives
// the view. Leaving a destination and coming back would therefore show an
// empty box above a still-filtered list, with nothing on screen explaining
// why. Clearing on leave keeps the box and the list in agreement.
//
// Only the search is cleared, and only for the destination being left. The
// artists table's sort and the mixes artist filter stay readable in their own
// controls when the view comes back, so neither can drift out of step the way
// an uncontrolled input can -- which is also why `$reset()` is not used here.
const clearSearchOnLeave: Partial<Record<string, () => void>> = {
  mixes: () => useFavoritesUiStore().setSearch(''),
  events: () => useEventsUiStore().setSearch(''),
  artists: () => useArtistsUiStore().setSearch(''),
}

// One guard owns the rule, rather than an unmount hook copied into each of the
// three views where the three copies could drift. The stores are resolved
// inside the guard because this module is imported before Pinia is installed.
export function registerSearchReset(router: Router) {
  router.afterEach((to, from) => {
    // Staying on the same destination -- an artist page reached from another
    // artist page, say -- is not leaving it.
    if (from.name === to.name) return
    if (typeof from.name !== 'string') return

    clearSearchOnLeave[from.name]?.()
  })
}

// The base comes from the build (`--base=/groovemark/` for the subpath deploy,
// `/` for the container image), so one source serves both deploy targets.
const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})

registerSearchReset(router)

export default router

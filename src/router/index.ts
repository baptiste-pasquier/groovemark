import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'
import ArtistPage from '../components/artists/ArtistPage.vue'
import ArtistsView from '../components/artists/ArtistsView.vue'
import EventsGrid from '../components/events/EventsGrid.vue'
import MixesView from '../components/favorites/MixesView.vue'

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

// The base comes from the build (`--base=/groovemark/` for the subpath deploy,
// `/` for the container image), so one source serves both deploy targets.
const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})

export default router

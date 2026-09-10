import { defineComponent, h } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'
import ArtistPage from '../components/artists/ArtistPage.vue'
import EventsGrid from '../components/events/EventsGrid.vue'
import MixesView from '../components/favorites/MixesView.vue'
import HeaderBar from '../components/layout/HeaderBar.vue'

// The artists tab lands in a later unit of this phase. Its route exists now so
// every address already resolves; replace the placeholder component with the
// real view when the surface is built.
// A placeholder still renders the header, because every destination has to
// keep the destination switcher on screen or the visitor is stranded.
function placeholderDestination(name: string) {
  return defineComponent({
    name,
    render: () => h('div', { 'data-placeholder-destination': name }, [h(HeaderBar)]),
  })
}

export const routes: RouteRecordRaw[] = [
  { path: '/', name: 'mixes', component: MixesView },
  { path: '/events', name: 'events', component: EventsGrid },
  { path: '/artists', name: 'artists', component: placeholderDestination('ArtistsView') },
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

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRoute } from 'vue-router'
import { CalendarDays, MapPin, TriangleAlert } from 'lucide-vue-next'
import HeaderBar from '../layout/HeaderBar.vue'
import FavoriteCard from '../favorites/FavoriteCard.vue'
import VerdictBadge from '../events/VerdictBadge.vue'
import { useArtistsUiStore } from '../../stores/artistsUi'
import { useEventsStore } from '../../stores/events'
import { useFavoritesUiStore } from '../../stores/favoritesUi'
import { formatDayAttended } from '../../utils/event'

const artistsUiStore = useArtistsUiStore()
const eventsStore = useEventsStore()
const favoritesUiStore = useFavoritesUiStore()

const { t, locale } = useI18n()
const route = useRoute()

// The address carries the artist's slug, percent-decoded by the router before
// it reaches here. A slug is a folded display name, so it is matched as given
// rather than folded again (KTD14).
const slug = computed(() => String(route.params.slug ?? ''))

const artist = computed(() => artistsUiStore.artistBySlug(slug.value))

// An unresolved address means two different things, and the page has to say
// which. With the artist set loaded, it means no such artist -- documented
// behaviour for a link shared before a rename. With the load failed, the set is
// empty or stale and the honest answer is "cannot say": the events tab would
// still render fully from its denormalized names, so without this the whole
// artists destination would read as not-found with no explanation.
const isUnavailable = computed(() => !artist.value && artistsUiStore.artistsUnavailable)
const isNotFound = computed(() => !artist.value && !artistsUiStore.artistsUnavailable)

// Both halves read loaded state only, through the owners of these numbers: the
// mix aggregate belongs to the favorites-UI store and the live history to the
// events store, so this page derives neither a count nor an ordering of its
// own and cannot disagree with the artists tab (KTD12, KTD16).
const mixes = computed(() => (artist.value ? favoritesUiStore.mixesFor(artist.value.id) : []))
const mixAggregate = computed(() => favoritesUiStore.mixAggregateFor(artist.value?.id ?? ''))
const history = computed(() => eventsStore.performanceHistoryFor(artist.value?.id ?? ''))

function attendedOn(day: string) {
  return formatDayAttended(day, locale.value)
}
</script>

<template>
  <HeaderBar />

  <main class="artist-page">
    <div
      v-if="isUnavailable"
      class="artist-unavailable flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-800"
    >
      <TriangleAlert class="mt-0.5 h-5 w-5 shrink-0" />
      <p>{{ t('artist_page.unavailable') }}</p>
    </div>

    <div v-else-if="isNotFound" class="artist-not-found flex flex-col items-start gap-3">
      <p class="text-gray-600">{{ t('artist_page.not_found') }}</p>
      <RouterLink
        :to="{ name: 'artists' }"
        class="artist-back-link rounded-lg bg-blue-500 px-4 py-2 font-bold text-white shadow-sm transition duration-300 hover:bg-blue-600"
      >
        {{ t('artist_page.back_to_artists') }}
      </RouterLink>
    </div>

    <template v-else-if="artist">
      <h2 class="artist-page-name text-3xl font-bold text-gray-900">{{ artist.displayName }}</h2>

      <!-- Both halves are stacked sections at every width, and an empty half
           renders as empty rather than disappearing (R15). -->
      <section id="artist-mixes" class="artist-section">
        <h3 class="text-xs font-bold tracking-wider text-gray-500 uppercase">
          {{ t('artist_page.heading_mixes') }}
        </h3>

        <div class="artist-stats">
          <div class="artist-stat rounded-xl bg-white px-4 py-3 shadow-sm">
            <p class="artist-stat-value text-2xl font-bold text-gray-900">
              {{ mixAggregate.mixCount }}
            </p>
            <p class="artist-stat-label text-sm text-gray-500">
              {{ t('artist_page.stat_mixes') }}
            </p>
          </div>
          <div class="artist-stat rounded-xl bg-white px-4 py-3 shadow-sm">
            <p class="artist-stat-value text-2xl font-bold text-gray-900">
              {{ mixAggregate.momentCount }}
            </p>
            <p class="artist-stat-label text-sm text-gray-500">
              {{ t('artist_page.stat_moments') }}
            </p>
          </div>
          <div class="artist-stat rounded-xl bg-white px-4 py-3 shadow-sm">
            <p class="artist-stat-value text-2xl font-bold text-gray-900">
              {{ mixAggregate.starredMomentCount }}
            </p>
            <p class="artist-stat-label text-sm text-gray-500">
              {{ t('artist_page.stat_starred') }}
            </p>
          </div>
        </div>

        <!-- The mixes are read here, not revised: editing a mix stays on the
             mixes destination, where the editing surface lives. -->
        <div v-if="mixes.length" id="artist-mixes-grid" class="card-grid">
          <FavoriteCard v-for="mix in mixes" :key="mix.id" :favorite="mix" read-only />
        </div>
        <p v-else class="artist-mixes-empty text-gray-500">{{ t('artist_page.no_mixes') }}</p>
      </section>

      <section id="artist-live" class="artist-section">
        <h3 class="text-xs font-bold tracking-wider text-gray-500 uppercase">
          {{ t('artist_page.heading_live') }}
        </h3>

        <!-- The half leads with the most recent *rated* verdict and that
             night's date, which is not always the latest night: an unrated
             latest performance would otherwise silence the summary exactly
             when it is being consulted (R14, AE1). -->
        <div
          v-if="history.latestRated"
          class="artist-latest-verdict flex flex-wrap items-center gap-2 rounded-xl bg-white px-4 py-3 shadow-sm"
        >
          <VerdictBadge :verdict="history.latestRated.verdict" />
          <span class="text-sm text-gray-500">
            {{
              t('artist_page.latest_verdict', {
                date: attendedOn(history.latestRated.dateAttended),
              })
            }}
          </span>
        </div>
        <p v-else-if="history.performances.length" class="artist-no-rated-verdict text-gray-500">
          {{ t('artist_page.no_rated_verdict') }}
        </p>

        <ul v-if="history.performances.length" class="flex flex-col gap-2">
          <li
            v-for="performance in history.performances"
            :key="performance.performanceId"
            class="artist-performance flex flex-col gap-2 rounded-xl bg-white px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between"
          >
            <div class="min-w-0">
              <p class="artist-performance-event truncate font-semibold text-gray-800">
                {{ performance.eventName }}
              </p>
              <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-500">
                <span class="artist-performance-date flex items-center gap-1">
                  <CalendarDays class="h-4 w-4 shrink-0" />
                  {{ attendedOn(performance.dateAttended) }}
                </span>
                <span
                  v-if="performance.venue"
                  class="artist-performance-venue flex min-w-0 items-center gap-1"
                >
                  <MapPin class="h-4 w-4 shrink-0" />
                  <span class="truncate">{{ performance.venue }}</span>
                </span>
              </div>
            </div>
            <VerdictBadge :verdict="performance.verdict" />
          </li>
        </ul>
        <p v-else class="artist-live-empty text-gray-500">
          {{ t('artist_page.no_performances') }}
        </p>
      </section>
    </template>
  </main>
</template>

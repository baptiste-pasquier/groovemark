<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRoute } from 'vue-router'
import { ChevronLeft, Star, TriangleAlert } from 'lucide-vue-next'
import HeaderBar from '../layout/HeaderBar.vue'
import VerdictBadge from '../events/VerdictBadge.vue'
import { useArtistsUiStore } from '../../stores/artistsUi'
import { useEventsStore } from '../../stores/events'
import { useFavoritesUiStore } from '../../stores/favoritesUi'
import type { Favorite } from '../../types/favorite'
import { formatDayAttended } from '../../utils/event'
import { isSafeHttpUrl } from '../../utils/url'

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

// The leading line dates the verdict and says where it was earned. The venue is
// optional on an event, so the form without it is a separate phrase rather than
// a sentence with a hole in it.
const latestVerdictLine = computed(() => {
  const latest = history.value.latestRated
  if (!latest) return ''
  const date = attendedOn(latest.dateAttended)
  return latest.venue
    ? t('artist_page.latest_verdict_at', { venue: latest.venue, date })
    : t('artist_page.latest_verdict', { date })
})

// Opening a mix goes through the same guard the mix card uses, so a stored URL
// that is not plain http(s) cannot be handed to the browser from here either.
function openMix(mix: Favorite) {
  if (!isSafeHttpUrl(mix.url)) {
    return
  }

  window.open(mix.url, '_blank', 'noopener,noreferrer')
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
      <!-- The way back out of a page reached from three different surfaces, and
           the only one that does not depend on browser history. -->
      <RouterLink
        :to="{ name: 'artists' }"
        class="artist-back-link flex w-fit items-center gap-1.5 text-sm text-blue-500 hover:underline"
      >
        <ChevronLeft class="h-4 w-4 shrink-0" />
        {{ t('artist_page.all_artists') }}
      </RouterLink>

      <h2 class="artist-page-name text-3xl font-bold tracking-tight text-gray-900">
        {{ artist.displayName }}
      </h2>

      <!-- Both halves are stacked white blocks at every width, and an empty half
           renders as empty rather than disappearing (R15). The live half leads,
           because this page is consulted to answer "worth seeing again". -->
      <section id="artist-live" class="artist-section">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div class="flex flex-col gap-1">
            <span class="text-xs font-semibold text-gray-600">
              {{ t('artist_page.heading_live') }}
            </span>

            <!-- The half leads with the most recent *rated* verdict and that
                 night's date, which is not always the latest night: an unrated
                 latest performance would otherwise silence the summary exactly
                 when it is being consulted (R14, AE1). -->
            <div v-if="history.latestRated" class="artist-latest-verdict flex items-center gap-2">
              <VerdictBadge :verdict="history.latestRated.verdict" />
              <span class="text-sm text-gray-500">{{ latestVerdictLine }}</span>
            </div>
            <p
              v-else-if="history.performances.length"
              class="artist-no-rated-verdict text-sm text-gray-500"
            >
              {{ t('artist_page.no_rated_verdict') }}
            </p>
          </div>

          <span
            v-if="history.performances.length"
            class="artist-performance-count inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-3 py-0.5 text-sm font-medium text-gray-600"
          >
            {{
              t(
                'artist_page.chip_performances',
                { count: history.performances.length },
                history.performances.length,
              )
            }}
          </span>
        </div>

        <ul
          v-if="history.performances.length"
          class="mt-3.5 flex flex-col gap-px border-t border-gray-200 pt-2"
        >
          <li
            v-for="performance in history.performances"
            :key="performance.performanceId"
            class="artist-performance flex items-center justify-between gap-2.5 rounded-md px-2 py-1.5 text-gray-800 hover:bg-gray-50"
          >
            <div class="flex min-w-0 flex-col">
              <span class="artist-performance-event truncate font-medium">
                {{ performance.eventName }}
              </span>
              <span class="artist-performance-date truncate text-xs text-gray-400">
                {{ attendedOn(performance.dateAttended)
                }}<template v-if="performance.venue"> · {{ performance.venue }}</template>
              </span>
            </div>
            <VerdictBadge :verdict="performance.verdict" />
          </li>
        </ul>
        <p v-else class="artist-live-empty mt-3 text-gray-500">
          {{ t('artist_page.no_performances') }}
        </p>
      </section>

      <section id="artist-mixes" class="artist-section">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <span class="text-xs font-semibold text-gray-600">
            {{ t('artist_page.heading_mixes') }}
          </span>
          <div class="flex flex-wrap items-center gap-1.5">
            <span
              class="artist-stat inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-3 py-0.5 text-sm font-medium text-gray-600"
            >
              {{
                t('artist_page.chip_mixes', { count: mixAggregate.mixCount }, mixAggregate.mixCount)
              }}
            </span>
            <span
              class="artist-stat inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-3 py-0.5 text-sm font-medium text-gray-600"
            >
              {{
                t(
                  'artist_page.chip_moments',
                  { count: mixAggregate.momentCount },
                  mixAggregate.momentCount,
                )
              }}
            </span>
            <span
              class="artist-stat inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50 px-3 py-0.5 text-sm font-medium text-gray-600"
            >
              <Star class="h-3 w-3 shrink-0 fill-current text-yellow-400" />
              {{
                t(
                  'artist_page.chip_starred',
                  { count: mixAggregate.starredMomentCount },
                  mixAggregate.starredMomentCount,
                )
              }}
            </span>
          </div>
        </div>

        <!-- The mixes are read here, not revised: editing a mix stays on the
             mixes destination, where the editing surface lives. A moment is
             counted rather than listed, because this page answers "who is this
             artist to me", and a full timestamp list belongs to the mix itself. -->
        <div v-if="mixes.length" id="artist-mixes-grid" class="artist-mix-grid mt-3.5">
          <button
            v-for="mix in mixes"
            :key="mix.id"
            type="button"
            class="artist-mix-card overflow-hidden rounded-lg border border-gray-200 text-left transition duration-300 hover:border-gray-300 hover:shadow-sm"
            @click="openMix(mix)"
          >
            <img
              :src="mix.thumbnail"
              alt=""
              loading="lazy"
              class="h-16 w-full object-cover"
              @error="
                (e: any) => (e.target.src = 'https://placehold.co/600x400/e2e8f0/adb5bd?text=Mix')
              "
            />
            <div class="px-2.5 py-2">
              <p class="artist-mix-title truncate text-sm font-semibold text-gray-900">
                {{ mix.title }}
              </p>
              <p class="artist-mix-moments text-xs text-gray-400">
                {{
                  t(
                    'artist_page.chip_moments',
                    { count: mix.timestamps.length },
                    mix.timestamps.length,
                  )
                }}
              </p>
            </div>
          </button>
        </div>
        <p v-else class="artist-mixes-empty mt-3 text-gray-500">{{ t('artist_page.no_mixes') }}</p>
      </section>
    </template>
  </main>
</template>

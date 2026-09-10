<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'
import { SquarePen, Trash2, CalendarDays, MapPin } from 'lucide-vue-next'
import VerdictBadge from './VerdictBadge.vue'
import type { MusicEvent, Performance } from '../../types/event'
import { normalizeArtistName } from '../../utils/artist'
import { formatDayAttended } from '../../utils/event'

// `readOnly` disables both controls, the way the mix card's do: the store
// refuses the write anyway, but a control that looks live and then explains
// itself in a dialog reads worse than one that is plainly unavailable.
const props = defineProps<{ event: MusicEvent; readOnly?: boolean }>()
// The card is where an existing event is reopened for revision (R8, AE17) and
// where it is deleted from (R26). It names the event and stops there: the
// editing surface is the parent's, so the card cannot know or care whether
// that surface is a modal -- and what a deletion costs, and whether it happens
// at all, is the store's to decide.
const emit = defineEmits<{ (e: 'open', id: string): void; (e: 'delete', id: string): void }>()

const { t, locale } = useI18n()

// The stored day is read through one shared formatter, which formats in UTC --
// formatting the bare day in a zone west of UTC would print the day before.
const attendedOn = computed(() => formatDayAttended(props.event.dateAttended, locale.value))

// An artist's address is keyed on the artist's slug, and a slug is a folded
// display name rather than a URL token -- `AC/DC` folds to `ac/dc`, which only
// ever resolves once the router percent-encodes it. So the address is built
// from the named route and a param, never by concatenation (KTD14). The fold
// is derived from the display name the performance already carries, which is
// what keeps the card free of any dependency on the artists store.
function artistRoute(performance: Performance) {
  return {
    name: 'artist',
    params: { slug: normalizeArtistName(performance.artistName) ?? performance.artistName },
  }
}
</script>

<template>
  <div class="event-card flex flex-col rounded-xl bg-white shadow-lg">
    <div class="grow p-4">
      <div class="flex items-start justify-between">
        <div class="min-w-0">
          <h3 class="event-card-name mb-1 truncate text-lg font-bold text-gray-800">
            {{ event.name }}
          </h3>
          <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-500">
            <span class="event-card-date flex items-center gap-1">
              <CalendarDays class="h-4 w-4 shrink-0" />
              {{ attendedOn }}
            </span>
            <span v-if="event.venue" class="event-card-venue flex min-w-0 items-center gap-1">
              <MapPin class="h-4 w-4 shrink-0" />
              <span class="truncate">{{ event.venue }}</span>
            </span>
          </div>
        </div>
        <!-- Both affordances sit where the mix card puts its own controls,
             the delete one beside the open one rather than somewhere else. -->
        <div class="ml-2 flex shrink-0 items-center space-x-3">
          <button
            class="event-card-open rounded text-gray-400 transition-colors hover:text-blue-500 focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:text-gray-400"
            :disabled="readOnly"
            :title="t('events.open')"
            :aria-label="t('events.open')"
            @click.stop="emit('open', event.id)"
          >
            <SquarePen class="h-5 w-5" />
          </button>
          <button
            class="event-card-delete rounded text-gray-400 transition-colors hover:text-red-500 focus:ring-2 focus:ring-red-400 focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:text-gray-400"
            :disabled="readOnly"
            :title="t('events.delete')"
            :aria-label="t('events.delete')"
            @click.stop="emit('delete', event.id)"
          >
            <Trash2 class="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
    <!-- An event holding no performance is valid and has no line-up block at
         all, rather than an empty one (R7). -->
    <div
      v-if="event.performances.length"
      class="event-line-up border-t border-gray-200 px-4 pt-3 pb-4"
    >
      <div
        v-for="performance in event.performances"
        :key="performance.id"
        class="event-performance flex items-center justify-between gap-2 rounded-md px-2 py-1 text-sm text-gray-700 hover:bg-gray-50"
      >
        <RouterLink
          :to="artistRoute(performance)"
          class="event-artist-link credited-artist-link min-w-0 truncate"
        >
          {{ performance.artistName }}
        </RouterLink>
        <!-- The one read-only rendering of a verdict, shared with the artist
             page and the artists table, so no surface maps a verdict itself
             and the unrated case is written out once (KTD16, R4). -->
        <VerdictBadge :verdict="performance.verdict" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, provide, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { CalendarDays, MapPin, Music } from 'lucide-vue-next'

import { ARTIST_TAGS_COMMIT_REGISTRY } from '../favorites/ArtistTagsInput.vue'
import PerformanceRow from '../events/PerformanceRow.vue'
import { useEventsStore } from '../../stores/events'
import { useFavoritesUiStore } from '../../stores/favoritesUi'
import type { MusicEvent, Verdict } from '../../types/event'

// The one surface that creates an event and revises a whole one, line-up
// included (R8). It never writes half of an event: the store saves the name,
// the date, the venue and every performance as a single action, and this
// modal closes only once that reports success.
const props = defineProps<{ modelValue: boolean; editId?: string | null }>()
const emit = defineEmits<{ (e: 'update:modelValue', v: boolean): void }>()

const eventsStore = useEventsStore()
const favoritesUiStore = useFavoritesUiStore()
const { t } = useI18n()

// A performance as this surface holds it. `_id` is a client-only key that
// keeps a row identifiable while it is being typed -- a row has no server id
// until it has been saved once, and two rows may name the same artist. `id` is
// present only on a row the event already has, and is what lets the store
// rewrite that row instead of re-minting the whole line-up.
interface PerformanceRowState {
  _id: string
  id?: string
  artistName: string
  verdict: Verdict | null
}

const id = ref('')
const name = ref('')
const dateAttended = ref('')
const venue = ref('')
const performanceRows = ref<PerformanceRowState[]>([])
const isSaving = ref(false)

// Every artist field under this form registers its uncommitted draft here. The
// document click that blurs such a field fires before the submit button acts,
// so a name typed without an Enter would otherwise reach the store empty and
// take its whole row with it -- the artist and the verdict chosen for them.
const pendingArtistCommits = new Set<() => void>()
provide(ARTIST_TAGS_COMMIT_REGISTRY, pendingArtistCommits)

function createEmptyPerformanceRow(): PerformanceRowState {
  return { _id: crypto.randomUUID(), artistName: '', verdict: null }
}

function reset() {
  id.value = ''
  name.value = ''
  dateAttended.value = ''
  venue.value = ''
  // One empty row to type into. An event holding no performance is still
  // valid (R7): a row whose artist is empty once trimmed credits nobody and
  // the store drops it, so this costs the operator nothing.
  performanceRows.value = [createEmptyPerformanceRow()]
  isSaving.value = false
}

function hydrate(event: MusicEvent) {
  id.value = event.id
  name.value = event.name
  dateAttended.value = event.dateAttended
  venue.value = event.venue
  performanceRows.value = event.performances.map((performance) => ({
    _id: crypto.randomUUID(),
    id: performance.id,
    artistName: performance.artistName,
    verdict: performance.verdict,
  }))
  isSaving.value = false
}

// Immediate, so the surface is hydrated whether it was already open when it
// mounted or opened afterwards -- the mount order of the events tab is not
// this modal's business.
watch(
  () => props.modelValue,
  (open) => {
    if (!open) return
    const event = props.editId ? eventsStore.eventsById.get(props.editId) : undefined
    if (event) {
      hydrate(event)
    } else {
      reset()
    }
  },
  { immediate: true },
)

// The distinct values an earlier event already used, case-insensitively, each
// keeping the spelling it was first entered with. Two independent sources
// (R6): a venue is never offered as an event name.
function distinctUsedValues(values: string[]): string[] {
  const firstSpellingByFold = new Map<string, string>()
  for (const value of values) {
    const trimmed = value.trim()
    if (!trimmed) continue
    const fold = trimmed.toLocaleLowerCase()
    if (!firstSpellingByFold.has(fold)) firstSpellingByFold.set(fold, trimmed)
  }
  return [...firstSpellingByFold.values()].sort((a, b) => a.localeCompare(b))
}

const nameSuggestions = computed(() =>
  distinctUsedValues(eventsStore.events.map((event) => event.name)),
)

const venueSuggestions = computed(() =>
  distinctUsedValues(eventsStore.events.map((event) => event.venue)),
)

// Every loaded artist, so a performer typed once stays suggestible even when
// no mix and no other event credits them (KTD14).
const artistSuggestions = computed(() => favoritesUiStore.allArtistNames)

function addPerformance() {
  performanceRows.value.push(createEmptyPerformanceRow())
}

function removePerformance(rowKey: string) {
  performanceRows.value = performanceRows.value.filter((row) => row._id !== rowKey)
}

async function save() {
  // A date attended is required (KTD10): the events tab is ordered by it.
  if (isSaving.value || !name.value.trim() || !dateAttended.value) return

  isSaving.value = true
  try {
    // An unfinished artist draft counts as an implicit Enter at submit time:
    // the operator typed it, so it belongs to the event rather than being
    // dropped in silence. Committing is synchronous, so the rows below are
    // already up to date.
    pendingArtistCommits.forEach((commitPending) => commitPending())
    // The client-only row key is stripped here; row-level validation is not
    // repeated, because the store owns dropping a row that credits nobody and
    // resolving each name to an identity (R5, AE7).
    const success = await eventsStore.saveEvent({
      id: id.value || undefined,
      name: name.value,
      dateAttended: dateAttended.value,
      venue: venue.value,
      performances: performanceRows.value.map((row) => ({
        id: row.id,
        artistName: row.artistName,
        verdict: row.verdict,
      })),
    })
    // A refused save leaves everything typed on screen, because nothing was
    // persisted and the operator has to be able to try again (AE8).
    if (success) emit('update:modelValue', false)
  } finally {
    isSaving.value = false
  }
}

function close() {
  emit('update:modelValue', false)
}
</script>

<template>
  <Transition name="dialog">
    <div v-if="modelValue" class="modal-bg fixed inset-0 z-50 flex items-center justify-center">
      <div
        class="dialog-panel mx-auto max-h-[90vh] w-11/12 overflow-y-auto rounded-xl bg-white p-6 shadow-2xl md:max-w-2xl"
      >
        <h2 class="mb-4 text-2xl font-bold text-gray-800">
          {{ id ? t('event_modal.title_edit') : t('event_modal.title_add') }}
        </h2>
        <form @submit.prevent="save" class="space-y-4">
          <div>
            <label for="event-name" class="mb-2 block font-medium text-gray-700">
              {{ t('event_modal.name_label') }}
            </label>
            <div class="relative">
              <Music class="absolute top-1/2 left-3 h-5 w-5 -translate-y-1/2 text-gray-400" />
              <input
                id="event-name"
                v-model="name"
                type="text"
                list="event-name-suggestions"
                class="w-full rounded-lg border border-gray-300 py-2 pr-3 pl-10 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                :placeholder="t('event_modal.name_placeholder')"
                required
              />
              <!-- Free text with suggestions, not a picker: an unlisted name
                   is typed straight in (R6). -->
              <datalist id="event-name-suggestions">
                <option
                  v-for="suggestion in nameSuggestions"
                  :key="suggestion"
                  :value="suggestion"
                />
              </datalist>
            </div>
          </div>
          <div>
            <label for="event-date" class="mb-2 block font-medium text-gray-700">
              {{ t('event_modal.date_label') }}
            </label>
            <div class="relative">
              <CalendarDays
                class="absolute top-1/2 left-3 h-5 w-5 -translate-y-1/2 text-gray-400"
              />
              <input
                id="event-date"
                v-model="dateAttended"
                type="date"
                class="w-full rounded-lg border border-gray-300 py-2 pr-3 pl-10 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
          </div>
          <div>
            <label for="event-venue" class="mb-2 block font-medium text-gray-700">
              {{ t('event_modal.venue_label') }}
            </label>
            <div class="relative">
              <MapPin class="absolute top-1/2 left-3 h-5 w-5 -translate-y-1/2 text-gray-400" />
              <input
                id="event-venue"
                v-model="venue"
                type="text"
                list="event-venue-suggestions"
                class="w-full rounded-lg border border-gray-300 py-2 pr-3 pl-10 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                :placeholder="t('event_modal.venue_placeholder')"
              />
              <datalist id="event-venue-suggestions">
                <option
                  v-for="suggestion in venueSuggestions"
                  :key="suggestion"
                  :value="suggestion"
                />
              </datalist>
            </div>
          </div>
          <div>
            <h3 class="mb-2 font-medium text-gray-700">{{ t('event_modal.line_up') }}</h3>
            <div class="space-y-2">
              <PerformanceRow
                v-for="row in performanceRows"
                :key="row._id"
                v-model:artist-name="row.artistName"
                v-model:verdict="row.verdict"
                :suggestions="artistSuggestions"
                @remove="removePerformance(row._id)"
              />
            </div>
            <button
              type="button"
              id="add-performance-btn"
              class="mt-2 font-semibold text-blue-500 hover:text-blue-700"
              @click="addPerformance"
            >
              {{ t('event_modal.add_performance') }}
            </button>
          </div>
          <div class="flex justify-end space-x-2">
            <!-- Cancel is withheld while a save is in flight, like Save: this
                 surface is mounted once and reused, so a cancel mid-save would
                 let a fresh draft be opened and then closed under the operator
                 when the first save resolved. With both withheld, nothing can
                 close this modal until the save reports back. -->
            <button
              type="button"
              id="event-cancel-btn"
              class="rounded-lg bg-gray-200 px-4 py-2 text-gray-800 hover:bg-gray-300 focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
              :disabled="isSaving"
              @click="close"
            >
              {{ t('modal.cancel') }}
            </button>
            <button
              type="submit"
              id="event-save-btn"
              class="rounded-lg bg-blue-500 px-4 py-2 text-white hover:bg-blue-600 focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:bg-gray-300"
              :disabled="isSaving"
            >
              {{ t('modal.save') }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </Transition>
</template>

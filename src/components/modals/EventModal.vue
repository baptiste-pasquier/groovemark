<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useEventsStore } from '../../stores/events'
import { useFavoritesStore } from '../../stores/favorites'
import type { EventDj } from '../../types/event'
import { Heart, ThumbsDown, Clock, MapPin, Calendar, PartyPopper } from 'lucide-vue-next'

const props = defineProps<{ modelValue: boolean; editId?: string | null }>()
const emit = defineEmits<{ (e: 'update:modelValue', v: boolean): void }>()
const store = useEventsStore()
const favoritesStore = useFavoritesStore()
const { t } = useI18n()

interface DjRow extends EventDj {
  _id: string
}

const id = ref<string>('')
const name = ref('')
const venue = ref('')
const date = ref('')
const djRows = ref<DjRow[]>([])

function reset() {
  id.value = ''
  name.value = ''
  venue.value = ''
  date.value = ''
  djRows.value = [createEmptyDjRow()]
}

function createEmptyDjRow(): DjRow {
  return { _id: crypto.randomUUID(), name: '', score: 0, time: '' }
}

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      if (props.editId) {
        const ev = store.events.find((e) => e.id === props.editId)
        if (ev) {
          id.value = ev.id
          name.value = ev.name
          venue.value = ev.venue
          date.value = ev.date
          djRows.value = ev.djs.map((dj) => ({ ...dj, _id: crypto.randomUUID() }))
        }
      } else {
        reset()
      }
    }
  },
)

function addDj() {
  djRows.value.push(createEmptyDjRow())
}

function removeDj(rowId: string) {
  djRows.value = djRows.value.filter((dj) => dj._id !== rowId)
}

function setScore(row: DjRow, score: EventDj['score']) {
  // Toggle off if clicking same score
  if (row.score === score) {
    row.score = 0
  } else {
    row.score = score
  }
}

async function save() {
  if (!name.value.trim()) return
  // Filter out empty DJ rows
  const validDjs = djRows.value
    .filter((dj) => dj.name.trim())
    .map(({ name, score, time }) => ({
      name: name.trim(),
      score,
      time: time || undefined,
    }))

  const success = await store.addOrUpdateEvent({
    id: id.value || undefined,
    name: name.value,
    venue: venue.value,
    date: date.value,
    djs: validDjs as EventDj[],
  })
  if (success) {
    emit('update:modelValue', false)
  }
}

function close() {
  emit('update:modelValue', false)
}
</script>

<template>
  <Transition name="dialog">
    <div v-if="modelValue" class="modal-bg fixed inset-0 z-50 flex items-center justify-center">
      <div class="dialog-panel mx-auto w-11/12 rounded-xl bg-white p-6 shadow-2xl md:max-w-2xl">
        <h2 class="mb-4 text-2xl font-bold text-gray-800">
          {{ id ? t('event_modal.title_edit') : t('event_modal.title_add') }}
        </h2>
        <form @submit.prevent="save" class="space-y-4">
          <!-- Event Name -->
          <div>
            <label for="event-name" class="mb-2 block font-medium text-gray-700">
              {{ t('event_modal.event_name') }}
            </label>
            <div class="relative">
              <PartyPopper class="absolute top-1/2 left-3 h-5 w-5 -translate-y-1/2 text-gray-400" />
              <input
                id="event-name"
                v-model="name"
                type="text"
                class="w-full rounded-lg border border-gray-300 py-2 pr-3 pl-10 focus:border-purple-500 focus:ring-2 focus:ring-purple-500"
                required
                :placeholder="t('event_modal.event_name_placeholder')"
              />
            </div>
          </div>

          <!-- Venue -->
          <div>
            <label for="event-venue" class="mb-2 block font-medium text-gray-700">
              {{ t('event_modal.venue') }}
            </label>
            <div class="relative">
              <MapPin class="absolute top-1/2 left-3 h-5 w-5 -translate-y-1/2 text-gray-400" />
              <input
                id="event-venue"
                v-model="venue"
                type="text"
                class="w-full rounded-lg border border-gray-300 py-2 pr-3 pl-10 focus:border-purple-500 focus:ring-2 focus:ring-purple-500"
                :placeholder="t('event_modal.venue_placeholder')"
              />
            </div>
          </div>

          <!-- Date -->
          <div>
            <label for="event-date" class="mb-2 block font-medium text-gray-700">
              {{ t('event_modal.date') }}
            </label>
            <div class="relative">
              <Calendar class="absolute top-1/2 left-3 h-5 w-5 -translate-y-1/2 text-gray-400" />
              <input
                id="event-date"
                v-model="date"
                type="date"
                class="w-full rounded-lg border border-gray-300 py-2 pr-3 pl-10 focus:border-purple-500 focus:ring-2 focus:ring-purple-500"
              />
            </div>
          </div>

          <!-- DJs -->
          <div>
            <h3 class="mb-2 font-medium text-gray-700">{{ t('event_modal.djs') }}</h3>
            <div class="space-y-3">
              <div
                v-for="row in djRows"
                :key="row._id"
                class="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 p-3"
              >
                <div class="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center">
                  <!-- DJ Name -->
                  <input
                    type="text"
                    :placeholder="t('event_modal.dj_name_placeholder')"
                    v-model="row.name"
                    list="dj-suggestions"
                    autocomplete="off"
                    class="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:ring-2 focus:ring-purple-500"
                  />

                  <!-- DJ Time (optional) -->
                  <div class="relative w-full sm:w-32">
                    <Clock class="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      :placeholder="t('event_modal.dj_time_placeholder')"
                      v-model="row.time"
                      class="w-full rounded-lg border border-gray-300 py-2 pr-3 pl-9 text-sm focus:border-purple-500 focus:ring-2 focus:ring-purple-500"
                    />
                  </div>

                  <!-- Score -->
                  <div class="flex items-center gap-1">
                    <!-- Thumbs down (negative) -->
                    <button
                      type="button"
                      class="rounded p-1 transition-colors"
                      :class="
                        row.score === -1
                          ? 'bg-red-100 text-red-500'
                          : 'text-gray-300 hover:text-red-400'
                      "
                      @click="setScore(row, -1)"
                    >
                      <ThumbsDown class="h-5 w-5" />
                    </button>

                    <div class="mx-1 h-5 w-px bg-gray-300"></div>

                    <!-- Hearts 1-3 -->
                    <button
                      v-for="n in 3"
                      :key="n"
                      type="button"
                      class="p-0.5 transition-colors"
                      @click="setScore(row, n as EventDj['score'])"
                    >
                      <Heart
                        class="h-5 w-5"
                        :class="
                          row.score >= n && row.score > 0
                            ? 'fill-current text-red-500'
                            : 'text-gray-300 hover:text-red-300'
                        "
                      />
                    </button>
                  </div>
                </div>

                <!-- Remove DJ -->
                <button
                  type="button"
                  class="shrink-0 text-xl font-bold text-red-500 hover:text-red-700"
                  @click="removeDj(row._id)"
                >
                  &times;
                </button>
              </div>
            </div>
            <button
              type="button"
              class="mt-2 font-semibold text-purple-500 hover:text-purple-700"
              @click="addDj"
            >
              {{ t('event_modal.add_dj') }}
            </button>
          </div>

          <datalist id="dj-suggestions">
            <option v-for="artist in favoritesStore.allArtists" :key="artist" :value="artist" />
          </datalist>

          <!-- Actions -->
          <div class="flex justify-end space-x-2">
            <button
              type="button"
              class="rounded-lg bg-gray-200 px-4 py-2 text-gray-800 hover:bg-gray-300 focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 focus:outline-none"
              @click="close"
            >
              {{ t('event_modal.cancel') }}
            </button>
            <button
              type="submit"
              class="rounded-lg bg-purple-600 px-4 py-2 text-white hover:bg-purple-700 focus:ring-2 focus:ring-purple-400 focus:ring-offset-2 focus:outline-none"
            >
              {{ t('event_modal.save') }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </Transition>
</template>

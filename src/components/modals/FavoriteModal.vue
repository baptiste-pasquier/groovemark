<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useFavoritesStore } from '../../stores/favorites'
import type { Timestamp } from '../../types/favorite'
import ArtistTagsInput from '../favorites/ArtistTagsInput.vue'
import { fetchMetadata, normalizeUrl } from '../../utils/url'
import { Star, AlertCircle, Link, Music, Users, Tag, Clock } from 'lucide-vue-next'

const props = defineProps<{ modelValue: boolean; editId?: string | null }>()
const emit = defineEmits<{ (e: 'update:modelValue', v: boolean): void }>()
const store = useFavoritesStore()
const { t } = useI18n()

interface TimestampRow extends Timestamp {
  _id: string
}

const id = ref<string>('')
const url = ref('')
const title = ref('')
const artists = ref<string[]>([])
const timestampRows = ref<TimestampRow[]>([])
const metadataLoading = ref(false)
const metadataError = ref('')
const lastMetadataUrl = ref('')

function reset() {
  id.value = ''
  url.value = ''
  title.value = ''
  artists.value = []
  // artist tags handled by component
  timestampRows.value = [createEmptyTimestampRow()]
  metadataLoading.value = false
  metadataError.value = ''
  lastMetadataUrl.value = ''
}

function createEmptyTimestampRow(): TimestampRow {
  return { _id: crypto.randomUUID(), label: '', time: '', rated: false }
}

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      if (props.editId) {
        const fav = store.favorites.find((f) => f.id === props.editId)
        if (fav) {
          id.value = fav.id
          url.value = fav.url
          title.value = fav.title
          artists.value = [...fav.artists]
          timestampRows.value = fav.timestamps.map((t) => ({ ...t, _id: crypto.randomUUID() }))
          lastMetadataUrl.value = fav.url
          metadataError.value = ''
        }
      } else {
        reset()
      }
    }
  },
)

// Artist tag interactions moved to ArtistTagsInput component

function addTimestamp() {
  timestampRows.value.push(createEmptyTimestampRow())
}

function removeTimestamp(id: string) {
  timestampRows.value = timestampRows.value.filter((t) => t._id !== id)
}

function toggleRated(row: TimestampRow) {
  row.rated = !row.rated
}

function formatTimeInput(event: Event, row: TimestampRow) {
  const input = event.target as HTMLInputElement
  const digits = input.value.replace(/\D/g, '').slice(0, 6)

  if (digits.length > 4) {
    row.time = `${digits.slice(0, -4)}:${digits.slice(-4, -2)}:${digits.slice(-2)}`
  } else if (digits.length > 2) {
    row.time = `${digits.slice(0, -2)}:${digits.slice(-2)}`
  } else {
    row.time = digits
  }
}

async function save() {
  if (!url.value.trim() || !title.value.trim()) return
  const success = await store.addOrUpdateFavorite({
    id: id.value || undefined,
    url: url.value,
    title: title.value,
    artists: [...artists.value],
    timestamps: timestampRows.value.map(({ label, time, rated }) => ({ label, time, rated })),
  })
  if (success) {
    emit('update:modelValue', false)
  }
}

async function onUrlBlur() {
  const u = url.value.trim()
  if (!u) return

  metadataLoading.value = true
  metadataError.value = ''

  try {
    const normalized = await normalizeUrl(u)
    url.value = normalized

    // Avoid refetch if already fetched in this modal session and unchanged
    if (lastMetadataUrl.value === normalized) {
      metadataLoading.value = false
      return
    }

    const meta = await fetchMetadata(normalized)
    if (meta) {
      if (!title.value && meta.title) title.value = meta.title
      if (!artists.value.length && meta.artist) artists.value = [meta.artist]
      lastMetadataUrl.value = normalized
    } else {
      metadataError.value = t('modal.metadata_error')
    }
  } catch {
    metadataError.value = t('modal.metadata_error')
  } finally {
    metadataLoading.value = false
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
          {{ id ? t('modal.title_edit') : t('modal.title_add') }}
        </h2>
        <form @submit.prevent="save" class="space-y-4">
          <div>
            <label for="url" class="mb-2 block font-medium text-gray-700"
              >URL (YouTube ou SoundCloud)</label
            >
            <div class="relative">
              <Link class="absolute top-1/2 left-3 h-5 w-5 -translate-y-1/2 text-gray-400" />
              <input
                id="url"
                v-model="url"
                type="text"
                class="w-full rounded-lg border border-gray-300 py-2 pr-3 pl-10 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                required
                @blur="onUrlBlur"
              />
            </div>
            <p v-if="metadataLoading" class="m-1 text-xs text-gray-500">
              {{ t('modal.metadata_loading') }}
            </p>
            <p v-if="metadataError" class="m-1 flex items-center text-xs text-red-500">
              <AlertCircle class="mr-1 h-3 w-3" />
              {{ metadataError }}
            </p>
          </div>
          <div>
            <label for="title" class="mb-2 block font-medium text-gray-700">Titre</label>
            <div class="relative">
              <Music class="absolute top-1/2 left-3 h-5 w-5 -translate-y-1/2 text-gray-400" />
              <input
                id="title"
                v-model="title"
                type="text"
                class="w-full rounded-lg border border-gray-300 py-2 pr-3 pl-10 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                required
                :placeholder="metadataLoading ? t('modal.loading') : ''"
              />
            </div>
          </div>
          <div>
            <label class="mb-2 block font-medium text-gray-700">Artiste(s)</label>
            <div class="relative">
              <Users class="absolute top-3 left-3 z-10 h-5 w-5 text-gray-400" />
              <ArtistTagsInput
                v-model="artists"
                :suggestions="store.allArtists"
                :placeholder="t('modal.artists_placeholder')"
                class="!pl-10"
              />
            </div>
          </div>
          <div>
            <h3 class="mb-2 font-medium text-gray-700">Timestamps</h3>
            <div class="space-y-2">
              <div
                v-for="row in timestampRows"
                :key="row._id"
                class="timestamp-row flex items-center space-x-2"
                :data-rated="row.rated"
              >
                <div class="flex grow items-center space-x-2">
                  <div class="relative flex-1">
                    <Tag class="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      :placeholder="t('timestamp.label_placeholder')"
                      v-model="row.label"
                      class="timestamp-label w-full rounded-lg border border-gray-300 py-2 pr-3 pl-9 text-sm"
                    />
                  </div>
                  <div class="relative w-43">
                    <Clock class="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      :placeholder="t('timestamp.time_placeholder')"
                      v-model="row.time"
                      @input="formatTimeInput($event, row)"
                      class="timestamp-time w-full rounded-lg border border-gray-300 py-2 pr-3 pl-9 text-sm"
                      required
                    />
                  </div>
                </div>
                <div class="favorite-star-wrapper cursor-pointer p-2" @click="toggleRated(row)">
                  <Star
                    class="h-5 w-5"
                    :class="row.rated ? 'fill-current text-yellow-400' : 'text-gray-300'"
                  />
                </div>
                <button
                  type="button"
                  class="remove-timestamp-btn text-xl font-bold text-red-500 hover:text-red-700"
                  @click="removeTimestamp(row._id)"
                >
                  &times;
                </button>
              </div>
            </div>
            <button
              type="button"
              id="add-timestamp-btn"
              class="mt-2 font-semibold text-blue-500 hover:text-blue-700"
              @click="addTimestamp"
            >
              {{ t('modal.add_timestamp') }}
            </button>
          </div>
          <div class="flex justify-end space-x-2">
            <button
              type="button"
              id="cancel-btn"
              class="rounded-lg bg-gray-200 px-4 py-2 text-gray-800 hover:bg-gray-300 focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 focus:outline-none"
              @click="close"
            >
              {{ t('modal.cancel') }}
            </button>
            <button
              type="submit"
              class="rounded-lg bg-blue-500 px-4 py-2 text-white hover:bg-blue-600 focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 focus:outline-none"
            >
              {{ t('modal.save') }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </Transition>
</template>

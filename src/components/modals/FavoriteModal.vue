<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useFavoritesStore } from '../../stores/favorites'
import type { Timestamp } from '../../types/favorite'
import ArtistTagsInput from '../favorites/ArtistTagsInput.vue'
import { fetchMetadata } from '../../utils/url'

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
const lastMetadataUrl = ref('')

function reset() {
  id.value = ''
  url.value = ''
  title.value = ''
  artists.value = []
  // artist tags handled by component
  timestampRows.value = [createEmptyTimestampRow()]
  metadataLoading.value = false
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

async function save() {
  if (!url.value.trim() || !title.value.trim()) return
  await store.addOrUpdateFavorite({
    id: id.value || undefined,
    url: url.value,
    title: title.value,
    artists: [...artists.value],
    timestamps: timestampRows.value.map(({ label, time, rated }) => ({ label, time, rated })),
  })
  emit('update:modelValue', false)
}

async function onUrlBlur() {
  const u = url.value.trim()
  if (!u) return
  // Avoid refetch if already fetched in this modal session and unchanged
  if (lastMetadataUrl.value === u) return
  metadataLoading.value = true
  try {
    const meta = await fetchMetadata(u)
    if (meta) {
      if (!title.value && meta.title) title.value = meta.title
      if (!artists.value.length && meta.artist) artists.value = [meta.artist]
      lastMetadataUrl.value = u
    }
  } catch {
    // Silent failure; user input preserved
  } finally {
    metadataLoading.value = false
  }
}

function close() {
  emit('update:modelValue', false)
}
</script>

<template>
  <div v-if="modelValue" class="modal-bg fixed inset-0 z-50 flex items-center justify-center">
    <div class="animate-fade-in-up mx-auto w-11/12 rounded-xl bg-white p-6 shadow-2xl md:max-w-2xl">
      <h2 class="mb-4 text-2xl font-bold text-gray-800">
        {{ id ? t('modal.title_edit') : t('modal.title_add') }}
      </h2>
      <form @submit.prevent="save" class="space-y-4">
        <div>
          <label for="url" class="mb-2 block font-medium text-gray-700"
            >URL (YouTube ou SoundCloud)</label
          >
          <input
            id="url"
            v-model="url"
            type="text"
            class="w-full rounded-lg border border-gray-300 p-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
            required
            @blur="onUrlBlur"
          />
          <p v-if="metadataLoading" class="mt-1 text-xs text-gray-500">
            {{ t('modal.metadata_loading') }}
          </p>
        </div>
        <div>
          <label for="title" class="mb-2 block font-medium text-gray-700">Titre</label>
          <input
            id="title"
            v-model="title"
            type="text"
            class="w-full rounded-lg border border-gray-300 p-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
            required
            :placeholder="metadataLoading ? t('modal.loading') : ''"
          />
        </div>
        <div>
          <label class="mb-2 block font-medium text-gray-700">Artiste(s)</label>
          <ArtistTagsInput
            v-model="artists"
            :suggestions="store.allArtists"
            :placeholder="t('modal.artists_placeholder')"
          />
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
                <input
                  type="text"
                  :placeholder="t('timestamp.label_placeholder')"
                  v-model="row.label"
                  class="timestamp-label w-1/2 rounded-lg border border-gray-300 p-2 text-sm"
                />
                <input
                  type="text"
                  :placeholder="t('timestamp.time_placeholder')"
                  v-model="row.time"
                  class="timestamp-time w-1/2 rounded-lg border border-gray-300 p-2 text-sm"
                  required
                />
              </div>
              <div class="favorite-star-wrapper cursor-pointer p-2" @click="toggleRated(row)">
                <svg
                  class="h-5 w-5"
                  :class="row.rated ? 'text-yellow-400' : 'text-gray-300'"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"
                  />
                </svg>
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
            class="rounded-lg bg-gray-200 px-4 py-2 text-gray-800 hover:bg-gray-300"
            @click="close"
          >
            {{ t('modal.cancel') }}
          </button>
          <button
            type="submit"
            class="rounded-lg bg-blue-500 px-4 py-2 text-white hover:bg-blue-600"
          >
            {{ t('modal.save') }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

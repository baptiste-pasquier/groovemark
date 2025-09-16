<script setup lang="ts">
import { ref, watch } from 'vue'
import { useFavoritesStore } from '../../stores/favorites'
import type { Timestamp } from '../../types/favorite'
import ArtistTagsInput from '../favorites/ArtistTagsInput.vue'
import { fetchMetadata } from '../../utils/url'

const props = defineProps<{ modelValue: boolean; editId?: string | null }>()
const emit = defineEmits<{ (e: 'update:modelValue', v: boolean): void }>()
const store = useFavoritesStore()

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
  <div v-if="modelValue" class="fixed inset-0 z-50 flex items-center justify-center modal-bg">
    <div class="bg-white rounded-xl shadow-2xl w-11/12 md:max-w-2xl mx-auto p-6 animate-fade-in-up">
      <h2 class="text-2xl font-bold mb-4 text-gray-800">
        {{ id ? 'Éditer le favori' : 'Ajouter un favori' }}
      </h2>
      <form @submit.prevent="save" class="space-y-4">
        <div>
          <label for="url" class="block text-gray-700 font-medium mb-2"
            >URL (YouTube ou SoundCloud)</label
          >
          <input
            id="url"
            v-model="url"
            type="text"
            class="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            required
            @blur="onUrlBlur"
          />
          <p v-if="metadataLoading" class="mt-1 text-xs text-gray-500">Récupération des métadonnées…</p>
        </div>
        <div>
          <label for="title" class="block text-gray-700 font-medium mb-2">Titre</label>
          <input
            id="title"
            v-model="title"
            type="text"
            class="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            required
            :placeholder="metadataLoading ? 'Chargement…' : ''"
          />
        </div>
        <div>
          <label class="block text-gray-700 font-medium mb-2">Artiste(s)</label>
          <ArtistTagsInput v-model="artists" :suggestions="store.allArtists" placeholder="Ajouter un artiste" />
        </div>
        <div>
          <h3 class="text-gray-700 font-medium mb-2">Timestamps</h3>
          <div class="space-y-2">
            <div
              v-for="row in timestampRows"
              :key="row._id"
              class="flex items-center space-x-2 timestamp-row"
              :data-rated="row.rated"
            >
              <div class="grow flex items-center space-x-2">
                <input
                  type="text"
                  placeholder="Label (optionnel)"
                  v-model="row.label"
                  class="timestamp-label w-1/2 p-2 border border-gray-300 rounded-lg text-sm"
                />
                <input
                  type="text"
                  placeholder="Temps (ex: 1:23:45)"
                  v-model="row.time"
                  class="timestamp-time w-1/2 p-2 border border-gray-300 rounded-lg text-sm"
                  required
                />
              </div>
              <div class="favorite-star-wrapper cursor-pointer p-2" @click="toggleRated(row)">
                <svg
                  class="w-5 h-5"
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
                class="remove-timestamp-btn text-red-500 hover:text-red-700 font-bold text-xl"
                @click="removeTimestamp(row._id)"
              >
                &times;
              </button>
            </div>
          </div>
          <button
            type="button"
            id="add-timestamp-btn"
            class="mt-2 text-blue-500 hover:text-blue-700 font-semibold"
            @click="addTimestamp"
          >
            + Ajouter un timestamp
          </button>
        </div>
        <div class="flex justify-end space-x-2">
          <button
            type="button"
            id="cancel-btn"
            class="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300"
            @click="close"
          >
            Annuler
          </button>
          <button
            type="submit"
            class="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
          >
            Sauvegarder
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useDebounceFn } from '@vueuse/core'
import { Search, TriangleAlert } from 'lucide-vue-next'
import HeaderBar from '../layout/HeaderBar.vue'
import ArtistsTable from './ArtistsTable.vue'
import { useArtistsUiStore } from '../../stores/artistsUi'

const artistsUiStore = useArtistsUiStore()

const { t } = useI18n()

// Uncontrolled and debounced, exactly as the mixes and events searches are:
// the input owns what is typed, and the artists tab's own search ref hears
// about it once the typing settles. It is that ref and never the one filtering
// the mixes grid (KTD7).
const onSearch = useDebounceFn((e: Event) => {
  const value = (e.target as HTMLInputElement).value
  artistsUiStore.setSearch(value)
}, 300)
</script>

<template>
  <HeaderBar />

  <main class="artists-view">
    <!-- The catalogue is a join over loaded artists, so a failed load leaves
         it empty while the events tab still renders fully from denormalized
         names. Saying "unavailable" rather than showing an empty catalogue is
         the same distinction the artist page draws. -->
    <div
      v-if="artistsUiStore.artistsUnavailable"
      class="artists-unavailable flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-800"
    >
      <TriangleAlert class="mt-0.5 h-5 w-5 shrink-0" />
      <p>{{ t('artists.unavailable') }}</p>
    </div>

    <template v-else>
      <div class="view-controls">
        <div class="view-controls-search">
          <div class="view-search">
            <input
              id="artists-search"
              type="text"
              :placeholder="t('artists.search_placeholder')"
              class="view-search-input"
              @input="onSearch"
            />
            <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <Search class="h-5 w-5 text-gray-400" />
            </div>
          </div>
        </div>
      </div>

      <ArtistsTable />
    </template>
  </main>
</template>

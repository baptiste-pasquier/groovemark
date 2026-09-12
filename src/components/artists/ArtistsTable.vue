<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'
import { ArrowDown, ArrowUp } from 'lucide-vue-next'
import VerdictBadge from '../events/VerdictBadge.vue'
import { ARTISTS_COLUMNS, useArtistsUiStore } from '../../stores/artistsUi'
import type { ArtistsColumn, ArtistsColumnId } from '../../stores/artistsUi'

const artistsUiStore = useArtistsUiStore()

const { t, locale } = useI18n()

// The columns come straight from the one descriptor, so the header row, the
// cells and the compact select below can never offer different column sets --
// and a column added to the descriptor reaches all three at once.
const columns = ARTISTS_COLUMNS

// Every row's cells, formatted once per column through that column's own
// formatter. The date columns need the active locale, which is why this is a
// computed rather than a template call: a locale change re-formats every date
// on screen (R6).
const renderedRows = computed(() =>
  artistsUiStore.sortedRows.map((row) => ({
    row,
    cells: columns.map((column) => ({ column, cell: column.cell(row, locale.value) })),
  })),
)

// An empty catalogue and an empty search result are different answers, and the
// tab says which -- the same distinction the events grid draws.
const emptyMessage = computed(() =>
  artistsUiStore.creditedArtists.length === 0
    ? t('artists.empty_no_artists')
    : t('artists.empty_no_results'),
)

function isActive(column: ArtistsColumn) {
  return column.id === artistsUiStore.sortColumn
}

// The whole of the screen-reader contract for a sortable column: the active
// header reports its direction, and the others report nothing rather than
// claiming to be unsorted-but-sortable.
function ariaSortFor(column: ArtistsColumn) {
  if (!isActive(column)) return undefined
  return artistsUiStore.sortDirection === 'asc' ? 'ascending' : 'descending'
}

// A value column is hidden below the first breakpoint unless it is the active
// one; the name column is on screen at every width. The breakpoint itself
// lives in these classes rather than in any width this component reads.
function columnClassFor(column: ArtistsColumn) {
  return [
    column.id === 'artist' ? 'artists-name-column' : 'artists-value-column',
    isActive(column) ? 'artists-column-active' : '',
  ]
}

function sortBy(id: ArtistsColumnId) {
  artistsUiStore.setSort(id)
}

function sortFromSelect(event: Event) {
  sortBy((event.target as HTMLSelectElement).value as ArtistsColumnId)
}
</script>

<template>
  <div class="artists-sort-control">
    <label for="artists-sort-select">{{ t('artists.sort_by') }}</label>
    <select
      id="artists-sort-select"
      class="rounded-lg border border-gray-200 bg-white px-2 py-1 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
      :value="artistsUiStore.sortColumn"
      @change="sortFromSelect"
    >
      <option v-for="column in columns" :key="column.id" :value="column.id">
        {{ t(column.labelKey) }}
      </option>
    </select>
  </div>

  <table id="artists-table" class="artists-table">
    <thead>
      <tr>
        <th
          v-for="column in columns"
          :key="column.id"
          scope="col"
          class="artists-table-header"
          :class="columnClassFor(column)"
          :data-column="column.id"
          :aria-sort="ariaSortFor(column)"
        >
          <!-- A native button inside the header cell: it takes focus and
               activates from the keyboard with nothing added. -->
          <button
            type="button"
            class="artists-sort-header flex items-center gap-1 whitespace-nowrap hover:text-gray-900"
            :data-sort-column="column.id"
            @click="sortBy(column.id)"
          >
            {{ t(column.labelKey) }}
            <component
              v-if="isActive(column)"
              :is="artistsUiStore.sortDirection === 'asc' ? ArrowUp : ArrowDown"
              class="h-3 w-3 shrink-0"
            />
          </button>
        </th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="entry in renderedRows" :key="entry.row.artist.id" class="artists-row">
        <td
          v-for="{ column, cell } in entry.cells"
          :key="column.id"
          class="artists-table-cell"
          :class="columnClassFor(column)"
          :data-column="column.id"
        >
          <RouterLink
            v-if="cell.kind === 'artist'"
            class="artists-row-link credited-artist-link font-semibold"
            :to="{ name: 'artist', params: { slug: cell.artist.slug } }"
          >
            {{ cell.artist.displayName }}
          </RouterLink>
          <VerdictBadge v-else-if="cell.kind === 'verdict'" :verdict="cell.verdict" />
          <!-- Never seen live: no verdict at all, which is not the same as an
               unrated one, and no date to name either (AE19). -->
          <span
            v-else-if="cell.kind === 'unseen'"
            class="artists-not-seen text-xs text-gray-400 italic"
          >
            {{ t('artists.not_seen_live') }}
          </span>
          <template v-else>{{ cell.text }}</template>
        </td>
      </tr>
      <!-- An empty catalogue reduces the rows, not the table: the header row
           and every column stay on screen. -->
      <tr v-if="!renderedRows.length" class="artists-empty-row">
        <td class="artists-table-cell text-gray-500" :colspan="columns.length">
          {{ emptyMessage }}
        </td>
      </tr>
    </tbody>
  </table>
</template>

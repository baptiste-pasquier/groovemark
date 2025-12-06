<script setup lang="ts">
import { useFavoritesStore } from '../../stores/favorites'
import { useAuthStore } from '../../stores/auth'
import SortIconNewest from '../icons/SortIconNewest.vue'
import SortIconOldest from '../icons/SortIconOldest.vue'
import FilterIcon from '../icons/FilterIcon.vue'
import SearchIcon from '../icons/SearchIcon.vue'
import { useI18n } from 'vue-i18n'
import { onMounted, computed } from 'vue'

const store = useFavoritesStore()
const authStore = useAuthStore()

const { t, locale } = useI18n()

const LOCALE_STORAGE_KEY = 'groovemark_locale'

// Compute display name for auth status
const authDisplayName = computed(() => {
  if (authStore.authMode === 'google' && authStore.user) {
    return authStore.user.name || authStore.user.email || 'User'
  }
  return t('auth.local_mode')
})

function setAndPersistLocale(l: string) {
  locale.value = l
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, l)
  } catch (e) {
    // ignore storage errors
  }
}

function toggleLocale() {
  setAndPersistLocale(locale.value === 'fr' ? 'en' : 'fr')
}

async function handleLogout() {
  await authStore.signOut()
  // This will trigger the app to show the login page again
}

onMounted(() => {
  try {
    const stored = localStorage.getItem(LOCALE_STORAGE_KEY)
    if (stored && (stored === 'fr' || stored === 'en')) {
      locale.value = stored
      return
    }
  } catch (e) {
    // ignore
  }

  // Auto-detect from browser
  const nav =
    typeof navigator !== 'undefined'
      ? navigator.language || (navigator.languages && navigator.languages[0])
      : null
  if (nav && nav.startsWith('fr')) {
    setAndPersistLocale('fr')
  } else {
    setAndPersistLocale('en')
  }
})

const emit = defineEmits<{
  (e: 'openFilters'): void
  (e: 'importClick', evt: Event): void
  (e: 'add'): void
}>()

function onSearch(e: Event) {
  store.setSearch((e.target as HTMLInputElement).value)
}

function toggleSort() {
  store.toggleSort()
}

function openFilters() {
  emit('openFilters')
}
</script>

<template>
  <header class="mb-8 flex flex-col items-center justify-between sm:flex-row">
    <div>
      <h1 class="text-4xl font-bold text-gray-900">{{ t('app.title') }}</h1>
      <p class="text-gray-600">{{ t('app.subtitle') }}</p>
    </div>
    <div class="mt-4 flex items-center space-x-2 sm:mt-0">
      <button
        id="sort-btn"
        class="rounded-lg border border-gray-300 bg-white p-2 shadow-sm transition duration-300 hover:bg-gray-200"
        @click="toggleSort"
        :title="
          store.sortOrder === 'newest'
            ? t('app.sort_toggle_title_oldest')
            : t('app.sort_toggle_title_newest')
        "
      >
        <component
          :is="store.sortOrder === 'newest' ? SortIconNewest : SortIconOldest"
          class="h-6 w-6 text-gray-700"
        />
      </button>
      <button
        id="filter-menu-btn"
        class="rounded-lg border border-gray-300 bg-white p-2 shadow-sm transition duration-300 hover:bg-gray-200"
        @click="openFilters"
      >
        <FilterIcon class="h-6 w-6 text-gray-700" />
      </button>
      <button
        id="lang-toggle"
        class="rounded-lg border border-gray-300 bg-white px-3 py-2 font-medium shadow-sm hover:bg-gray-100"
        @click="toggleLocale"
        :aria-pressed="locale === 'fr' ? 'true' : 'false'"
        aria-label="Toggle language"
        title="Toggle language"
      >
        {{ locale === 'fr' ? 'FR' : 'EN' }}
      </button>
      <label
        for="import-json"
        class="cursor-pointer rounded-lg bg-blue-500 px-4 py-2 font-bold whitespace-nowrap text-white shadow-sm transition duration-300 hover:bg-blue-600"
      >
        {{ t('app.import_json') }}
      </label>
      <input
        type="file"
        id="import-json"
        class="hidden"
        accept=".json"
        @change="(e) => emit('importClick', e)"
      />
      <button
        id="export-json-btn"
        class="rounded-lg bg-green-500 px-4 py-2 font-bold whitespace-nowrap text-white shadow-sm transition duration-300 hover:bg-green-600"
        @click="store.exportFavorites()"
      >
        {{ t('app.export_json') }}
      </button>
      <button
        id="logout-btn"
        class="rounded-lg bg-red-500 px-4 py-2 font-bold whitespace-nowrap text-white shadow-sm transition duration-300 hover:bg-red-600"
        @click="handleLogout"
        :title="
          authStore.authMode === 'google'
            ? t('auth.signed_in_as', { name: authDisplayName })
            : authDisplayName
        "
      >
        {{ t('auth.logout') }}
      </button>
    </div>
  </header>
  <div class="relative mb-6">
    <input
      type="text"
      id="search-input"
      :placeholder="t('app.search_placeholder')"
      class="w-full rounded-lg border border-gray-300 p-3 pl-10 transition-colors focus:ring-2 focus:ring-blue-500"
      @input="onSearch"
    />
    <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
      <SearchIcon class="h-5 w-5 text-gray-400" />
    </div>
  </div>
  <div class="mb-8">
    <button
      id="add-favorite-btn"
      class="w-full rounded-lg border-2 border-dashed border-gray-300 bg-white px-4 py-3 font-semibold text-blue-500 shadow-md transition duration-300 hover:border-blue-400 hover:bg-blue-50"
      @click="emit('add')"
    >
      {{ t('app.add_new') }}
    </button>
  </div>
</template>

<script lang="ts">
export default {}
</script>

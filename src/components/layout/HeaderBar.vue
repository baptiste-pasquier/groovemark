<script setup lang="ts">
import { useFavoritesStore } from '../../stores/favorites'
import { useAuthStore } from '../../stores/auth'
import {
  CalendarArrowDown,
  CalendarArrowUp,
  Filter,
  Settings,
  Upload,
  Download,
  Languages,
  Check,
  TriangleAlert,
  LogOut,
} from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import { SUPPORTED_LOCALES } from '../../i18n'
import { onMounted, computed, ref } from 'vue'

const store = useFavoritesStore()
const authStore = useAuthStore()

const { t, locale } = useI18n()

const isMenuOpen = ref(false)

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
}>()

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
    <div class="mt-4 flex flex-col items-center gap-3 sm:mt-0 sm:items-end">
      <div class="flex items-center gap-2 text-sm font-medium">
        <span
          v-if="authStore.authMode === 'local'"
          class="flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-amber-700"
          :title="t('login.local_mode_info')"
        >
          <TriangleAlert class="h-4 w-4" />
          {{ t('auth.local_mode') }}
        </span>
        <span
          v-else
          class="flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-gray-700"
        >
          <span class="h-2 w-2 rounded-full bg-green-500"></span>
          {{ authDisplayName }}
        </span>
      </div>
      <div class="flex items-center space-x-2">
        <button
          id="sort-btn"
          class="rounded-lg border border-gray-300 bg-white p-2 shadow-sm transition duration-300 hover:bg-gray-200 focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 focus:outline-none"
          @click="toggleSort"
          :title="
            store.sortOrder === 'newest'
              ? t('app.sort_toggle_title_oldest')
              : t('app.sort_toggle_title_newest')
          "
        >
          <component
            :is="store.sortOrder === 'newest' ? CalendarArrowDown : CalendarArrowUp"
            class="h-6 w-6 text-gray-700"
          />
        </button>
        <button
          id="filter-menu-btn"
          class="rounded-lg border border-gray-300 bg-white p-2 shadow-sm transition duration-300 hover:bg-gray-200 focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 focus:outline-none lg:hidden"
          @click="openFilters"
        >
          <Filter class="h-6 w-6 text-gray-700" />
        </button>
        <div class="relative">
          <button
            id="settings-menu-btn"
            class="rounded-lg border border-gray-300 bg-white p-2 shadow-sm transition duration-300 hover:bg-gray-200 focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 focus:outline-none"
            @click="isMenuOpen = !isMenuOpen"
            :title="t('app.settings')"
            aria-haspopup="true"
            :aria-expanded="isMenuOpen"
          >
            <Settings class="h-6 w-6 text-gray-700" />
          </button>

          <!-- Backdrop to close menu -->
          <div
            v-if="isMenuOpen"
            class="fixed inset-0 z-10 cursor-default"
            @click="isMenuOpen = false"
          ></div>

          <!-- Menu Dropdown -->
          <div
            v-if="isMenuOpen"
            class="absolute right-0 z-20 mt-2 w-48 origin-top-right rounded-md border border-gray-300 bg-white py-1 shadow-xl focus:outline-none"
            role="menu"
          >
            <div
              class="flex items-center gap-2 px-4 py-2 text-xs font-semibold tracking-wider text-gray-500 uppercase"
            >
              <Languages class="h-4 w-4" />
              {{ t('app.language') }}
            </div>
            <button
              v-for="l in SUPPORTED_LOCALES"
              :key="l.code"
              class="flex w-full items-center justify-between px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 focus:bg-gray-100 focus:outline-none"
              @click="
                () => {
                  setAndPersistLocale(l.code)
                  isMenuOpen = false
                }
              "
              role="menuitem"
            >
              <span>{{ l.label }}</span>
              <Check v-if="locale === l.code" class="h-4 w-4 text-blue-500" />
            </button>
            <div class="my-1 border-t border-gray-100"></div>
            <label
              for="import-json"
              class="flex w-full cursor-pointer items-center gap-2 px-4 py-2 text-left text-sm text-gray-700 focus-within:bg-gray-100 focus-within:outline-none hover:bg-gray-100"
            >
              <Upload class="h-4 w-4" />
              {{ t('app.import_json') }}
            </label>
            <input
              type="file"
              id="import-json"
              class="hidden"
              accept=".json"
              @change="
                (e) => {
                  emit('importClick', e)
                  isMenuOpen = false
                }
              "
            />
            <button
              id="export-json-btn"
              class="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 focus:bg-gray-100 focus:outline-none"
              @click="
                () => {
                  store.exportFavorites()
                  isMenuOpen = false
                }
              "
              role="menuitem"
            >
              <Download class="h-4 w-4" />
              {{ t('app.export_json') }}
            </button>
          </div>
        </div>
        <button
          id="logout-btn"
          class="flex items-center gap-2 rounded-lg bg-red-500 px-4 py-2 font-bold whitespace-nowrap text-white shadow-sm transition duration-300 hover:bg-red-600 focus:ring-2 focus:ring-red-400 focus:ring-offset-2 focus:outline-none"
          @click="handleLogout"
          :title="
            authStore.authMode === 'google'
              ? t('auth.signed_in_as', { name: authDisplayName })
              : authDisplayName
          "
        >
          <LogOut class="h-4 w-4" />
          {{ t('auth.logout') }}
        </button>
      </div>
    </div>
  </header>
  <div class="mb-8">
    <!-- Search and Add button moved to App.vue for layout flexibility -->
  </div>
</template>

<script lang="ts">
export default {}
</script>

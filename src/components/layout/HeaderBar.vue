<script setup lang="ts">
import { useFavoritesStore } from '../../stores/favorites'
import { useAuthStore } from '../../stores/auth'
import { useI18n } from 'vue-i18n'
import { SUPPORTED_LOCALES } from '../../i18n'
import { onMounted, computed, ref } from 'vue'

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

// File input ref for import
const importFileInput = ref<HTMLInputElement>()

function triggerImport() {
  importFileInput.value?.click()
}

const settingsMenuItems = computed(() => {
  const items = []

  // Language submenu
  items.push({
    label: t('app.language'),
    icon: 'i-lucide-languages',
    children: SUPPORTED_LOCALES.map((l) => ({
      label: l.label,
      icon: locale.value === l.code ? 'i-lucide-check' : undefined,
      click: () => setAndPersistLocale(l.code),
    })),
  })

  // Separator
  items.push({
    type: 'separator' as const,
  })

  // Import
  items.push({
    label: t('app.import_json'),
    icon: 'i-lucide-upload',
    click: triggerImport,
  })

  // Export
  items.push({
    label: t('app.export_json'),
    icon: 'i-lucide-download',
    click: () => store.exportFavorites(),
  })

  return items
})
</script>

<template>
  <header class="mb-8 flex flex-col items-center justify-between sm:flex-row">
    <div>
      <h1 class="text-4xl font-bold text-gray-900">{{ t('app.title') }}</h1>
      <p class="text-gray-600">{{ t('app.subtitle') }}</p>
    </div>
    <div class="mt-4 flex flex-col items-center gap-3 sm:mt-0 sm:items-end">
      <div class="flex items-center gap-2 text-sm font-medium">
        <UBadge
          v-if="authStore.authMode === 'local'"
          color="warning"
          variant="soft"
          class="flex items-center gap-1"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-4 w-4"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fill-rule="evenodd"
              d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
              clip-rule="evenodd"
            />
          </svg>
          {{ t('auth.local_mode') }}
        </UBadge>
        <UBadge v-else color="neutral" variant="soft" class="flex items-center gap-2">
          <span class="h-2 w-2 rounded-full bg-green-500"></span>
          {{ authDisplayName }}
        </UBadge>
      </div>
      <div class="flex items-center space-x-2">
        <UButton
          id="sort-btn"
          color="neutral"
          variant="outline"
          size="md"
          square
          :icon="
            store.sortOrder === 'newest'
              ? 'i-lucide-arrow-down-wide-narrow'
              : 'i-lucide-arrow-up-wide-narrow'
          "
          @click="toggleSort"
          :title="
            store.sortOrder === 'newest'
              ? t('app.sort_toggle_title_oldest')
              : t('app.sort_toggle_title_newest')
          "
        />
        <UButton
          id="filter-menu-btn"
          color="neutral"
          variant="outline"
          size="md"
          square
          icon="i-lucide-filter"
          @click="openFilters"
          class="lg:hidden"
        />
        <UDropdownMenu :items="settingsMenuItems">
          <UButton
            id="settings-menu-btn"
            color="neutral"
            variant="outline"
            size="md"
            square
            icon="i-lucide-settings"
            :title="t('app.settings')"
          />
        </UDropdownMenu>
        <input
          ref="importFileInput"
          type="file"
          class="hidden"
          accept=".json"
          @change="
            (e) => {
              emit('importClick', e)
            }
          "
        />
        <UButton
          id="logout-btn"
          color="error"
          size="md"
          @click="handleLogout"
          :title="
            authStore.authMode === 'google'
              ? t('auth.signed_in_as', { name: authDisplayName })
              : authDisplayName
          "
        >
          {{ t('auth.logout') }}
        </UButton>
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

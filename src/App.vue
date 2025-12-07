<script setup lang="ts">
import { ref, onMounted } from 'vue'
import HeaderBar from './components/layout/HeaderBar.vue'
import FavoritesGrid from './components/favorites/FavoritesGrid.vue'
import FavoriteModal from './components/modals/FavoriteModal.vue'
import AlertDialog from './components/modals/AlertDialog.vue'
import ConfirmDialog from './components/modals/ConfirmDialog.vue'
import ArtistSidebar from './components/filters/ArtistSidebar.vue'
import ArtistList from './components/filters/ArtistList.vue'
import SearchIcon from './components/icons/SearchIcon.vue'
import LoginPage from './components/auth/LoginPage.vue'
import { useFavoritesStore } from './stores/favorites'
import { useAuthStore } from './stores/auth'
import i18n from './i18n'

const showModal = ref(false)
const editId = ref<string | null>(null)
const showSidebar = ref(false)

const store = useFavoritesStore()
const authStore = useAuthStore()

// Initialize auth and favorites when the app mounts
onMounted(async () => {
  await authStore.initialize()
  // Only initialize favorites if user is logged in (either mode)
  if (authStore.isLoggedIn) {
    store.initializeFavorites()
  }
})

function addFavorite() {
  editId.value = null
  showModal.value = true
}
function editFavorite(id: string) {
  editId.value = id
  showModal.value = true
}

function onSearch(e: Event) {
  store.setSearch((e.target as HTMLInputElement).value)
}

function handleImport(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = (ev) => {
    try {
      const data = JSON.parse(String(ev.target?.result))
      if (!Array.isArray(data)) throw new Error(i18n.global.t('import.error_invalid_array'))
      if (data.length > 0 && (!data[0].id || !data[0].url))
        throw new Error(i18n.global.t('import.error_invalid_structure'))
      store.importFavorites(data)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      store.alertDialog = {
        message: `${i18n.global.t('import.error_prefix')}${message}`,
        visible: true,
      }
    } finally {
      input.value = ''
    }
  }
  reader.readAsText(file)
}
</script>

<template>
  <!-- Show login page if not logged in -->
  <LoginPage v-if="!authStore.isLoggedIn" />

  <!-- Show main app if logged in -->
  <div v-else class="container mx-auto p-4 sm:p-6 md:p-8">
    <HeaderBar @openFilters="showSidebar = true" @importClick="$event && handleImport($event)" />

    <div class="flex flex-col lg:flex-row lg:gap-8">
      <!-- Left Sidebar (Desktop) -->
      <aside class="hidden w-64 shrink-0 flex-col gap-6 lg:flex">
        <!-- Search -->
        <div class="relative">
          <input
            type="text"
            :placeholder="$t('app.search_placeholder')"
            class="w-full rounded-lg border border-gray-300 p-3 pl-10 transition-colors focus:ring-2 focus:ring-blue-500"
            @input="onSearch"
          />
          <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <SearchIcon class="h-5 w-5 text-gray-400" />
          </div>
        </div>

        <!-- Add Button -->
        <button
          class="w-full rounded-lg border-2 border-dashed border-gray-300 bg-white px-4 py-3 font-semibold text-blue-500 shadow-md transition duration-300 hover:border-blue-400 hover:bg-blue-50"
          @click="addFavorite"
        >
          {{ $t('app.add_new') }}
        </button>

        <!-- Artist List -->
        <div class="flex flex-1 flex-col overflow-hidden">
          <h3 class="mb-2 font-bold text-gray-700">{{ $t('app.artists') }}</h3>
          <ArtistList class="flex-1 overflow-y-auto" />
        </div>
      </aside>

      <!-- Main Content -->
      <main class="min-w-0 flex-1">
        <!-- Mobile Search and Add (Visible only on small screens) -->
        <div class="mb-6 space-y-4 lg:hidden">
          <!-- Search -->
          <div class="relative">
            <input
              type="text"
              :placeholder="$t('app.search_placeholder')"
              class="w-full rounded-lg border border-gray-300 p-3 pl-10 transition-colors focus:ring-2 focus:ring-blue-500"
              @input="onSearch"
            />
            <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <SearchIcon class="h-5 w-5 text-gray-400" />
            </div>
          </div>
          <!-- Add Button -->
          <button
            class="w-full rounded-lg border-2 border-dashed border-gray-300 bg-white px-4 py-3 font-semibold text-blue-500 shadow-md transition duration-300 hover:border-blue-400 hover:bg-blue-50"
            @click="addFavorite"
          >
            {{ $t('app.add_new') }}
          </button>
        </div>

        <FavoritesGrid @edit="editFavorite" />
      </main>
    </div>

    <FavoriteModal v-model="showModal" :edit-id="editId" />
    <ArtistSidebar :open="showSidebar" @close="showSidebar = false" />
    <AlertDialog />
    <ConfirmDialog />
  </div>
</template>

<style scoped></style>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import HeaderBar from './components/layout/HeaderBar.vue'
import FavoritesGrid from './components/favorites/FavoritesGrid.vue'
import FavoriteModal from './components/modals/FavoriteModal.vue'
import AlertDialog from './components/modals/AlertDialog.vue'
import ConfirmDialog from './components/modals/ConfirmDialog.vue'
import ArtistSidebar from './components/filters/ArtistSidebar.vue'
import ArtistList from './components/filters/ArtistList.vue'
import FavoriteSearchBar from './components/favorites/FavoriteSearchBar.vue'
import AddFavoriteButton from './components/favorites/AddFavoriteButton.vue'
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

// Watch for auth mode changes and reinitialize favorites accordingly
watch(
  () => authStore.authMode,
  (newMode, oldMode) => {
    // When auth mode changes (e.g., user logs in or switches modes)
    if (newMode && newMode !== oldMode && authStore.isLoggedIn) {
      // Force reinitialization to update usePocketbase flag
      store.initializeFavorites(true)
    }
  },
)

function addFavorite() {
  editId.value = null
  showModal.value = true
}
function editFavorite(id: string) {
  editId.value = id
  showModal.value = true
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
      <aside
        class="sticky top-4 hidden h-[calc(100vh-2rem)] w-72 shrink-0 flex-col gap-6 rounded-2xl bg-gray-50 p-6 shadow-sm lg:flex"
      >
        <!-- Search -->
        <FavoriteSearchBar />

        <!-- Add Button -->
        <AddFavoriteButton @click="addFavorite" />

        <!-- Artist List -->
        <div class="flex flex-1 flex-col overflow-hidden">
          <h3 class="mb-3 text-xs font-bold tracking-wider text-gray-500 uppercase">
            {{ $t('app.artists') }}
          </h3>
          <ArtistList class="flex-1 overflow-y-auto" />
        </div>
      </aside>

      <!-- Main Content -->
      <main class="min-w-0 flex-1">
        <!-- Mobile Search and Add (Visible only on small screens) -->
        <div class="mb-6 space-y-4 lg:hidden">
          <!-- Search -->
          <FavoriteSearchBar />
          <!-- Add Button -->
          <AddFavoriteButton @click="addFavorite" />
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

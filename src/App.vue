<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import HeaderBar from './components/layout/HeaderBar.vue'
import FavoritesGrid from './components/favorites/FavoritesGrid.vue'
import FavoriteModal from './components/modals/FavoriteModal.vue'
import EventModal from './components/modals/EventModal.vue'
import AlertDialog from './components/modals/AlertDialog.vue'
import ConfirmDialog from './components/modals/ConfirmDialog.vue'
import ArtistSidebar from './components/filters/ArtistSidebar.vue'
import ArtistList from './components/filters/ArtistList.vue'
import FavoriteSearchBar from './components/favorites/FavoriteSearchBar.vue'
import AddFavoriteButton from './components/favorites/AddFavoriteButton.vue'
import EventsGrid from './components/events/EventsGrid.vue'
import EventSearchBar from './components/events/EventSearchBar.vue'
import AddEventButton from './components/events/AddEventButton.vue'
import LoginPage from './components/auth/LoginPage.vue'
import { useFavoritesStore } from './stores/favorites'
import { useEventsStore } from './stores/events'
import { useAuthStore } from './stores/auth'
import i18n from './i18n'

const activeTab = ref<'favorites' | 'events'>('favorites')
const showModal = ref(false)
const showEventModal = ref(false)
const editId = ref<string | null>(null)
const editEventId = ref<string | null>(null)
const showSidebar = ref(false)

const store = useFavoritesStore()
const eventsStore = useEventsStore()
const authStore = useAuthStore()

// Initialize auth when the app mounts
onMounted(async () => {
  await authStore.initialize()
})

// Watch for auth state changes to initialize or reset favorites and events
watch(
  () => authStore.isLoggedIn,
  (isLoggedIn: boolean) => {
    if (isLoggedIn) {
      store.initializeFavorites(true)
      eventsStore.initializeEvents(true)
    } else {
      store.reset()
      eventsStore.reset()
    }
  },
  { immediate: true },
)

function addFavorite() {
  editId.value = null
  showModal.value = true
}
function editFavorite(id: string) {
  editId.value = id
  showModal.value = true
}

function addEvent() {
  editEventId.value = null
  showEventModal.value = true
}
function editEvent(id: string) {
  editEventId.value = id
  showEventModal.value = true
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
        type: 'alert',
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
    <HeaderBar
      v-model:active-tab="activeTab"
      @openFilters="showSidebar = true"
      @importClick="$event && handleImport($event)"
    />

    <!-- Favorites Tab -->
    <div v-if="activeTab === 'favorites'" class="flex flex-col lg:flex-row lg:gap-8">
      <!-- Left Sidebar (Desktop) -->
      <aside
        class="sticky top-4 hidden h-[calc(100vh-2rem)] w-72 shrink-0 flex-col gap-6 rounded-2xl bg-gray-50 p-6 shadow-sm lg:flex"
      >
        <FavoriteSearchBar />
        <AddFavoriteButton @click="addFavorite" />
        <div class="flex flex-1 flex-col overflow-hidden">
          <h3 class="mb-3 text-xs font-bold tracking-wider text-gray-500 uppercase">
            {{ $t('app.artists') }}
          </h3>
          <ArtistList class="flex-1 overflow-y-auto" />
        </div>
      </aside>

      <!-- Main Content -->
      <main class="min-w-0 flex-1">
        <div class="mb-6 space-y-4 lg:hidden">
          <FavoriteSearchBar />
          <AddFavoriteButton @click="addFavorite" />
        </div>
        <FavoritesGrid @edit="editFavorite" />
      </main>
    </div>

    <!-- Events Tab -->
    <div v-else-if="activeTab === 'events'" class="flex flex-col lg:flex-row lg:gap-8">
      <!-- Left Sidebar (Desktop) -->
      <aside
        class="sticky top-4 hidden h-[calc(100vh-2rem)] w-72 shrink-0 flex-col gap-6 rounded-2xl bg-gray-50 p-6 shadow-sm lg:flex"
      >
        <EventSearchBar />
        <AddEventButton @click="addEvent" />
        <div class="flex flex-1 flex-col overflow-hidden">
          <h3 class="mb-3 text-xs font-bold tracking-wider text-gray-500 uppercase">
            {{ $t('app.artists') }}
          </h3>
          <ArtistList class="flex-1 overflow-y-auto" />
        </div>
      </aside>

      <!-- Main Content -->
      <main class="min-w-0 flex-1">
        <div class="mb-6 space-y-4 lg:hidden">
          <EventSearchBar />
          <AddEventButton @click="addEvent" />
        </div>
        <EventsGrid @edit="editEvent" />
      </main>
    </div>

    <FavoriteModal v-model="showModal" :edit-id="editId" />
    <EventModal v-model="showEventModal" :edit-id="editEventId" />
    <ArtistSidebar :open="showSidebar" @close="showSidebar = false" />
    <AlertDialog />
    <ConfirmDialog />
  </div>
</template>

<style scoped></style>

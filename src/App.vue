<script setup lang="ts">
import { onMounted, ref } from 'vue'
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
import { useAppStore } from './stores/app'

const showModal = ref(false)
const editId = ref<string | null>(null)
const showSidebar = ref(false)

const favoritesStore = useFavoritesStore()
const appStore = useAppStore()

onMounted(async () => {
  await appStore.bootstrap()
})

function addFavorite() {
  editId.value = null
  showModal.value = true
}

function editFavorite(id: string) {
  editId.value = id
  showModal.value = true
}

async function handleImport(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  try {
    await favoritesStore.importFromFile(file)
  } finally {
    input.value = ''
  }
}
</script>

<template>
  <div
    v-if="appStore.status === 'booting'"
    class="flex min-h-screen items-center justify-center bg-gray-50 p-6"
  >
    <div class="text-center">
      <img src="/icon.svg" alt="GrooveMark Logo" class="mx-auto mb-4 h-16 w-16 animate-pulse" />
      <p class="text-sm font-medium tracking-wide text-gray-500 uppercase">
        {{ $t('app.loading') }}
      </p>
    </div>
  </div>

  <LoginPage v-else-if="appStore.status === 'unauthenticated'" />

  <div v-else class="container mx-auto p-4 sm:p-6 md:p-8">
    <HeaderBar @openFilters="showSidebar = true" @importClick="$event && handleImport($event)" />

    <div class="flex flex-col lg:flex-row lg:gap-8">
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

      <main class="min-w-0 flex-1">
        <div class="mb-6 space-y-4 lg:hidden">
          <FavoriteSearchBar />
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

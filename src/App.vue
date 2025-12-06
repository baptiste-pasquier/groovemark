<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import HeaderBar from './components/layout/HeaderBar.vue'
import FavoritesGrid from './components/favorites/FavoritesGrid.vue'
import FavoriteModal from './components/modals/FavoriteModal.vue'
import AlertDialog from './components/modals/AlertDialog.vue'
import ConfirmDialog from './components/modals/ConfirmDialog.vue'
import ArtistSidebar from './components/filters/ArtistSidebar.vue'
import LoginPage from './components/auth/LoginPage.vue'
import { useFavoritesStore } from './stores/favorites'
import { useAuthStore } from './stores/auth'
import i18n from './i18n'

const showModal = ref(false)
const editId = ref<string | null>(null)
const showSidebar = ref(false)

const store = useFavoritesStore()
const authStore = useAuthStore()

const isAuthenticated = computed(() => !!authStore.user || authStore.isLocalMode)

// Initialize favorites when the app mounts
onMounted(() => {
  if (isAuthenticated.value) {
    store.initializeFavorites()
  }
})

watch(isAuthenticated, (newValue) => {
  if (newValue) {
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
  <LoginPage v-if="!isAuthenticated" />
  <div v-else class="container mx-auto p-4 sm:p-6 md:p-8">
    <HeaderBar
      @add="addFavorite"
      @openFilters="showSidebar = true"
      @importClick="$event && handleImport($event)"
    />
    <FavoritesGrid @edit="editFavorite" />
    <FavoriteModal v-model="showModal" :edit-id="editId" />
    <ArtistSidebar :open="showSidebar" @close="showSidebar = false" />
    <AlertDialog />
    <ConfirmDialog />
  </div>
</template>

<style scoped></style>

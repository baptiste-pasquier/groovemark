<script setup lang="ts">
import { ref } from 'vue'
import HeaderBar from './components/layout/HeaderBar.vue'
import FavoritesGrid from './components/favorites/FavoritesGrid.vue'
import FavoriteModal from './components/modals/FavoriteModal.vue'
import AlertDialog from './components/modals/AlertDialog.vue'
import ConfirmDialog from './components/modals/ConfirmDialog.vue'
import ArtistSidebar from './components/filters/ArtistSidebar.vue'

const showModal = ref(false)
const editId = ref<string | null>(null)
const showSidebar = ref(false)

function addFavorite() {
  editId.value = null
  showModal.value = true
}
function editFavorite(id: string) {
  editId.value = id
  showModal.value = true
}
</script>

<template>
  <div class="container mx-auto p-4 sm:p-6 md:p-8">
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

<script lang="ts">
import { useFavoritesStore } from './stores/favorites'
export default {
  methods: {
    handleImport(e: Event) {
      const input = e.target as HTMLInputElement
      const file = input.files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = (ev) => {
        try {
          const data = JSON.parse(String(ev.target?.result))
          if (!Array.isArray(data)) throw new Error("Le fichier JSON n'est pas un tableau valide.")
          if (data.length > 0 && (!data[0].id || !data[0].url))
            throw new Error('Structure invalide')
          const store = useFavoritesStore()
          store.importFavorites(data)
        } catch (err) {
          const store = useFavoritesStore()
          const message = err instanceof Error ? err.message : String(err)
          store.alertDialog = {
            message: `Erreur lors de l'importation : ${message}`,
            visible: true,
          }
        } finally {
          input.value = ''
        }
      }
      reader.readAsText(file)
    },
  },
}
</script>

<style scoped></style>

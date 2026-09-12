<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Upload, Download, Languages, Check, LoaderCircle } from 'lucide-vue-next'
import { useFavoritesStore } from '../../stores/favorites'
import { SUPPORTED_LOCALES } from '../../i18n'
import { updateLocale } from '../../services/locale'

// The app-level actions, in one copy. Both header panels mount this rather
// than each restating the list, so the signed-in menu and the local-mode menu
// cannot offer different actions or different wording for the same action.
const favoritesStore = useFavoritesStore()

const { t, locale } = useI18n()

const emit = defineEmits<{ (e: 'done'): void }>()

const importingLabel = computed(() => {
  const progress = favoritesStore.importProgress
  if (!progress) return ''
  if (progress.total === null) return t('app.importing_preparing')
  return t('app.importing', { processed: progress.processed, total: progress.total })
})

// Single source of truth for the import control's disabled state and styling,
// so the label class and the input's disabled binding can never drift apart.
const importControlState = computed<'importing' | 'readonly' | 'enabled'>(() => {
  if (favoritesStore.importProgress) return 'importing'
  if (favoritesStore.isReadOnly) return 'readonly'
  return 'enabled'
})
const isImportDisabled = computed(() => importControlState.value !== 'enabled')

function setAndPersistLocale(code: string) {
  locale.value = code
  updateLocale(code)
  emit('done')
}

// The import restores both domains from one file (R22), so it is an app-level
// action rather than a destination one. It is handled here, where the file
// input, the disabled state and the progress label already live.
async function handleImport(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  emit('done')
  if (!file) return

  try {
    await favoritesStore.importFromFile(file)
  } finally {
    // Cleared so selecting the same file again still fires a change event.
    input.value = ''
  }
}

function handleExport() {
  favoritesStore.exportFavorites()
  emit('done')
}
</script>

<template>
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
    role="menuitem"
    @click="setAndPersistLocale(l.code)"
  >
    <span>{{ l.label }}</span>
    <Check v-if="locale === l.code" class="h-4 w-4 text-blue-500" />
  </button>
  <div class="my-1 border-t border-gray-100"></div>
  <label
    for="import-json"
    class="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-gray-700 focus-within:bg-gray-100 focus-within:outline-none hover:bg-gray-100"
    :class="{
      'cursor-not-allowed opacity-60': importControlState === 'importing',
      'pointer-events-none opacity-50': importControlState === 'readonly',
      'cursor-pointer': importControlState === 'enabled',
    }"
  >
    <LoaderCircle v-if="favoritesStore.importProgress" class="h-4 w-4 animate-spin" />
    <Upload v-else class="h-4 w-4" />
    {{ favoritesStore.importProgress ? importingLabel : t('app.import_json') }}
  </label>
  <input
    id="import-json"
    type="file"
    class="hidden"
    accept=".json"
    :disabled="isImportDisabled"
    @change="handleImport"
  />
  <button
    id="export-json-btn"
    class="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 focus:bg-gray-100 focus:outline-none"
    role="menuitem"
    @click="handleExport"
  >
    <Download class="h-4 w-4" />
    {{ t('app.export_json') }}
  </button>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { LogOut } from 'lucide-vue-next'
import AppMenuItems from './AppMenuItems.vue'
import pb from '../../services/pocketbase'
import { useAppStore } from '../../stores/app'
import { useAuthStore } from '../../stores/auth'
import { useFavoritesStore } from '../../stores/favorites'

// The one identity control of a signed-in session: what used to be an import
// pill, a status badge, a settings button and a red logout button. The dot
// signals the session's state; the wording for that state exists only inside
// the open panel.
const appStore = useAppStore()
const authStore = useAuthStore()
const favoritesStore = useFavoritesStore()

const { t } = useI18n()

const isMenuOpen = ref(false)
const hasImageFailed = ref(false)

const displayName = computed(
  () => authStore.user?.name || authStore.user?.email || t('auth.local_mode'),
)

const initial = computed(() => (displayName.value.charAt(0) || '?').toUpperCase())

// Built only from a non-empty filename: an account signed in before the
// provider returned a photo carries none, and the SDK would otherwise hand
// back an address ending in a bare slash.
const avatarUrl = computed(() => {
  const user = authStore.user
  const filename = typeof user?.avatar === 'string' ? user.avatar : ''
  if (!user || !filename) return null
  return pb.files.getURL(user, filename, { thumb: '100x100' })
})

// The address stays valid-looking after the file is removed server-side, so a
// load error is the only signal that the photo is gone.
const showsImage = computed(() => Boolean(avatarUrl.value) && !hasImageFailed.value)

// Read over the sources that already exist -- no new state, and no second
// read-only switch beside useAppStore.isReadOnly (KTD6). An import in flight
// outranks the rest: it is the state that is about to change the others.
const status = computed<'importing' | 'readonly' | 'synced'>(() => {
  if (favoritesStore.importProgress) return 'importing'
  if (appStore.isReadOnly) return 'readonly'
  return 'synced'
})

const STATUS_DOT_CLASS: Record<'importing' | 'readonly' | 'synced', string> = {
  importing: 'bg-blue-500',
  readonly: 'bg-amber-500',
  synced: 'bg-green-500',
}

const STATUS_CHIP_CLASS: Record<'importing' | 'readonly' | 'synced', string> = {
  importing: 'border-blue-200 bg-blue-50 text-blue-700',
  readonly: 'border-amber-200 bg-amber-50 text-amber-700',
  synced: 'border-green-200 bg-green-50 text-green-700',
}

const statusLabel = computed(() => {
  const progress = favoritesStore.importProgress
  if (progress) {
    return progress.total === null
      ? t('app.importing_preparing')
      : t('app.importing', { processed: progress.processed, total: progress.total })
  }
  if (appStore.isReadOnly) return t('auth.offline_read_only')
  return t('auth.status_synced')
})

async function handleSignOut() {
  isMenuOpen.value = false
  await authStore.signOut()
  appStore.handleSignedOut()
}
</script>

<template>
  <div class="relative">
    <button
      id="account-menu-btn"
      type="button"
      class="relative rounded-full transition hover:ring-2 hover:ring-gray-300 focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 focus:outline-none"
      :aria-label="t('auth.account_menu_aria')"
      :title="t('auth.signed_in_as', { name: displayName })"
      aria-haspopup="true"
      :aria-expanded="isMenuOpen"
      @click="isMenuOpen = !isMenuOpen"
    >
      <img
        v-if="showsImage"
        :src="avatarUrl ?? undefined"
        alt=""
        class="h-9 w-9 rounded-full object-cover ring-1 ring-black/5"
        @error="hasImageFailed = true"
      />
      <span
        v-else
        class="grid h-9 w-9 place-items-center rounded-full bg-blue-100 text-sm font-semibold text-blue-700 ring-1 ring-black/5"
      >
        {{ initial }}
      </span>
      <span
        :data-account-status="status"
        aria-hidden="true"
        class="absolute -right-0.5 -bottom-0.5 h-3 w-3 rounded-full ring-2 ring-[#f0f2f5]"
        :class="STATUS_DOT_CLASS[status]"
      ></span>
    </button>

    <div
      v-if="isMenuOpen"
      data-menu-backdrop
      class="fixed inset-0 z-10 cursor-default"
      @click="isMenuOpen = false"
    ></div>

    <div v-if="isMenuOpen" class="header-menu-panel" role="menu">
      <div class="px-4 pt-2 pb-3">
        <p class="text-xs font-semibold tracking-wider text-gray-500 uppercase">
          {{ t('auth.account_signed_in_label') }}
        </p>
        <p class="truncate text-sm font-medium text-gray-900">{{ displayName }}</p>
        <p class="truncate text-xs text-gray-500">{{ authStore.user?.email }}</p>
        <span
          class="mt-2 inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-semibold"
          :class="STATUS_CHIP_CLASS[status]"
        >
          <span class="h-1.5 w-1.5 rounded-full" :class="STATUS_DOT_CLASS[status]"></span>
          {{ statusLabel }}
        </span>
      </div>
      <div class="my-1 border-t border-gray-100"></div>
      <AppMenuItems @done="isMenuOpen = false" />
      <div class="my-1 border-t border-gray-100"></div>
      <button
        id="logout-btn"
        class="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 focus:bg-red-50 focus:outline-none"
        role="menuitem"
        @click="handleSignOut"
      >
        <LogOut class="h-4 w-4" />
        {{ t('auth.logout') }}
      </button>
    </div>
  </div>
</template>

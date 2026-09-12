<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { TriangleAlert } from 'lucide-vue-next'
import AccountMenu from './AccountMenu.vue'
import LocalModeMenu from './LocalModeMenu.vue'
import { useAuthStore } from '../../stores/auth'

// Whatever the session's identity is, in one definition. The header mounts it
// once, repositioned by flex order between beside the title on a phone and
// beside the tabs from sm -- so this component exists to keep those two
// positions from drifting apart.
const authStore = useAuthStore()

const { t } = useI18n()
</script>

<template>
  <template v-if="authStore.authMode === 'local'">
    <span
      class="flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-sm font-medium text-amber-700"
      :title="t('login.local_mode_info')"
    >
      <TriangleAlert class="h-4 w-4" />
      {{ t('auth.local_mode') }}
    </span>
    <LocalModeMenu />
  </template>
  <AccountMenu v-else />
</template>

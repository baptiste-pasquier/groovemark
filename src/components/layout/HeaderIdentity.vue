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
    <!-- On a phone the badge sits in the row, left of the settings button.
         From md it hangs under the row, right-aligned on that button, and out
         of flow: the header's bottom margin absorbs it, so the controls row
         and the cards below do not move down to make space. Its anchor is the
         identity slot's `relative` in HeaderBar.vue. -->
    <span
      data-local-mode-badge
      class="flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-sm font-medium text-amber-700 md:absolute md:top-full md:right-0 md:mt-4 md:whitespace-nowrap"
      :title="t('login.local_mode_info')"
    >
      <TriangleAlert class="h-4 w-4" />
      {{ t('auth.local_mode') }}
    </span>
    <LocalModeMenu />
  </template>
  <AccountMenu v-else />
</template>

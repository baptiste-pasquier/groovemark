<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import ArtistTagsInput from '../favorites/ArtistTagsInput.vue'
import VerdictPicker from './VerdictPicker.vue'
import type { Verdict } from '../../types/event'

// One performance as it is typed: exactly one credited artist and at most one
// verdict (R2). The row invents neither control -- the artist field and the
// verdict picker are the shared ones (KTD16) -- and it owns no state of its
// own, so the event modal stays the single place a whole event lives.
const props = defineProps<{
  artistName: string
  verdict: Verdict | null
  suggestions: string[]
}>()

const emit = defineEmits<{
  (e: 'update:artistName', v: string): void
  (e: 'update:verdict', v: Verdict | null): void
  (e: 'remove'): void
}>()

const { t } = useI18n()

// The shared artist field's model travels as an array holding at most one name
// in single mode, so this is where that array meets the one artist a
// performance credits.
const artistTags = computed<string[]>({
  get: () => (props.artistName ? [props.artistName] : []),
  set: (tags) => emit('update:artistName', tags[0] ?? ''),
})

const selectedVerdict = computed<Verdict | null>({
  get: () => props.verdict,
  set: (value) => emit('update:verdict', value),
})
</script>

<template>
  <div class="performance-row flex items-start gap-2">
    <div class="min-w-0 flex-1">
      <ArtistTagsInput
        v-model="artistTags"
        :single="true"
        :suggestions="suggestions"
        :placeholder="t('performance.artist_placeholder')"
      />
    </div>
    <!-- The verdict and the remove control are centred on each other in one
         group, rather than each carrying its own top offset: the picker is two
         different heights either side of md -- taller stars below it -- so two
         hand-tuned offsets cannot line up at both widths. The group's padding
         is what holds them level with the artist field's first line. -->
    <div class="flex items-center gap-2 pt-2">
      <!-- The verdict sits beside the artist it belongs to, and the picker is
           given that name so a screen reader hears whose verdict this sets. -->
      <VerdictPicker v-model="selectedVerdict" :artist-name="artistName" />
      <!-- Removing a row asks for nothing: the whole event is what saves or
           fails, so nothing is lost until the save (R8). -->
      <button
        type="button"
        class="remove-performance-btn flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-xl leading-none font-bold text-red-500 hover:text-red-700 focus:ring-2 focus:ring-red-400 focus:outline-none"
        :title="t('performance.remove')"
        :aria-label="t('performance.remove')"
        @click="emit('remove')"
      >
        &times;
      </button>
    </div>
  </div>
</template>

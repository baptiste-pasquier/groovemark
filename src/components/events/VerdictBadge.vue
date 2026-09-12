<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Star, ThumbsDown } from 'lucide-vue-next'

import type { Verdict } from '../../types/event'
import { VERDICT_ARIA_KEYS, VERDICT_ORDER } from '../../utils/event'

// The one read-only rendering of a verdict, shared by the event card, the
// artist page and the artists table (KTD16). The star count comes from
// VERDICT_ORDER rather than a literal, so no surface restates the scale.
const props = defineProps<{ verdict: Verdict | null }>()

const { t } = useI18n()

// A star verdict draws as many stars as its rank; dislike (rank 0) draws none.
const starCount = computed(() => (props.verdict === null ? 0 : VERDICT_ORDER[props.verdict]))

// No verdict is ever written out on screen: rated states are glyphs, and the
// accessible name is the only place their names exist.
const ariaLabel = computed(() =>
  props.verdict === null ? undefined : t(VERDICT_ARIA_KEYS[props.verdict]),
)
</script>

<template>
  <span
    :class="verdict === null ? 'text-xs text-gray-400 italic' : 'inline-flex items-center gap-0.5'"
    :role="verdict === null ? undefined : 'img'"
    :aria-label="ariaLabel"
  >
    <!-- The absent verdict is written out, never left blank: an unrated
         performance still records that the operator saw that artist (R4). -->
    <template v-if="verdict === null">{{ t('verdict.unrated') }}</template>
    <template v-else>
      <ThumbsDown v-if="verdict === 'dislike'" class="h-4 w-4 shrink-0 text-red-500" />
      <Star
        v-for="step in starCount"
        :key="step"
        class="h-4 w-4 shrink-0 fill-current text-yellow-400"
      />
    </template>
  </span>
</template>

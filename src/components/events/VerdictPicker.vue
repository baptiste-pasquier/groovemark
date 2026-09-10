<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Star, ThumbsDown } from 'lucide-vue-next'

import type { Verdict } from '../../types/event'
import { VERDICT_ORDER, verdictRank } from '../../utils/event'

// The one editable verdict control, used by the event modal alone (KTD16).
// Above `md` it shows the four verdicts as four discrete buttons with only the
// chosen one highlighted, because one surface creates and revises a whole
// event: retuning every verdict across a line-up matters more than the fastest
// first capture, and four visible buttons make changing your mind one gesture.
const props = defineProps<{
  modelValue: Verdict | null
  // Named in the button group's accessible label, so a screen reader hears
  // whose verdict this row sets.
  artistName?: string
  disabled?: boolean
}>()

const emit = defineEmits<{ (e: 'update:modelValue', v: Verdict | null): void }>()

const { t } = useI18n()

const ARIA_KEYS: Record<Verdict, string> = {
  dislike: 'verdict.aria.dislike',
  'one-star': 'verdict.aria.one_star',
  'two-stars': 'verdict.aria.two_stars',
  'three-stars': 'verdict.aria.three_stars',
}

// The star steps in scale order, read from VERDICT_ORDER so the control never
// restates the scale (R3: there is no fifth value to add).
const starSteps = computed(() =>
  (Object.keys(VERDICT_ORDER) as Verdict[])
    .filter((verdict) => verdict !== 'dislike')
    .sort((a, b) => VERDICT_ORDER[a] - VERDICT_ORDER[b])
    .map((verdict) => ({ verdict, rank: VERDICT_ORDER[verdict] })),
)

const selectedRank = computed(() => verdictRank(props.modelValue))

const groupLabel = computed(() =>
  props.artistName
    ? t('verdict.aria.group_for', { artist: props.artistName })
    : t('verdict.aria.group'),
)

function isActive(verdict: Verdict) {
  return props.modelValue === verdict
}

// There is no fifth "clear" button, and a row with nothing highlighted IS the
// unrated state (R4): re-choosing the active verdict emits the absent verdict.
function select(verdict: Verdict) {
  if (props.disabled) return
  emit('update:modelValue', isActive(verdict) ? null : verdict)
}

// Below `md`, a star is filled whenever it is at or under the chosen step,
// which is what makes the three star buttons read as one filling control.
function isFilled(rank: number) {
  return selectedRank.value !== null && selectedRank.value >= rank
}

const BUTTON_CLASS =
  'flex items-center rounded-md border transition-colors focus:ring-2 focus:ring-blue-400 focus:outline-none disabled:cursor-not-allowed disabled:opacity-40'
const INACTIVE_CLASS = 'border-transparent text-gray-200 hover:text-gray-300'

function starButtonClass(verdict: Verdict) {
  return [
    BUTTON_CLASS,
    'gap-0.5 px-2 py-1',
    isActive(verdict) ? 'border-gray-400 bg-gray-100 text-yellow-400' : INACTIVE_CLASS,
  ]
}
</script>

<template>
  <div role="group" :aria-label="groupLabel" class="inline-flex items-center gap-1">
    <!-- Dislike stays its own button at every width. -->
    <button
      type="button"
      data-verdict="dislike"
      :disabled="disabled"
      :aria-pressed="isActive('dislike')"
      :aria-label="t(ARIA_KEYS.dislike)"
      :title="isActive('dislike') ? t('verdict.clear_hint') : undefined"
      :class="[
        BUTTON_CLASS,
        'px-2 py-1',
        isActive('dislike') ? 'border-red-300 bg-red-50 text-red-500' : INACTIVE_CLASS,
      ]"
      @click="select('dislike')"
    >
      <ThumbsDown class="h-4 w-4 shrink-0" />
    </button>

    <!-- Above `md`: one button per star step, only the chosen one highlighted. -->
    <div data-layout="wide" class="hidden items-center gap-1 md:flex">
      <button
        v-for="step in starSteps"
        :key="step.verdict"
        type="button"
        :data-verdict="step.verdict"
        :disabled="disabled"
        :aria-pressed="isActive(step.verdict)"
        :aria-label="t(ARIA_KEYS[step.verdict])"
        :title="isActive(step.verdict) ? t('verdict.clear_hint') : undefined"
        :class="starButtonClass(step.verdict)"
        @click="select(step.verdict)"
      >
        <Star v-for="i in step.rank" :key="i" class="h-4 w-4 shrink-0 fill-current" />
      </button>
    </div>

    <!-- Below `md`: the three star steps collapse into ONE control that fills
         1..N, because four buttons plus the artist name do not fit at 375px.
         This deliberately gives up "four discrete buttons, one highlighted"
         at this width only -- letting the buttons wrap onto a second line was
         rejected. Do not "fix" this back to four buttons. -->
    <div data-layout="narrow" class="flex items-center md:hidden">
      <button
        v-for="step in starSteps"
        :key="step.verdict"
        type="button"
        :data-verdict="step.verdict"
        :disabled="disabled"
        :aria-pressed="isActive(step.verdict)"
        :aria-label="t(ARIA_KEYS[step.verdict])"
        :title="isActive(step.verdict) ? t('verdict.clear_hint') : undefined"
        :class="[BUTTON_CLASS, 'border-transparent px-1 py-1']"
        @click="select(step.verdict)"
      >
        <Star
          class="h-5 w-5 shrink-0 fill-current"
          :class="isFilled(step.rank) ? 'text-yellow-400' : 'text-gray-200'"
        />
      </button>
    </div>
  </div>
</template>

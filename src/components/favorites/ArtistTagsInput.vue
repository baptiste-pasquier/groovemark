<script setup lang="ts">
import { ref, watch, computed, onMounted, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { AlertCircle } from 'lucide-vue-next'

interface Props {
  modelValue: string[]
  suggestions: string[]
  placeholder?: string
}
const props = defineProps<Props>()
const emit = defineEmits<{ (e: 'update:modelValue', v: string[]): void }>()

const { t } = useI18n()

const input = ref('')
const internal = ref<string[]>([...props.modelValue])
const isFocused = ref(false)
const showUnfinishedInputWarning = ref(false)
const highlightedIndex = ref<number>(-1)
const wrapper = ref<HTMLElement | null>(null)
const inputEl = ref<HTMLInputElement | null>(null)

watch(
  () => props.modelValue,
  (v) => {
    internal.value = [...v]
  },
)

function update(v: string[]) {
  emit('update:modelValue', v)
}

function addTag(raw?: string) {
  const value = (raw ?? input.value).trim()
  if (!value) return
  if (!internal.value.includes(value)) {
    internal.value.push(value)
    update(internal.value)
  }
  input.value = ''
  highlightedIndex.value = -1
  focusInput()
}

function removeTag(idx: number) {
  internal.value.splice(idx, 1)
  update(internal.value)
  focusInput()
}

function onBackspace(e: KeyboardEvent) {
  if (!input.value && internal.value.length && (e.key === 'Backspace' || e.key === 'Delete')) {
    internal.value.pop()
    update(internal.value)
  }
}

const filteredSuggestions = computed(() => {
  const q = input.value.toLowerCase()
  if (!q) return props.suggestions.filter((s) => !internal.value.includes(s)).slice(0, 8)
  return props.suggestions
    .filter((s) => s.toLowerCase().includes(q) && !internal.value.includes(s))
    .sort((a, b) => a.toLowerCase().indexOf(q) - b.toLowerCase().indexOf(q))
    .slice(0, 8)
})

function onKeyDown(e: KeyboardEvent) {
  if (e.key === 'Enter') {
    e.preventDefault()
    if (highlightedIndex.value >= 0 && highlightedIndex.value < filteredSuggestions.value.length) {
      addTag(filteredSuggestions.value[highlightedIndex.value])
    } else {
      addTag()
    }
  } else if (e.key === 'ArrowDown') {
    e.preventDefault()
    if (!filteredSuggestions.value.length) return
    highlightedIndex.value = (highlightedIndex.value + 1) % filteredSuggestions.value.length
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    if (!filteredSuggestions.value.length) return
    highlightedIndex.value =
      (highlightedIndex.value - 1 + filteredSuggestions.value.length) %
      filteredSuggestions.value.length
  } else if (e.key === 'Escape') {
    highlightedIndex.value = -1
  } else if (e.key === 'Tab') {
    if (
      highlightedIndex.value >= 0 &&
      highlightedIndex.value < filteredSuggestions.value.length &&
      filteredSuggestions.value.length
    ) {
      e.preventDefault()
      addTag(filteredSuggestions.value[highlightedIndex.value])
    }
  }
}

function focusInput() {
  nextTick(() => inputEl.value?.focus())
}

function suggestionClick(s: string) {
  addTag(s)
}

function handleClickOutside(ev: MouseEvent) {
  if (!wrapper.value) return
  if (!wrapper.value.contains(ev.target as Node)) {
    isFocused.value = false
    showUnfinishedInputWarning.value = Boolean(input.value.trim())
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})
</script>

<template>
  <div
    v-bind="$attrs"
    ref="wrapper"
    class="relative flex flex-wrap gap-2 rounded-lg border border-gray-300 bg-white px-2 py-2 focus-within:ring-2 focus-within:ring-blue-500"
  >
    <span
      v-for="(tag, idx) in internal"
      :key="tag"
      class="group flex items-center rounded-full bg-blue-100 px-2.5 py-1 text-sm font-semibold text-blue-700"
    >
      <span>{{ tag }}</span>
      <button
        type="button"
        @click="removeTag(idx)"
        class="ml-1 text-blue-500 hover:text-blue-700"
        aria-label="Supprimer"
      >
        ×
      </button>
    </span>
    <input
      ref="inputEl"
      v-model="input"
      :placeholder="internal.length ? '' : props.placeholder || t('modal.artists_placeholder')"
      class="min-w-[120px] flex-1 p-1 text-sm outline-none"
      @keydown="onKeyDown"
      @keydown.delete="onBackspace"
      @focus="((isFocused = true), (showUnfinishedInputWarning = false))"
    />
    <ul
      v-if="isFocused && filteredSuggestions.length"
      class="absolute top-full left-0 z-10 mt-1 max-h-60 w-full overflow-auto rounded-md border border-gray-200 bg-white shadow-lg"
    >
      <li
        v-for="(s, i) in filteredSuggestions"
        :key="s"
        @mousedown.prevent="suggestionClick(s)"
        :class="[
          'flex cursor-pointer justify-between px-3 py-2 text-sm',
          i === highlightedIndex ? 'bg-blue-100' : 'hover:bg-gray-100',
        ]"
      >
        <span>{{ s }}</span>
        <span class="text-xs text-gray-400">{{ t('artist.add') }}</span>
      </li>
    </ul>
  </div>
  <p v-if="showUnfinishedInputWarning" class="m-1 flex items-center text-xs text-amber-600">
    <AlertCircle class="mr-1 h-3 w-3" />
    {{ t('artist.press_enter_to_add') }}
  </p>
</template>

<style scoped></style>

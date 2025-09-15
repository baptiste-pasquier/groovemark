<script setup lang="ts">
import { ref, watch, computed, onMounted, nextTick } from 'vue'

interface Props {
  modelValue: string[]
  suggestions: string[]
  placeholder?: string
}
const props = defineProps<Props>()
const emit = defineEmits<{ (e: 'update:modelValue', v: string[]): void }>()

const input = ref('')
const internal = ref<string[]>([...props.modelValue])
const isFocused = ref(false)
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
  if (!q)
    return props.suggestions.filter((s) => !internal.value.includes(s)).slice(0, 8)
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
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})
</script>

<template>
  <div
    ref="wrapper"
    class="border border-gray-300 rounded-lg px-2 py-2 flex flex-wrap gap-2 focus-within:ring-2 focus-within:ring-blue-500 relative bg-white"
  >
    <span
      v-for="(tag, idx) in internal"
      :key="tag"
      class="flex items-center bg-blue-100 text-blue-700 font-semibold px-2.5 py-1 rounded-full text-sm group"
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
      :placeholder="internal.length ? '' : (props.placeholder || 'Ajouter un artiste')"
      class="flex-1 min-w-[120px] outline-none text-sm p-1"
      @keydown="onKeyDown"
      @keydown.delete="onBackspace"
      @focus="isFocused = true"
    />
    <ul
      v-if="isFocused && filteredSuggestions.length"
      class="absolute left-0 top-full z-10 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto"
    >
      <li
        v-for="(s, i) in filteredSuggestions"
        :key="s"
        @mousedown.prevent="suggestionClick(s)"
        :class="[
          'px-3 py-2 cursor-pointer text-sm flex justify-between',
          i === highlightedIndex ? 'bg-blue-100' : 'hover:bg-gray-100',
        ]"
      >
        <span>{{ s }}</span>
        <span class="text-xs text-gray-400">Ajouter</span>
      </li>
    </ul>
  </div>
</template>

<style scoped></style>

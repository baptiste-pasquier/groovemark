<script setup lang="ts">
import type { Event } from '../../types/event'
import { SquarePen, Trash2, Heart, ThumbsDown, Clock } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'

defineProps<{ event: Event }>()
const emit = defineEmits<{ (e: 'edit', id: string): void; (e: 'delete', id: string): void }>()

const { d } = useI18n()

function formatDate(dateStr: string): string {
  if (!dateStr) return ''
  try {
    const date = new Date(dateStr)
    return d(date, 'short')
  } catch {
    return dateStr
  }
}
</script>

<template>
  <div class="flex flex-col rounded-xl bg-white shadow-lg">
    <!-- Header with event info -->
    <div class="rounded-t-xl bg-gradient-to-r from-purple-600 to-indigo-600 p-4 text-white">
      <div class="flex items-start justify-between">
        <div class="min-w-0 flex-1">
          <h3 class="truncate text-lg font-bold">{{ event.name }}</h3>
          <p v-if="event.venue" class="mt-1 truncate text-sm text-purple-200">
            {{ event.venue }}
          </p>
          <p v-if="event.date" class="mt-1 text-sm text-purple-200">
            {{ formatDate(event.date) }}
          </p>
        </div>
        <div class="ml-2 flex shrink-0 items-center space-x-3">
          <button
            class="rounded text-purple-200 transition-colors hover:text-white focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-purple-600 focus:outline-none"
            @click.stop="emit('edit', event.id)"
          >
            <SquarePen class="h-5 w-5" />
          </button>
          <button
            class="rounded text-purple-200 transition-colors hover:text-red-300 focus:ring-2 focus:ring-red-300 focus:ring-offset-2 focus:ring-offset-purple-600 focus:outline-none"
            @click.stop="emit('delete', event.id)"
          >
            <Trash2 class="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>

    <!-- DJ List -->
    <div v-if="event.djs.length" class="px-4 pt-3 pb-4">
      <div
        v-for="(dj, index) in event.djs"
        :key="index"
        class="flex items-center justify-between rounded-md px-2 py-2 text-sm text-gray-700 hover:bg-gray-50"
      >
        <div class="flex min-w-0 flex-1 items-center gap-2">
          <span class="truncate font-medium">{{ dj.name }}</span>
          <span v-if="dj.time" class="flex shrink-0 items-center gap-1 text-xs text-gray-400">
            <Clock class="h-3 w-3" />
            {{ dj.time }}
          </span>
        </div>
        <div class="ml-2 flex shrink-0 items-center gap-0.5">
          <ThumbsDown v-if="dj.score === -1" class="h-4 w-4 text-red-400" />
          <template v-else>
            <Heart v-for="n in dj.score" :key="n" class="h-4 w-4 fill-current text-red-500" />
            <Heart v-for="n in 3 - dj.score" :key="'empty-' + n" class="h-4 w-4 text-gray-300" />
          </template>
        </div>
      </div>
    </div>
    <div v-else class="px-4 pt-3 pb-4 text-center text-sm text-gray-400">Aucun DJ ajouté</div>
  </div>
</template>

<script setup lang="ts">
import type { Favorite } from '../../types/favorite'
import { buildTimestampLink } from '../../utils/favorite'
import { SquarePen, Trash2, Star, ExternalLink } from 'lucide-vue-next'

const props = defineProps<{ favorite: Favorite }>()
const emit = defineEmits<{ (e: 'edit', id: string): void; (e: 'delete', id: string): void }>()

function openLink() {
  window.open(props.favorite.url, '_blank')
}

function timestampLink(time: string) {
  return buildTimestampLink(props.favorite, { time })
}
</script>

<template>
  <div class="flex flex-col rounded-xl bg-white shadow-lg">
    <div class="card-link relative cursor-pointer" @click="openLink">
      <img
        :src="favorite.thumbnail"
        alt="Thumbnail"
        class="h-40 w-full rounded-t-xl object-cover"
        @error="
          (e: any) => (e.target.src = 'https://placehold.co/600x400/e2e8f0/adb5bd?text=Miniature')
        "
      />
      <div class="absolute top-2 right-2 rounded-full bg-white p-1 shadow-md">
        <svg
          v-if="favorite.type === 'youtube'"
          class="h-6 w-6 text-red-600"
          fill="currentColor"
          viewBox="0 0 24 24"
          role="img"
        >
          <title>YouTube</title>
          <path
            d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"
          />
        </svg>
        <svg
          v-else
          class="h-6 w-6 text-orange-500"
          fill="currentColor"
          viewBox="0 0 24 24"
          role="img"
        >
          <title>SoundCloud</title>
          <path
            d="M23.999 14.165c-.052 1.796-1.612 3.169-3.4 3.169h-8.18a.68.68 0 0 1-.675-.683V7.862a.747.747 0 0 1 .452-.724s.75-.513 2.333-.513a5.364 5.364 0 0 1 2.763.755 5.433 5.433 0 0 1 2.57 3.54c.282-.08.574-.121.868-.12.884 0 1.73.358 2.347.992s.948 1.49.922 2.373ZM10.721 8.421c.247 2.98.427 5.697 0 8.672a.264.264 0 0 1-.53 0c-.395-2.946-.22-5.718 0-8.672a.264.264 0 0 1 .53 0ZM9.072 9.448c.285 2.659.37 4.986-.006 7.655a.277.277 0 0 1-.55 0c-.331-2.63-.256-5.02 0-7.655a.277.277 0 0 1 .556 0Zm-1.663-.257c.27 2.726.39 5.171 0 7.904a.266.266 0 0 1-.532 0c-.38-2.69-.257-5.21 0-7.904a.266.266 0 0 1 .532 0Zm-1.647.77a26.108 26.108 0 0 1-.008 7.147.272.272 0 0 1-.542 0 27.955 27.955 0 0 1 0-7.147.275.275 0 0 1 .55 0Zm-1.67 1.769c.421 1.865.228 3.5-.029 5.388a.257.257 0 0 1-.514 0c-.21-1.858-.398-3.549 0-5.389a.272.272 0 0 1 .543 0Zm-1.655-.273c.388 1.897.26 3.508-.01 5.412-.026.28-.514.283-.54 0-.244-1.878-.347-3.54-.01-5.412a.283.283 0 0 1 .56 0Zm-1.668.911c.4 1.268.257 2.292-.026 3.572a.257.257 0 0 1-.514 0c-.241-1.262-.354-2.312-.023-3.572a.283.283 0 0 1 .563 0Z"
          />
        </svg>
      </div>
    </div>
    <div class="grow p-4">
      <div class="flex items-start justify-between">
        <div>
          <h3 class="mb-1 text-lg font-bold text-gray-800">{{ favorite.title }}</h3>
          <p v-if="favorite.artists.length" class="text-sm text-gray-500">
            {{ favorite.artists.join(', ') }}
          </p>
        </div>
        <div class="ml-2 flex shrink-0 items-center space-x-3">
          <button
            class="rounded text-gray-400 transition-colors hover:text-blue-500 focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 focus:outline-none"
            @click.stop="emit('edit', favorite.id)"
          >
            <SquarePen class="h-5 w-5" />
          </button>
          <button
            class="rounded text-gray-400 transition-colors hover:text-red-500 focus:ring-2 focus:ring-red-400 focus:ring-offset-2 focus:outline-none"
            @click.stop="emit('delete', favorite.id)"
          >
            <Trash2 class="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
    <div v-if="favorite.timestamps.length" class="border-t border-gray-200 px-4 pt-3 pb-4">
      <div class="flex flex-wrap gap-2">
        <a
          v-for="ts in favorite.timestamps"
          :key="ts.time + ts.label"
          :href="timestampLink(ts.time)"
          target="_blank"
          rel="noopener noreferrer"
          class="group flex max-w-full items-center rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-700 transition-all hover:bg-blue-50 hover:text-blue-600 hover:ring-1 hover:ring-blue-200"
        >
          <Star v-if="ts.rated" class="mr-1.5 h-3.5 w-3.5 shrink-0 fill-current text-amber-400" />
          <span v-if="ts.label" class="mr-1.5 truncate text-xs">{{ ts.label }}</span>
          <span class="font-mono text-blue-600">{{ ts.time }}</span>
          <ExternalLink
            class="ml-1.5 h-3 w-3 shrink-0 text-slate-300 transition-colors group-hover:text-blue-400"
          />
        </a>
      </div>
    </div>
  </div>
</template>

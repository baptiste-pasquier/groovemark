<script setup lang="ts">
import type { Favorite } from '../../types/favorite'
import { buildTimestampLink } from '../../utils/favorite'

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
        >
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
            class="text-gray-400 transition-colors hover:text-blue-500"
            @click.stop="emit('edit', favorite.id)"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="2"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10"
              />
            </svg>
          </button>
          <button
            class="text-gray-400 transition-colors hover:text-red-500"
            @click.stop="emit('delete', favorite.id)"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="2"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M19 7l-.867 12.142A2 2 0 0 1 16.138 21H7.862a2 2 0 0 1-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v3M4 7h16"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
    <div v-if="favorite.timestamps.length" class="border-t border-gray-200 px-4 pt-3 pb-4">
      <div
        v-for="ts in favorite.timestamps"
        :key="ts.time + ts.label"
        class="group flex items-center justify-between rounded-md px-2 py-1 text-sm text-gray-700 hover:bg-gray-50"
      >
        <a
          :href="timestampLink(ts.time)"
          target="_blank"
          rel="noopener noreferrer"
          class="flex grow items-center space-x-2"
        >
          <svg
            v-if="ts.rated"
            class="h-4 w-4 shrink-0 text-yellow-400"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"
            />
          </svg>
          <span class="truncate">{{ ts.label || 'Timestamp' }}</span>
        </a>
        <a
          :href="timestampLink(ts.time)"
          target="_blank"
          class="flex shrink-0 items-center font-mono text-blue-500"
        >
          {{ ts.time }}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="ml-1.5 h-4 w-4 opacity-0 transition-opacity group-hover:opacity-100"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="2"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25"
            />
          </svg>
        </a>
      </div>
    </div>
  </div>
</template>

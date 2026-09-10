import { defineStore } from 'pinia'
import { computed } from 'vue'
import type { Artist } from '../types/artist'
import { useArtistsStore } from './artists'

export const useArtistsUiStore = defineStore('artistsUi', () => {
  const artistsStore = useArtistsStore()

  // Slug lookup for the artist address (KTD14). The artist page resolves the
  // performer from `/artists/:slug`, and the artists tab builds the same
  // address for every row, so one map serves both -- and neither reaches into
  // the artists store's own private index.
  const artistsBySlug = computed(
    () => new Map(artistsStore.artists.map((artist) => [artist.slug, artist])),
  )

  // Whether the loaded artist set can be trusted to answer "no such artist".
  // A failed load leaves that set empty or stale, so an address that resolves
  // to nothing means "cannot say" rather than "does not exist" -- which is the
  // distinction the artist page has to draw, because the events tab still
  // renders fully from denormalized names and would otherwise look healthy
  // beside a page reading as not-found.
  const artistsUnavailable = computed(() => artistsStore.loadFailed)

  // The artist an address names, or null when no loaded artist carries that
  // slug. The slug arrives already folded (it *is* a folded display name), so
  // it is matched as given rather than folded a second time.
  function artistBySlug(slug: string): Artist | null {
    return artistsBySlug.value.get(slug) ?? null
  }

  return {
    artistsBySlug,
    artistsUnavailable,
    artistBySlug,
  }
})

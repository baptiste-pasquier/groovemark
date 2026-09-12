import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { MusicEvent } from '../types/event'
import { useEventsStore } from './events'

export const useEventsUiStore = defineStore('eventsUi', () => {
  // The events tab's own search box, and nothing else's. Three independent
  // search boxes now exist, so sharing the ref that filters the mixes grid
  // would let typing in one tab silently narrow another (KTD7).
  const searchTerm = ref('')

  // The direction the tab is read in, never the ordering itself. The domain
  // store returns one canonical date ordering (R11); this reverses what comes
  // out of it, exactly as the mixes tab's own sort does.
  const sortOrder = ref<'newest' | 'oldest'>('newest')

  const eventsStore = useEventsStore()

  // Filters, then reverses -- in that order, so the reversal acts on what the
  // search left rather than on the full list. Both the event name and the
  // venue are searched, because a night is remembered by either (R27).
  const filteredEvents = computed<MusicEvent[]>(() => {
    const normalizedSearchTerm = searchTerm.value.toLowerCase().trim()
    const matchingEvents = normalizedSearchTerm
      ? eventsStore.events.filter(
          (event) =>
            event.name.toLowerCase().includes(normalizedSearchTerm) ||
            event.venue.toLowerCase().includes(normalizedSearchTerm),
        )
      : eventsStore.events

    // Copied before reversing: `events` is the domain store's own array when
    // nothing is searched, and `reverse()` mutates in place.
    return sortOrder.value === 'newest' ? matchingEvents : [...matchingEvents].reverse()
  })

  function setSearch(term: string) {
    searchTerm.value = term
  }

  function toggleSort() {
    sortOrder.value = sortOrder.value === 'newest' ? 'oldest' : 'newest'
  }

  function $reset() {
    searchTerm.value = ''
    sortOrder.value = 'newest'
  }

  return {
    searchTerm,
    sortOrder,
    filteredEvents,
    setSearch,
    toggleSort,
    $reset,
  }
})

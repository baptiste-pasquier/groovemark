import { defineStore } from 'pinia'
import { computed, reactive, toRefs } from 'vue'
import i18n from '../i18n'
import type { Event, EventDj } from '../types/event'
import { eventsService } from '../services/events'
import { useAuthStore } from './auth'
import { useFavoritesStore } from './favorites'

interface EventsState {
  events: Event[]
  sortOrder: 'newest' | 'oldest'
  searchTerm: string
  isLoading: boolean
  usePocketbase: boolean
  initialized: boolean
}

const STORAGE_KEY = 'groovemark_events'

export const useEventsStore = defineStore('events', () => {
  const initialState = (): EventsState => ({
    events: [],
    sortOrder: 'newest',
    searchTerm: '',
    isLoading: false,
    usePocketbase: true,
    initialized: false,
  })

  const state = reactive(initialState())
  const { events, sortOrder, searchTerm, isLoading, usePocketbase, initialized } = toRefs(state)

  async function initializeEvents(force = false) {
    if (initialized.value && !force) return
    initialized.value = true
    isLoading.value = true

    const authStore = useAuthStore()

    try {
      if (authStore.authMode === 'local') {
        usePocketbase.value = false
        events.value = loadFromLocalStorage()
        isLoading.value = false
        return
      }

      if (authStore.authMode === 'google' && authStore.isAuthenticated) {
        const pbAvailable = await eventsService.isAvailable()
        if (pbAvailable) {
          const pbEvents = await eventsService.getAll()
          events.value = pbEvents
          usePocketbase.value = true
          persistToLocalStorage()
        } else {
          usePocketbase.value = false
          events.value = loadFromLocalStorage()
        }
      } else {
        usePocketbase.value = false
        events.value = loadFromLocalStorage()
      }
    } catch (error) {
      console.error('Error initializing events:', error)
      usePocketbase.value = false
      events.value = loadFromLocalStorage()
    } finally {
      isLoading.value = false
    }
  }

  function loadFromLocalStorage(): Event[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return []
      return JSON.parse(raw) as Event[]
    } catch {
      return []
    }
  }

  function persistToLocalStorage() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(events.value))
    } catch (error) {
      console.error('Error persisting events to localStorage:', error)
    }
  }

  async function persist() {
    persistToLocalStorage()
  }

  const filteredEvents = computed(() => {
    const favoritesStore = useFavoritesStore()
    const currentFilter = favoritesStore.currentFilter
    const term = searchTerm.value.toLowerCase().trim()
    return events.value
      .filter((ev) => {
        const artistPass = currentFilter === 'all' || ev.djs.some((dj) => dj.name === currentFilter)
        const searchPass =
          !term ||
          ev.name.toLowerCase().includes(term) ||
          ev.venue.toLowerCase().includes(term) ||
          ev.djs.some((dj) => dj.name.toLowerCase().includes(term))
        return artistPass && searchPass
      })
      .sort((a, b) => {
        const timeA = a.date ? new Date(a.date).getTime() : 0
        const timeB = b.date ? new Date(b.date).getTime() : 0
        return sortOrder.value === 'newest' ? timeB - timeA : timeA - timeB
      })
  })

  function toggleSort() {
    sortOrder.value = sortOrder.value === 'newest' ? 'oldest' : 'newest'
  }

  function setSearch(term: string) {
    searchTerm.value = term
  }

  async function addOrUpdateEvent(partial: Omit<Event, 'id'> & { id?: string; djs: EventDj[] }) {
    const favoritesStore = useFavoritesStore()

    const name = partial.name.trim()
    const venue = partial.venue.trim()
    const date = partial.date

    if (!name) {
      await favoritesStore.showAlert(i18n.global.t('events.error_name_required'), 'alert')
      return false
    }

    const eventData: Omit<Event, 'id'> = {
      name,
      venue,
      date,
      djs: partial.djs,
    }

    try {
      if (usePocketbase.value) {
        if (partial.id) {
          const updated = await eventsService.update(partial.id, eventData)
          const existingIndex = events.value.findIndex((ev) => ev.id === partial.id)
          if (existingIndex > -1) {
            events.value[existingIndex] = updated
          }
        } else {
          const created = await eventsService.create(eventData)
          events.value.push(created)
        }
      } else {
        const id = partial.id || String(Date.now())
        const existingIndex = events.value.findIndex((ev) => ev.id === id)

        const created =
          (existingIndex > -1 && events.value[existingIndex].created) || new Date().toISOString()
        const newEvent: Event = {
          ...eventData,
          id,
          created,
        }

        if (existingIndex > -1) {
          events.value[existingIndex] = newEvent
        } else {
          events.value.push(newEvent)
        }
      }
      await persist()
      return true
    } catch (error) {
      console.error('Error adding/updating event:', error)
      await favoritesStore.showAlert(i18n.global.t('events.error_saving'), 'alert')
      return false
    }
  }

  async function deleteEvent(id: string) {
    const favoritesStore = useFavoritesStore()
    const confirmed = await favoritesStore.showConfirm(i18n.global.t('events.confirm_delete'))
    if (!confirmed) return

    try {
      if (usePocketbase.value) {
        await eventsService.delete(id)
      }
      events.value = events.value.filter((ev) => ev.id !== id)
      await persist()
    } catch (error) {
      console.error('Error deleting event:', error)
      await favoritesStore.showAlert(i18n.global.t('events.error_deleting'), 'alert')
    }
  }

  function reset() {
    Object.assign(state, initialState())
  }

  return {
    events,
    sortOrder,
    searchTerm,
    filteredEvents,
    isLoading,
    usePocketbase,
    initialized,
    toggleSort,
    setSearch,
    addOrUpdateEvent,
    deleteEvent,
    initializeEvents,
    reset,
  }
})

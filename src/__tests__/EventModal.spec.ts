import { describe, it, expect, beforeEach, vi } from 'vitest'
import './mocks/pocketbase'
import { nextTick } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import ArtistTagsInput from '../components/favorites/ArtistTagsInput.vue'
import EventsGrid from '../components/events/EventsGrid.vue'
import EventModal from '../components/modals/EventModal.vue'
import i18n from '../i18n'
import { routes } from '../router'
import { LocalEventsRepository } from '../services/localEventsRepository'
import { useArtistsStore } from '../stores/artists'
import { useAuthStore } from '../stores/auth'
import { useEventsStore } from '../stores/events'
import { useFavoritesUiStore } from '../stores/favoritesUi'
import type { Artist } from '../types/artist'
import type { MusicEvent, Performance, Verdict } from '../types/event'
import { getLocalStorageState, resetLocalStorageMock } from './mocks/localStorage'
import { resetPocketbaseMocks } from './mocks/pocketbase'
import { sessionInit } from './mocks/sessionInit'

const EVENTS_KEY = 'groovemark:events:local'
const ARTISTS_KEY = 'groovemark:artists:local'

function storedArtist(id: string, displayName: string, slug: string): Artist {
  return { id, displayName, slug }
}

function storedPerformance(
  id: string,
  eventId: string,
  artistId: string,
  artistName: string,
  verdict: Verdict | null = null,
): Performance {
  return { id, eventId, artistId, artistName, verdict }
}

function storedEvent(
  id: string,
  name: string,
  dateAttended: string,
  venue: string,
  performances: Performance[] = [],
): MusicEvent {
  return { id, name, dateAttended, venue, performances }
}

async function enterLocalMode(
  options: { events?: MusicEvent[]; artists?: Artist[] } = {},
): Promise<void> {
  localStorage.setItem(EVENTS_KEY, JSON.stringify(options.events ?? []))
  localStorage.setItem(ARTISTS_KEY, JSON.stringify(options.artists ?? []))

  const authStore = useAuthStore()
  authStore.continueInLocalMode()
  await useArtistsStore().initializeForCurrentSession(sessionInit(false))
  await useEventsStore().initializeForCurrentSession(sessionInit(false))
}

function readStoredEvents(): MusicEvent[] {
  const raw = getLocalStorageState()[EVENTS_KEY]
  return raw ? (JSON.parse(raw) as MusicEvent[]) : []
}

function readStoredArtists(): Artist[] {
  const raw = getLocalStorageState()[ARTISTS_KEY]
  return raw ? (JSON.parse(raw) as Artist[]) : []
}

function mountEventModal(editId: string | null = null) {
  return mount(EventModal, {
    props: { modelValue: true, editId },
    global: { plugins: [i18n] },
  })
}

type Wrapper = ReturnType<typeof mountEventModal>

async function fillEventFields(
  wrapper: Wrapper,
  fields: { name?: string; dateAttended?: string; venue?: string },
) {
  if (fields.name !== undefined) await wrapper.find('#event-name').setValue(fields.name)
  if (fields.dateAttended !== undefined)
    await wrapper.find('#event-date').setValue(fields.dateAttended)
  if (fields.venue !== undefined) await wrapper.find('#event-venue').setValue(fields.venue)
}

// Commits an artist name the way the operator does: type into the row's artist
// field and press Enter. Nothing here reaches into the row's state, so a row
// that stops composing the shared artist field would fail these tests.
async function commitArtist(wrapper: Wrapper, rowIndex: number, name: string) {
  const field = wrapper.findAllComponents(ArtistTagsInput)[rowIndex]
  expect(field, `no artist field on performance row ${rowIndex}`).toBeTruthy()
  const input = field.find('input')
  await input.setValue(name)
  await input.trigger('keydown', { key: 'Enter' })
  await flushPromises()
}

// Types an artist name and leaves it uncommitted: the operator never pressed
// Enter and went straight for another control. This is the ordinary path, not
// a race.
async function typeArtistWithoutEnter(wrapper: Wrapper, rowIndex: number, name: string) {
  const field = wrapper.findAllComponents(ArtistTagsInput)[rowIndex]
  expect(field, `no artist field on performance row ${rowIndex}`).toBeTruthy()
  await field.find('input').setValue(name)
}

async function chooseVerdict(wrapper: Wrapper, rowIndex: number, verdict: Verdict) {
  const row = wrapper.findAll('.performance-row')[rowIndex]
  expect(row, `no performance row ${rowIndex}`).toBeTruthy()
  await row.find(`[data-layout="wide"] [data-verdict="${verdict}"]`).trigger('click')
}

async function addPerformanceRow(wrapper: Wrapper) {
  await wrapper.find('#add-performance-btn').trigger('click')
}

async function submit(wrapper: Wrapper) {
  await wrapper.find('form').trigger('submit')
  await flushPromises()
}

function closedOnce(wrapper: Wrapper): boolean {
  const emitted = wrapper.emitted('update:modelValue') ?? []
  return emitted.some((payload) => payload[0] === false)
}

function datalistValues(wrapper: Wrapper, inputSelector: string): string[] {
  const listId = wrapper.find(inputSelector).attributes('list')
  expect(listId, `${inputSelector} offers no suggestion list`).toBeTruthy()
  return wrapper
    .find(`datalist#${listId}`)
    .findAll('option')
    .map((option) => option.attributes('value') ?? option.text())
}

describe('EventModal', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    setActivePinia(createPinia())
    resetLocalStorageMock()
    resetPocketbaseMocks()
    i18n.global.locale.value = 'en'
  })

  it('records a whole line-up in one save (R8, R10)', async () => {
    await enterLocalMode()
    const wrapper = mountEventModal()

    await fillEventFields(wrapper, {
      name: 'Nuits Sonores',
      dateAttended: '2026-05-04',
      venue: 'Les Subsistances',
    })
    await addPerformanceRow(wrapper)
    await addPerformanceRow(wrapper)

    await commitArtist(wrapper, 0, 'Anetha')
    await commitArtist(wrapper, 1, 'Trym')
    await commitArtist(wrapper, 2, 'I Hate Models')
    await chooseVerdict(wrapper, 1, 'three-stars')

    await submit(wrapper)

    const events = readStoredEvents()
    expect(events).toHaveLength(1)
    expect(events[0].name).toBe('Nuits Sonores')
    expect(events[0].dateAttended).toBe('2026-05-04')
    expect(events[0].venue).toBe('Les Subsistances')
    expect(events[0].performances.map((performance) => performance.artistName)).toEqual([
      'Anetha',
      'Trym',
      'I Hate Models',
    ])
    expect(events[0].performances.map((performance) => performance.verdict)).toEqual([
      null,
      'three-stars',
      null,
    ])
    expect(closedOnce(wrapper)).toBe(true)
  })

  it('credits an artist already known under a different casing rather than creating a second (AE6)', async () => {
    await enterLocalMode({ artists: [storedArtist('artist-anetha', 'Anetha', 'anetha')] })
    const wrapper = mountEventModal()

    await fillEventFields(wrapper, { name: 'Warehouse night', dateAttended: '2026-02-14' })
    await commitArtist(wrapper, 0, 'ANETHA')

    await submit(wrapper)

    const [performance] = readStoredEvents()[0].performances
    expect(performance.artistId).toBe('artist-anetha')
    // The identity on record keeps its own spelling, not the typed one.
    expect(performance.artistName).toBe('Anetha')
    expect(readStoredArtists().map((artist) => artist.slug)).toEqual(['anetha'])
  })

  it('adds no performance and creates no artist for a name that is empty once trimmed (AE7)', async () => {
    await enterLocalMode()
    const wrapper = mountEventModal()

    await fillEventFields(wrapper, { name: 'Quiet night', dateAttended: '2026-03-01' })
    await commitArtist(wrapper, 0, '   ')

    await submit(wrapper)

    expect(readStoredEvents()[0].performances).toEqual([])
    expect(readStoredArtists()).toEqual([])
  })

  it('saves a performance as unrated once its verdict is cleared (AE2, R4)', async () => {
    await enterLocalMode()
    const wrapper = mountEventModal()

    await fillEventFields(wrapper, { name: 'Peacock Society', dateAttended: '2026-07-06' })
    await commitArtist(wrapper, 0, 'Trym')
    await chooseVerdict(wrapper, 0, 'two-stars')
    // Re-choosing the active verdict is how the shared control clears back to
    // unrated, so the row carries no verdict at all rather than a lowest one.
    await chooseVerdict(wrapper, 0, 'two-stars')

    await submit(wrapper)

    const [performance] = readStoredEvents()[0].performances
    expect(performance.artistName).toBe('Trym')
    expect(performance.verdict).toBeNull()
  })

  it('saves an event holding no performance at all (R7)', async () => {
    await enterLocalMode()
    const wrapper = mountEventModal()

    await fillEventFields(wrapper, { name: 'Solo set', dateAttended: '2026-04-02' })
    await wrapper.find('.performance-row .remove-performance-btn').trigger('click')
    expect(wrapper.findAll('.performance-row')).toHaveLength(0)

    await submit(wrapper)

    expect(readStoredEvents()[0].performances).toEqual([])
    expect(closedOnce(wrapper)).toBe(true)
  })

  it('removes only the row the operator removed (R8)', async () => {
    const performances = [
      storedPerformance('perf-1', 'event-1', 'artist-anetha', 'Anetha', 'two-stars'),
      storedPerformance('perf-2', 'event-1', 'artist-trym', 'Trym', 'dislike'),
    ]
    await enterLocalMode({
      events: [storedEvent('event-1', 'Nuits Sonores', '2026-05-04', 'Le Sucre', performances)],
      artists: [
        storedArtist('artist-anetha', 'Anetha', 'anetha'),
        storedArtist('artist-trym', 'Trym', 'trym'),
      ],
    })
    const wrapper = mountEventModal('event-1')

    await wrapper.findAll('.performance-row')[0].find('.remove-performance-btn').trigger('click')

    await submit(wrapper)

    const [event] = readStoredEvents()
    expect(event.performances).toHaveLength(1)
    expect(event.performances[0].id).toBe('perf-2')
    expect(event.performances[0].verdict).toBe('dislike')
    // No confirmation stands between removing a row and saving: the whole
    // event is what saves or fails, so nothing is lost until then.
    expect(useFavoritesUiStore().confirmDialog.visible).toBe(false)
  })

  it('keeps the modal open with the typed values on screen when the save fails (AE8)', async () => {
    await enterLocalMode()
    vi.spyOn(LocalEventsRepository.prototype, 'create').mockRejectedValue(
      new Error('storage refused the write'),
    )
    const favoritesUiStore = useFavoritesUiStore()
    const wrapper = mountEventModal()

    await fillEventFields(wrapper, {
      name: 'Nuits Sonores',
      dateAttended: '2026-05-04',
      venue: 'Les Subsistances',
    })
    await commitArtist(wrapper, 0, 'Anetha')

    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(favoritesUiStore.alertDialog.visible).toBe(true)
    favoritesUiStore.closeAlert()
    await flushPromises()

    expect(closedOnce(wrapper)).toBe(false)
    expect((wrapper.find('#event-name').element as HTMLInputElement).value).toBe('Nuits Sonores')
    expect((wrapper.find('#event-date').element as HTMLInputElement).value).toBe('2026-05-04')
    expect((wrapper.find('#event-venue').element as HTMLInputElement).value).toBe(
      'Les Subsistances',
    )
    expect(wrapper.find('.performance-row').text()).toContain('Anetha')
    expect(readStoredEvents()).toEqual([])
  })

  it('keeps a performance whose artist was typed but never committed with Enter', async () => {
    await enterLocalMode()
    const wrapper = mountEventModal()

    await fillEventFields(wrapper, { name: 'Nuits Sonores', dateAttended: '2026-05-04' })
    await typeArtistWithoutEnter(wrapper, 0, 'Anetha')
    // Choosing the verdict clicks outside the artist field, which is what
    // blurs it without committing the typed name.
    await chooseVerdict(wrapper, 0, 'three-stars')

    await submit(wrapper)

    const [event] = readStoredEvents()
    expect(event.performances).toHaveLength(1)
    expect(event.performances[0].artistName).toBe('Anetha')
    expect(event.performances[0].verdict).toBe('three-stars')
    expect(readStoredArtists().map((artist) => artist.displayName)).toEqual(['Anetha'])
    expect(closedOnce(wrapper)).toBe(true)
  })

  it('keeps every row when only one of several artists was left uncommitted', async () => {
    await enterLocalMode()
    const wrapper = mountEventModal()

    await fillEventFields(wrapper, { name: 'Nuits Sonores', dateAttended: '2026-05-04' })
    await addPerformanceRow(wrapper)

    await commitArtist(wrapper, 0, 'Anetha')
    await typeArtistWithoutEnter(wrapper, 1, 'Trym')

    await submit(wrapper)

    const [event] = readStoredEvents()
    expect(event.performances.map((performance) => performance.artistName)).toEqual([
      'Anetha',
      'Trym',
    ])
  })

  it('withholds Cancel while a save is in flight, so it cannot close a later draft', async () => {
    await enterLocalMode()
    // A save that never settles: the operator is looking at the modal mid-save.
    vi.spyOn(LocalEventsRepository.prototype, 'create').mockReturnValue(
      new Promise<MusicEvent>(() => {}),
    )
    const wrapper = mountEventModal()

    await fillEventFields(wrapper, { name: 'Nuits Sonores', dateAttended: '2026-05-04' })
    expect(wrapper.find('#event-cancel-btn').attributes('disabled')).toBeUndefined()

    await wrapper.find('form').trigger('submit')
    await nextTick()

    expect(wrapper.find('#event-save-btn').attributes('disabled')).toBeDefined()
    expect(wrapper.find('#event-cancel-btn').attributes('disabled')).toBeDefined()

    await wrapper.find('#event-cancel-btn').trigger('click')
    expect(closedOnce(wrapper)).toBe(false)
  })

  it('refuses an empty date attended (R1, KTD10)', async () => {
    await enterLocalMode()
    const wrapper = mountEventModal()
    const dateInput = wrapper.find('#event-date')

    expect(dateInput.attributes('type')).toBe('date')
    expect(dateInput.attributes('required')).toBeDefined()

    await fillEventFields(wrapper, { name: 'Undated night', dateAttended: '' })
    await submit(wrapper)

    expect(readStoredEvents()).toEqual([])
    expect(closedOnce(wrapper)).toBe(false)
  })

  it('offers the event name and the venue of an earlier event as suggestions (R6)', async () => {
    await enterLocalMode({
      events: [
        storedEvent('event-1', 'Nuits Sonores', '2026-05-04', 'Les Subsistances'),
        storedEvent('event-2', 'Peacock Society', '2025-07-06', 'Parc Floral'),
        // A repeat contributes one suggestion, not two.
        storedEvent('event-3', 'Nuits Sonores', '2024-05-04', 'Les Subsistances'),
      ],
    })
    const wrapper = mountEventModal()

    expect(datalistValues(wrapper, '#event-venue')).toEqual(['Les Subsistances', 'Parc Floral'])
    expect(datalistValues(wrapper, '#event-name')).toEqual(['Nuits Sonores', 'Peacock Society'])
    // Two independent sources: a venue never turns up as a name suggestion.
    expect(datalistValues(wrapper, '#event-name')).not.toContain('Les Subsistances')
  })

  it('hydrates every field and every row when a saved event is reopened (AE17)', async () => {
    await enterLocalMode({
      events: [
        storedEvent('event-1', 'Nuits Sonores', '2026-05-04', 'Les Subsitances', [
          storedPerformance('perf-1', 'event-1', 'artist-anetha', 'Anetha', 'three-stars'),
          storedPerformance('perf-2', 'event-1', 'artist-trym', 'Trym'),
        ]),
      ],
      artists: [
        storedArtist('artist-anetha', 'Anetha', 'anetha'),
        storedArtist('artist-trym', 'Trym', 'trym'),
      ],
    })
    const wrapper = mountEventModal('event-1')

    expect((wrapper.find('#event-name').element as HTMLInputElement).value).toBe('Nuits Sonores')
    expect((wrapper.find('#event-date').element as HTMLInputElement).value).toBe('2026-05-04')
    expect((wrapper.find('#event-venue').element as HTMLInputElement).value).toBe('Les Subsitances')

    const rows = wrapper.findAll('.performance-row')
    expect(rows).toHaveLength(2)
    expect(rows[0].text()).toContain('Anetha')
    expect(rows[1].text()).toContain('Trym')
    expect(
      rows[0].find('[data-layout="wide"] [data-verdict="three-stars"]').attributes('aria-pressed'),
    ).toBe('true')
    // The unrated row shows nothing pressed rather than a lowest step.
    expect(
      rows[1]
        .findAll('[data-layout="wide"] [data-verdict]')
        .map((button) => button.attributes('aria-pressed')),
    ).toEqual(['false', 'false', 'false'])
  })

  it('leaves the performances untouched when only the venue is corrected (AE17)', async () => {
    await enterLocalMode({
      events: [
        storedEvent('event-1', 'Nuits Sonores', '2026-05-04', 'Les Subsitances', [
          storedPerformance('perf-1', 'event-1', 'artist-anetha', 'Anetha', 'three-stars'),
          storedPerformance('perf-2', 'event-1', 'artist-trym', 'Trym'),
        ]),
      ],
      artists: [
        storedArtist('artist-anetha', 'Anetha', 'anetha'),
        storedArtist('artist-trym', 'Trym', 'trym'),
      ],
    })
    const wrapper = mountEventModal('event-1')

    await fillEventFields(wrapper, { venue: 'Les Subsistances' })
    await submit(wrapper)

    const [event] = readStoredEvents()
    expect(event.venue).toBe('Les Subsistances')
    expect(event.performances).toEqual([
      storedPerformance('perf-1', 'event-1', 'artist-anetha', 'Anetha', 'three-stars'),
      storedPerformance('perf-2', 'event-1', 'artist-trym', 'Trym'),
    ])
    expect(readStoredEvents()).toHaveLength(1)
  })
})

// The modal is a sibling of the events grid, mounted by the events tab: the
// tab is where a new event starts and where a card reopens an existing one.
describe('EventModal in the events tab', () => {
  const EVENT_CARD_STUB = {
    name: 'EventCard',
    template:
      '<div class="event-card" @click="$emit(\'open\', event.id)">' +
      '<button class="event-card-delete" @click.stop="$emit(\'delete\', event.id)" />' +
      '</div>',
    props: ['event'],
    emits: ['open', 'delete'],
  }

  async function mountEventsGrid() {
    const router = createRouter({ history: createMemoryHistory(), routes })
    await router.push('/events')
    await router.isReady()

    return mount(EventsGrid, {
      global: { plugins: [i18n, router], stubs: { EventCard: EVENT_CARD_STUB } },
    })
  }

  beforeEach(() => {
    vi.restoreAllMocks()
    setActivePinia(createPinia())
    resetLocalStorageMock()
    resetPocketbaseMocks()
    i18n.global.locale.value = 'en'
  })

  it('opens an empty surface from the new-event affordance', async () => {
    await enterLocalMode()
    const wrapper = await mountEventsGrid()

    expect(wrapper.findComponent(EventModal).props('modelValue')).toBe(false)

    await wrapper.find('#add-event-btn').trigger('click')

    const modal = wrapper.findComponent(EventModal)
    expect(modal.props('modelValue')).toBe(true)
    expect(modal.props('editId')).toBeNull()
    expect(wrapper.find('#event-name').exists()).toBe(true)
  })

  it('opens the event a card reopens on the same surface (R8, AE17)', async () => {
    await enterLocalMode({
      events: [storedEvent('event-1', 'Nuits Sonores', '2026-05-04', 'Le Sucre')],
    })
    const wrapper = await mountEventsGrid()

    await wrapper.find('.event-card').trigger('click')

    const modal = wrapper.findComponent(EventModal)
    expect(modal.props('modelValue')).toBe(true)
    expect(modal.props('editId')).toBe('event-1')
  })

  it('routes a card deletion through the store confirmation, naming the performances (R26, AE16)', async () => {
    await enterLocalMode({
      events: [
        storedEvent('event-1', 'Nuits Sonores', '2026-05-04', 'Le Sucre', [
          storedPerformance('perf-1', 'event-1', 'artist-anetha', 'Anetha', 'three-stars'),
          storedPerformance('perf-2', 'event-1', 'artist-trym', 'Trym'),
        ]),
      ],
    })
    const wrapper = await mountEventsGrid()
    const favoritesUiStore = useFavoritesUiStore()

    await wrapper.find('.event-card-delete').trigger('click')
    await flushPromises()

    // No delete path reaches storage without the confirmation, and the
    // confirmation says what goes with the night.
    expect(favoritesUiStore.confirmDialog.visible).toBe(true)
    expect(favoritesUiStore.confirmDialog.message).toContain('2 performances')
    expect(readStoredEvents()).toHaveLength(1)

    favoritesUiStore.respondConfirm(true)
    await flushPromises()

    expect(useEventsStore().events).toEqual([])
    expect(readStoredEvents()).toEqual([])
  })

  it('withholds the new-event affordance while the session is read-only', async () => {
    await enterLocalMode()
    // A failed events load is what puts a session in read-only, and it is the
    // app store that owns that switch.
    useEventsStore().loadFailed = true
    const wrapper = await mountEventsGrid()

    expect(wrapper.find('#add-event-btn').attributes('disabled')).toBeDefined()
  })
})

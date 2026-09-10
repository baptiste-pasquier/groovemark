import type { Artist } from '../../src/types/artist'
import type { MusicEvent } from '../../src/types/event'
import type { Favorite } from '../../src/types/favorite'

// The artist records the seeded mixes and events credit. A mix credits an
// artist by relation id and an event card builds an artist's address from the
// folded display name, so without these records every credited name in the
// demo would land on the not-found page instead of a real artist page.
export const demoArtists: Artist[] = [
  { id: 'demo-artist-anetha', displayName: 'Anetha', slug: 'anetha' },
  { id: 'demo-artist-kiki', displayName: 'KI/KI', slug: 'ki/ki' },
  { id: 'demo-artist-boiler-room', displayName: 'Boiler Room', slug: 'boiler room' },
  { id: 'demo-artist-i-hate-models', displayName: 'I Hate Models', slug: 'i hate models' },
  { id: 'demo-artist-amelie-lens', displayName: 'Amelie Lens', slug: 'amelie lens' },
]

export const demoFavorites: Favorite[] = [
  {
    id: 'demo-anetha',
    url: 'https://www.youtube.com/watch?v=9ut-zmXBQhQ',
    title: 'Anetha | Techno DJ Set | SECTION. | November 2025',
    artists: ['Anetha'],
    artistIds: ['demo-artist-anetha'],
    type: 'youtube',
    thumbnail: 'https://i.ytimg.com/vi/9ut-zmXBQhQ/hqdefault.jpg',
    timestamps: [
      { label: 'Warehouse lift', time: '00:53', rated: true },
      { label: 'Peak-time reentry', time: '02:31', rated: false },
    ],
    created: '2026-03-01T10:00:00.000Z',
  },
  {
    id: 'demo-kiki',
    url: 'https://www.youtube.com/watch?v=5j8cbL2Vouk',
    title: 'KI/KI - Stone Techno Festival 2022 - @ARTE Concert',
    artists: ['KI/KI'],
    artistIds: ['demo-artist-kiki'],
    type: 'youtube',
    thumbnail: 'https://i.ytimg.com/vi/5j8cbL2Vouk/hqdefault.jpg',
    timestamps: [
      { label: 'Kick drum drop', time: '00:52', rated: true },
      { label: 'Strobe pressure', time: '02:05', rated: false },
    ],
    created: '2026-03-02T10:00:00.000Z',
  },
  {
    id: 'demo-marron',
    url: 'https://www.youtube.com/watch?v=HngeU4OUbmI',
    title: 'MARRØN | Boiler Room x Glitch Festival 2024',
    artists: ['Boiler Room'],
    artistIds: ['demo-artist-boiler-room'],
    type: 'youtube',
    thumbnail: 'https://i.ytimg.com/vi/HngeU4OUbmI/hqdefault.jpg',
    timestamps: [{ label: 'Hypnotic loop', time: '01:19', rated: true }],
    created: '2026-03-03T10:00:00.000Z',
  },
]

// Two attended nights, performances nested under their event exactly as local
// mode stores them. Anetha appears at both, and also keeps a mix above, so her
// artist page has both halves filled: the mixes crediting her, and the nights
// she was seen live. One row is deliberately left unrated, so the line-up shows
// the unrated badge beside the rated ones.
export const demoEvents: MusicEvent[] = [
  {
    id: 'demo-event-dour',
    name: 'Dour Festival',
    dateAttended: '2026-07-16',
    venue: 'Dour, Belgium',
    performances: [
      {
        id: 'demo-perf-dour-anetha',
        eventId: 'demo-event-dour',
        artistId: 'demo-artist-anetha',
        artistName: 'Anetha',
        verdict: 'three-stars',
      },
      {
        id: 'demo-perf-dour-ihm',
        eventId: 'demo-event-dour',
        artistId: 'demo-artist-i-hate-models',
        artistName: 'I Hate Models',
        verdict: 'two-stars',
      },
      {
        id: 'demo-perf-dour-lens',
        eventId: 'demo-event-dour',
        artistId: 'demo-artist-amelie-lens',
        artistName: 'Amelie Lens',
        verdict: null,
      },
    ],
  },
  {
    id: 'demo-event-nuits-sonores',
    name: 'Nuits Sonores',
    dateAttended: '2026-05-04',
    venue: 'Les Subsistances, Lyon',
    performances: [
      {
        id: 'demo-perf-nuits-kiki',
        eventId: 'demo-event-nuits-sonores',
        artistId: 'demo-artist-kiki',
        artistName: 'KI/KI',
        verdict: 'three-stars',
      },
      {
        id: 'demo-perf-nuits-anetha',
        eventId: 'demo-event-nuits-sonores',
        artistId: 'demo-artist-anetha',
        artistName: 'Anetha',
        verdict: 'one-star',
      },
    ],
  },
]

export const demoMetadata = {
  title: 'Daft Punk - One More Time (Official Video)',
  artist: 'Daft Punk',
  thumbnail: 'https://i.ytimg.com/vi/FGBhQbmPwH8/hqdefault.jpg',
}

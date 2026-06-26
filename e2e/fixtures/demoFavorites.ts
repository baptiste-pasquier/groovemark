import type { Favorite } from '../../src/types/favorite'

export const demoFavorites: Favorite[] = [
  {
    id: 'demo-anetha',
    url: 'https://www.youtube.com/watch?v=9ut-zmXBQhQ',
    title: 'Anetha | Techno DJ Set | SECTION. | November 2025',
    artists: ['Anetha'],
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
    type: 'youtube',
    thumbnail: 'https://i.ytimg.com/vi/HngeU4OUbmI/hqdefault.jpg',
    timestamps: [{ label: 'Hypnotic loop', time: '01:19', rated: true }],
    created: '2026-03-03T10:00:00.000Z',
  },
]

export const demoMetadata = {
  title: 'Daft Punk - One More Time (Official Video)',
  artist: 'Daft Punk',
  thumbnail: 'https://i.ytimg.com/vi/FGBhQbmPwH8/hqdefault.jpg',
}

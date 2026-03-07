import { describe, it, expect } from 'vitest'
import { timeFormatIsValid, parseTimeToSeconds, buildTimestampLink } from '../utils/favorite'
import type { Favorite, Timestamp } from '../types/favorite'

function mockFavorite(partial: Partial<Favorite> = {}): Favorite {
  return {
    id: '1',
    url: partial.url || 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    title: 'Test',
    artists: [],
    type: partial.type || 'youtube',
    thumbnail: '',
    timestamps: [],
  }
}

describe('favorite utils', () => {
  it('validates time formats', () => {
    expect(timeFormatIsValid('1:23')).toBe(true)
    expect(timeFormatIsValid('01:23')).toBe(true)
    expect(timeFormatIsValid('1:02:03')).toBe(true)
    expect(timeFormatIsValid('123:45')).toBe(true)
    expect(timeFormatIsValid('1:2')).toBe(false)
    expect(timeFormatIsValid('abc')).toBe(false)
  })

  it('parses times to seconds', () => {
    expect(parseTimeToSeconds('1:23')).toBe(83)
    expect(parseTimeToSeconds('1:02:03')).toBe(3723)
    expect(parseTimeToSeconds('45')).toBe(45)
  })

  it('builds youtube timestamp link', () => {
    const fav = mockFavorite()
    const ts: Timestamp = { label: 'intro', time: '1:23', rated: false }
    const link = buildTimestampLink(fav, ts)
    expect(link).toContain('t=83s')
  })

  it('builds soundcloud timestamp link', () => {
    const fav = mockFavorite({
      url: 'https://soundcloud.com/user/track',
      type: 'soundcloud',
    })
    const ts: Timestamp = { label: 'intro', time: '1:23', rated: false }
    const link = buildTimestampLink(fav, ts)
    expect(link).toContain('#t=1:23')
  })

  it('rejects unsafe timestamp links', () => {
    const fav = mockFavorite({
      url: 'javascript:alert(1)',
    })
    const ts: Timestamp = { label: 'intro', time: '1:23', rated: false }
    const link = buildTimestampLink(fav, ts)
    expect(link).toBeNull()
  })
})

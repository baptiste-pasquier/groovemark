import { describe, it, expect, vi } from 'vitest'
import {
  normalizeArtistName,
  electArtistDisplayNames,
  findArtistByName,
  createOrFindArtist,
} from '../utils/artist'
import type { Artist } from '../types/artist'

describe('artist utils', () => {
  describe('normalizeArtistName', () => {
    it('normalizes names differing only by case to the same slug', () => {
      expect(normalizeArtistName('Daft Punk')).toBe(normalizeArtistName('daft punk'))
      expect(normalizeArtistName('DAFT PUNK')).toBe(normalizeArtistName('daft punk'))
    })

    it('normalizes names differing only by accents to the same slug', () => {
      expect(normalizeArtistName('Beyoncé')).toBe(normalizeArtistName('Beyonce'))
      expect(normalizeArtistName('Amélie')).toBe(normalizeArtistName('Amelie'))
    })

    it('collapses leading, trailing and repeated inner whitespace', () => {
      expect(normalizeArtistName('  The   Weeknd  ')).toBe(normalizeArtistName('The Weeknd'))
      expect(normalizeArtistName('The   Weeknd')).toBe('the weeknd')
    })

    // AE8: a name that is empty once trimmed produces no slug and is rejected.
    it('rejects a name that is empty once trimmed', () => {
      expect(normalizeArtistName('   ')).toBeNull()
      expect(normalizeArtistName('')).toBeNull()
    })
  })

  describe('electArtistDisplayNames', () => {
    // AE18: election picks the most frequent spelling among four variants.
    it('picks the most frequent spelling among four variants', () => {
      const winners = electArtistDisplayNames(['Deadmau5', 'deadmau5', 'Deadmau5', 'DEADMAU5'])
      const slug = normalizeArtistName('deadmau5')
      expect(slug).not.toBeNull()
      expect(winners.get(slug as string)).toBe('Deadmau5')
    })

    it('picks the accented form when two spellings tie in frequency', () => {
      const winners = electArtistDisplayNames(['Amelie', 'Amélie'])
      const slug = normalizeArtistName('amelie')
      expect(slug).not.toBeNull()
      expect(winners.get(slug as string)).toBe('Amélie')
    })

    it('picks the code-point-first spelling when two unaccented spellings tie', () => {
      // 'amelie' vs 'Amelie': equal frequency (1 each), neither accented, so
      // KTD5's second tiebreak applies. 'A' (U+0041) sorts before 'a'
      // (U+0061), so 'Amelie' < 'amelie' and 'Amelie' wins.
      const winners = electArtistDisplayNames(['amelie', 'Amelie'])
      const slug = normalizeArtistName('amelie')
      expect(slug).not.toBeNull()
      expect(winners.get(slug as string)).toBe('Amelie')
    })

    it('returns the same winner regardless of input order', () => {
      const forward = electArtistDisplayNames(['Deadmau5', 'deadmau5', 'Deadmau5', 'DEADMAU5'])
      const shuffled = electArtistDisplayNames(['DEADMAU5', 'Deadmau5', 'deadmau5', 'Deadmau5'])
      const slug = normalizeArtistName('deadmau5') as string
      expect(forward.get(slug)).toBe(shuffled.get(slug))
      expect(forward.get(slug)).toBe('Deadmau5')
    })
  })

  describe('findArtistByName', () => {
    const artists: Artist[] = [{ id: '1', displayName: 'Daft Punk', slug: 'daft punk' }]

    it('finds an artist in an array index by a matching (case/accent-insensitive) name', () => {
      expect(findArtistByName('DAFT PUNK', artists)).toBe(artists[0])
      expect(findArtistByName('  daft   punk  ', artists)).toBe(artists[0])
    })

    it('returns null when no artist matches', () => {
      expect(findArtistByName('Justice', artists)).toBeNull()
      expect(findArtistByName('   ', artists)).toBeNull()
    })
  })

  describe('createOrFindArtist', () => {
    // KTD7: the happy path never needs the fallback find at all.
    it('returns the created artist without calling findBySlug when create succeeds', async () => {
      const created: Artist = { id: '1', displayName: 'Daft Punk', slug: 'daft punk' }
      const repository = {
        create: vi.fn().mockResolvedValue(created),
        findBySlug: vi.fn(),
      }

      const resolved = await createOrFindArtist(
        repository,
        { displayName: 'Daft Punk', slug: 'daft punk' },
        'daft punk',
      )

      expect(resolved).toBe(created)
      expect(repository.findBySlug).not.toHaveBeenCalled()
    })

    // KTD7 race-recovery success/reuse branch: create is rejected by the
    // unique index, but the fallback find turns up the record that won the
    // race, so the loser reuses it instead of losing the credit.
    it('reuses the artist found by findBySlug when create is rejected and the fallback find succeeds', async () => {
      const winner: Artist = { id: 'winner-1', displayName: 'Daft Punk', slug: 'daft punk' }
      const createError = new Error('unique index violation')
      const repository = {
        create: vi.fn().mockRejectedValue(createError),
        findBySlug: vi.fn().mockResolvedValue(winner),
      }

      const resolved = await createOrFindArtist(
        repository,
        { displayName: 'Daft Punk (dup)', slug: 'daft punk' },
        'daft punk',
      )

      expect(resolved).toBe(winner)
      expect(repository.findBySlug).toHaveBeenCalledWith('daft punk')
    })

    // KTD6: when the fallback find also comes up empty, the original create
    // error propagates so the caller can decide what a genuine failure means.
    it('rethrows the original create error when the fallback find finds nothing', async () => {
      const createError = new Error('unique index violation')
      const repository = {
        create: vi.fn().mockRejectedValue(createError),
        findBySlug: vi.fn().mockResolvedValue(null),
      }

      await expect(
        createOrFindArtist(
          repository,
          { displayName: 'Daft Punk (dup)', slug: 'daft punk' },
          'daft punk',
        ),
      ).rejects.toBe(createError)
    })
  })
})

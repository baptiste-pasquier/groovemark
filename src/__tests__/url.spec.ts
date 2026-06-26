import { beforeEach, describe, expect, it } from 'vitest'
import './mocks/pocketbase'
import { resetPocketbaseMocks } from './mocks/pocketbase'
import { isSoundCloudUrl, normalizeUrl } from '../utils/url'

describe('URL utilities', () => {
  beforeEach(() => {
    resetPocketbaseMocks()
  })

  it('accepts only SoundCloud hosts and their subdomains', () => {
    expect(isSoundCloudUrl('https://soundcloud.com/artist/track')).toBe(true)
    expect(isSoundCloudUrl('https://m.soundcloud.com/artist/track')).toBe(true)
    expect(isSoundCloudUrl('https://on.soundcloud.com/abc123')).toBe(true)
    expect(isSoundCloudUrl('https://evil-soundcloud.com/artist/track')).toBe(false)
    expect(isSoundCloudUrl('https://soundcloud.com.evil.example/artist/track')).toBe(false)
    expect(isSoundCloudUrl('not a url')).toBe(false)
  })

  it('normalizes real SoundCloud URLs without trusting lookalike hosts', async () => {
    await expect(
      normalizeUrl('https://m.soundcloud.com/artist/track?utm_source=test'),
    ).resolves.toBe('https://m.soundcloud.com/artist/track')

    await expect(
      normalizeUrl('https://evil-soundcloud.com/artist/track?utm_source=test'),
    ).resolves.toBe('https://evil-soundcloud.com/artist/track?utm_source=test')

    await expect(
      normalizeUrl('https://soundcloud.com.evil.example/artist/track?utm_source=test'),
    ).resolves.toBe('https://soundcloud.com.evil.example/artist/track?utm_source=test')
  })
})

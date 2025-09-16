import type { Favorite, Timestamp } from '../types/favorite'
import { getYoutubeVideoId } from './url'

// Validate time formats like M:SS, MM:SS, H:MM:SS, HH:MM:SS, up to 3-digit hours.
export function timeFormatIsValid(time: string): boolean {
  const t = time.replace(/\s/g, '')
  return /^\d{1,3}:?\d{2}(:\d{2})?$/.test(t)
}

// Parse a time string (H:MM:SS or MM:SS or SS) into seconds.
export function parseTimeToSeconds(time: string): number {
  const parts = time
    .split(':')
    .map((n) => Number(n))
    .filter((n) => !isNaN(n))
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
  if (parts.length === 2) return parts[0] * 60 + parts[1]
  if (parts.length === 1) return parts[0]
  return 0
}

// Build a link to a specific timestamp for a favorite based on platform.
export function buildTimestampLink(fav: Favorite, ts: Timestamp | { time: string }): string {
  const seconds = parseTimeToSeconds(ts.time)
  if (fav.type === 'youtube') {
    const videoId = getYoutubeVideoId(fav.url)
    return videoId ? `https://www.youtube.com/watch?v=${videoId}&t=${seconds}s` : fav.url
  }
  // For SoundCloud we keep original time token (not converting) for hash linking.
  return `${fav.url}#t=${ts.time}`
}

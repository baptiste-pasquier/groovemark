import pb from '../services/pocketbase'

const SOUNDCLOUD_HOST = 'soundcloud.com'
const SOUNDCLOUD_SHORT_HOST = 'on.soundcloud.com'

function isExactHostnameOrSubdomain(hostname: string, baseHostname: string): boolean {
  const normalizedHostname = hostname.toLowerCase()
  const normalizedBaseHostname = baseHostname.toLowerCase()

  return (
    normalizedHostname === normalizedBaseHostname ||
    normalizedHostname.endsWith(`.${normalizedBaseHostname}`)
  )
}

export function isSafeHttpUrl(inputUrl: string): boolean {
  try {
    const url = new URL(inputUrl)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

export function isSoundCloudUrl(inputUrl: string): boolean {
  try {
    const url = new URL(inputUrl)
    return isExactHostnameOrSubdomain(url.hostname, SOUNDCLOUD_HOST)
  } catch {
    return false
  }
}

export function getYoutubeVideoId(url: string): string | null {
  const regex =
    /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?|live)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
  const match = url.match(regex)
  return match ? match[1] : null
}

async function getSoundCloudUrl(shortLink: string): Promise<URL> {
  try {
    // Use pb.send() which automatically attaches the Auth token
    const result = await pb.send('/api/expand-soundcloud', {
      method: 'GET',
      params: { url: shortLink },
    })
    return new URL(result.long_url)
  } catch (apiError) {
    console.error('Could not retrieve SoundCloud URL:', apiError)
    try {
      // Fallback to creating a URL from the original short link
      return new URL(shortLink)
    } catch (parseError) {
      // If the short link is also invalid, re-throw the original API error
      // as it's the more relevant root cause.
      console.error('Could not parse SoundCloud URL:', parseError)
      throw apiError
    }
  }
}

export async function normalizeUrl(inputUrl: string): Promise<string> {
  try {
    const youtubeId = getYoutubeVideoId(inputUrl)
    if (youtubeId) return `https://www.youtube.com/watch?v=${youtubeId}`

    const url = new URL(inputUrl)
    if (!isSafeHttpUrl(inputUrl)) {
      return inputUrl.trim()
    }

    if (url.hostname === SOUNDCLOUD_SHORT_HOST) {
      const expandedUrl = await getSoundCloudUrl(inputUrl)
      return `${expandedUrl.origin}${expandedUrl.pathname}`
    }

    if (isExactHostnameOrSubdomain(url.hostname, SOUNDCLOUD_HOST)) {
      return `${url.origin}${url.pathname}`
    }
  } catch (error) {
    console.error('Could not normalize URL:', error)
    return inputUrl.trim()
  }
  return inputUrl.trim()
}

interface NoEmbedResponse {
  title?: string
  thumbnail_url?: string
  author_name?: string
  error?: string
}

export async function fetchMetadata(url: string) {
  const cleanUrl = await normalizeUrl(url)
  try {
    const response = await fetch(`https://noembed.com/embed?url=${encodeURIComponent(cleanUrl)}`)
    if (!response.ok) return null
    const data: NoEmbedResponse = await response.json()
    if (data.error) return null
    return {
      title: data.title as string | undefined,
      thumbnail: data.thumbnail_url as string | undefined,
      artist: data.author_name as string | undefined,
    }
  } catch (error) {
    console.error('Could not fetch metadata:', error)
    return null
  }
}

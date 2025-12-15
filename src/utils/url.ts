import pb from '../services/pocketbase'

export function getYoutubeVideoId(url: string): string | null {
  const regex =
    /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
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
  } catch (error) {
    console.error('Could not retrieve SoundCloud URL:', error)
    return new URL(shortLink)
  }
}

export async function normalizeUrl(inputUrl: string): Promise<string> {
  try {
    const youtubeId = getYoutubeVideoId(inputUrl)
    if (youtubeId) return `https://www.youtube.com/watch?v=${youtubeId}`

    if (inputUrl.includes('on.soundcloud.com')) {
      const urlObj = await getSoundCloudUrl(inputUrl)
      return `${urlObj.origin}${urlObj.pathname}`
    }

    if (inputUrl.includes('soundcloud.com')) {
      const urlObj = new URL(inputUrl)
      return `${urlObj.origin}${urlObj.pathname}`
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

export function getYoutubeVideoId(url: string): string | null {
  const regex =
    /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
  const match = url.match(regex)
  return match ? match[1] : null
}

export function normalizeUrl(inputUrl: string): string {
  try {
    const youtubeId = getYoutubeVideoId(inputUrl)
    if (youtubeId) return `https://www.youtube.com/watch?v=${youtubeId}`

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
  const cleanUrl = normalizeUrl(url)
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

import type { Favorite } from '../types/favorite'

export class FavoriteImportError extends Error {
  code: 'invalid_json' | 'invalid_array' | 'invalid_structure'

  constructor(message: string, code: FavoriteImportError['code']) {
    super(message)
    this.name = 'FavoriteImportError'
    this.code = code
  }
}

async function readFileText(file: File) {
  if (typeof file.text === 'function') {
    return await file.text()
  }

  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (event) => resolve(String(event.target?.result ?? ''))
    reader.onerror = () => reject(reader.error ?? new Error('Could not read file.'))
    reader.readAsText(file)
  })
}

export async function parseFavoritesImportFile(file: File): Promise<Favorite[]> {
  const rawContent = await readFileText(file)

  let parsedContent: unknown

  try {
    parsedContent = JSON.parse(rawContent)
  } catch {
    throw new FavoriteImportError('Invalid JSON.', 'invalid_json')
  }

  if (!Array.isArray(parsedContent)) {
    throw new FavoriteImportError('The JSON file is not a valid array.', 'invalid_array')
  }

  const hasInvalidEntry = parsedContent.some((item) => {
    if (!item || typeof item !== 'object') {
      return true
    }

    const candidate = item as Partial<Favorite>
    return typeof candidate.id !== 'string' || typeof candidate.url !== 'string'
  })

  if (hasInvalidEntry) {
    throw new FavoriteImportError('Invalid favorite structure.', 'invalid_structure')
  }

  return parsedContent as Favorite[]
}

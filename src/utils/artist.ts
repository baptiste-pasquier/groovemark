import type { Artist } from '../types/artist'

// Unicode "Combining Diacritical Marks" block (U+0300-U+036F).
const COMBINING_MARKS_REGEX = /[\u0300-\u036f]/g
const WHITESPACE_REGEX = /\s+/g

// Normalize a raw artist name into a slug per KTD4: NFD fold, strip diacritics,
// lowercase, trim, and collapse inner whitespace. Returns null when the name is
// empty once trimmed, so callers can reject it instead of matching on "".
export function normalizeArtistName(rawName: string): string | null {
  const slug = rawName
    .normalize('NFD')
    .replace(COMBINING_MARKS_REGEX, '')
    .toLowerCase()
    .trim()
    .replace(WHITESPACE_REGEX, ' ')

  return slug.length > 0 ? slug : null
}

// Count combining diacritical marks in the NFD form of a raw name, used to
// decide which spelling is "accented" for the KTD5 tie-break.
function countCombiningMarks(rawName: string): number {
  const marks = rawName.normalize('NFD').match(COMBINING_MARKS_REGEX)
  return marks ? marks.length : 0
}

// Pick the winning raw spelling among the candidates for a single artist,
// per KTD5: most frequent first, then most accented, then first by raw
// Unicode code point. The final tiebreak on the raw string makes this a
// total order, so the result does not depend on input order.
function pickWinningName(rawNames: string[]): string {
  const counts = new Map<string, number>()
  for (const rawName of rawNames) {
    counts.set(rawName, (counts.get(rawName) ?? 0) + 1)
  }

  const candidates = [...counts.entries()]
  candidates.sort(([nameA, countA], [nameB, countB]) => {
    if (countA !== countB) return countB - countA
    const marksA = countCombiningMarks(nameA)
    const marksB = countCombiningMarks(nameB)
    if (marksA !== marksB) return marksB - marksA
    return nameA < nameB ? -1 : nameA > nameB ? 1 : 0
  })

  return candidates[0][0]
}

// Elect a display name for each distinct artist in a population of raw names,
// per R13/KTD5. Names are grouped by normalized slug, and the winning
// spelling within each group is chosen by pickWinningName. Pure: takes the
// population as an argument and reaches for no external state. Names that
// normalize to null (empty once trimmed) are ignored.
export function electArtistDisplayNames(rawNames: string[]): Map<string, string> {
  const groups = new Map<string, string[]>()
  for (const rawName of rawNames) {
    const slug = normalizeArtistName(rawName)
    if (slug === null) continue
    const group = groups.get(slug)
    if (group) {
      group.push(rawName)
    } else {
      groups.set(slug, [rawName])
    }
  }

  const winners = new Map<string, string>()
  for (const [slug, group] of groups) {
    winners.set(slug, pickWinningName(group))
  }

  return winners
}

// Look up an artist by name in a supplied index (array or slug-keyed Map).
// The name is normalized internally, so callers can pass a raw name. Pure,
// no I/O: creating a missing artist is left to the caller.
export function findArtistByName(
  rawName: string,
  index: Artist[] | Map<string, Artist>,
): Artist | null {
  const slug = normalizeArtistName(rawName)
  if (slug === null) return null

  if (index instanceof Map) {
    return index.get(slug) ?? null
  }
  return index.find((artist) => artist.slug === slug) ?? null
}

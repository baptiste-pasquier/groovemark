import type { Verdict } from '../types/event'
import { isVerdict } from '../utils/event'
import type { Favorite } from '../types/favorite'

// One backup file carries both domains (R22), so this module owns the file's
// whole shape -- the envelope written on export and the one read back on
// import -- rather than only the mixes half its name comes from.

// The single format version an import recognizes. It is an integer written
// into the file and read straight back off it, so what the file *is* never has
// to be inferred from its shape (R22), and a file that does not declare it is
// refused whole rather than read partially (R23).
export const BACKUP_FORMAT_VERSION = 1

// One performance as the backup carries it: the artist is credited by display
// name and by nothing else. The stored row's `artistId` is an identity local to
// one account, so it is deliberately absent and the import resolves the name
// again on the target account (R24).
export interface BackupPerformance {
  artistName: string
  verdict: Verdict | null
}

// One event as the backup carries it. `id` travels so an operator can correlate
// rows by hand, and is ignored on import -- the restore mints its own, the same
// way a mix's `id` is not reused. The performance rows' own ids and `eventId`
// are internal identities and are absent.
export interface BackupEvent {
  id?: string
  name: string
  dateAttended: string
  venue: string
  performances: BackupPerformance[]
}

// One mix as the backup carries it: R12's pre-identity shape, artist names
// only (see buildFavoritesExportPayload).
export type BackupMix = Omit<Favorite, 'artistIds'>

// The whole backup file: an integer format version and one top-level key per
// domain (R22).
export interface BackupFile {
  formatVersion: number
  mixes: BackupMix[]
  events: BackupEvent[]
}

// What the parser hands back once the file is known to be a recognized
// envelope: one list per domain, each ready for the store's import pass.
export interface ParsedBackup {
  mixes: Favorite[]
  events: BackupEvent[]
}

export class FavoriteImportError extends Error {
  code: 'invalid_json' | 'unsupported_format' | 'invalid_array' | 'invalid_structure'

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

// The one gate the whole file passes through (R23). Keying the rejection on the
// declared version rather than on the payload's shape is what keeps the parser
// free of shape-sniffing: a bare array, a string, a null and an envelope
// carrying an unknown version are all simply undeclared, and none of their
// payloads is read.
function declaresRecognizedVersion(content: unknown): content is Record<string, unknown> {
  return (
    typeof content === 'object' &&
    content !== null &&
    !Array.isArray(content) &&
    (content as { formatVersion?: unknown }).formatVersion === BACKUP_FORMAT_VERSION
  )
}

// A domain key the envelope omits reads as empty rather than as an error: an
// older file brought forward by hand carries only `mixes`, and demanding an
// empty `events` alongside it would fail a file that is unambiguous.
function readDomainArray(envelope: Record<string, unknown>, key: 'mixes' | 'events'): unknown[] {
  const value = envelope[key]
  if (value === undefined || value === null) return []
  if (!Array.isArray(value)) {
    throw new FavoriteImportError(`The "${key}" key is not a valid array.`, 'invalid_array')
  }
  return value
}

function isInvalidMix(item: unknown): boolean {
  if (!item || typeof item !== 'object') {
    return true
  }

  const candidate = item as Partial<Favorite>
  return typeof candidate.id !== 'string' || typeof candidate.url !== 'string'
}

// The bare day is the repository interface's canonical form (KTD10), and both
// halves of this test earn their place. The shape test keeps local mode from
// storing a string the cloud's date field would have refused, which is what
// makes the two modes disagree about what a valid backup is; without it a
// 'soon' imports, then sorts above every real date and renders raw. The
// round-trip then refuses a day the calendar does not have -- '2026-02-30'
// matches the regex, and Date rolls it silently into '2026-03-02', so an
// operator's typo would land on a night that is not the one they meant.
function isValidDayAttended(value: unknown): boolean {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false
  }
  const parsed = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}

function isInvalidEvent(item: unknown): boolean {
  if (!item || typeof item !== 'object') {
    return true
  }

  const candidate = item as Partial<BackupEvent>
  if (typeof candidate.name !== 'string' || !isValidDayAttended(candidate.dateAttended)) {
    return true
  }
  if (candidate.performances !== undefined && !Array.isArray(candidate.performances)) {
    return true
  }

  return (candidate.performances ?? []).some(
    (performance) =>
      !performance ||
      typeof performance !== 'object' ||
      typeof (performance as Partial<BackupPerformance>).artistName !== 'string',
  )
}

// PocketBase's select field has no null and normalises an absent verdict to '',
// so a backup taken from a cloud account can carry either. Anything outside the
// four values reads as no verdict rather than leaking a value no surface can
// render -- the same rule the cloud repository applies at its own read boundary.
function toVerdict(value: unknown): Verdict | null {
  return isVerdict(value) ? value : null
}

function toBackupEvent(item: unknown): BackupEvent {
  const candidate = item as BackupEvent & { performances?: BackupPerformance[] }

  return {
    id: typeof candidate.id === 'string' ? candidate.id : undefined,
    name: candidate.name,
    dateAttended: candidate.dateAttended,
    venue: typeof candidate.venue === 'string' ? candidate.venue : '',
    performances: (candidate.performances ?? []).map((performance) => ({
      artistName: performance.artistName,
      verdict: toVerdict(performance.verdict),
    })),
  }
}

export async function parseBackupFile(file: File): Promise<ParsedBackup> {
  const rawContent = await readFileText(file)

  let parsedContent: unknown

  try {
    parsedContent = JSON.parse(rawContent)
  } catch {
    throw new FavoriteImportError('Invalid JSON.', 'invalid_json')
  }

  // The version is read before anything else, and nothing below runs until it
  // matches: no payload of an unrecognized shape is ever read partially (R23).
  if (!declaresRecognizedVersion(parsedContent)) {
    throw new FavoriteImportError(
      `Unrecognized backup format: expected a JSON object with "formatVersion": ${BACKUP_FORMAT_VERSION}, and "mixes", "events", or both.`,
      'unsupported_format',
    )
  }

  const mixes = readDomainArray(parsedContent, 'mixes')
  const events = readDomainArray(parsedContent, 'events')

  if (mixes.some(isInvalidMix)) {
    throw new FavoriteImportError('Invalid favorite structure.', 'invalid_structure')
  }

  if (events.some(isInvalidEvent)) {
    throw new FavoriteImportError('Invalid event structure.', 'invalid_structure')
  }

  return { mixes: mixes as Favorite[], events: events.map(toBackupEvent) }
}

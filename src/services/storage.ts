import type { AuthMode } from '../types/auth'

export const AUTH_MODE_KEY = 'groovemark_auth_mode'
export const LOCALE_STORAGE_KEY = 'groovemark_locale'
export const LEGACY_FAVORITES_STORAGE_KEY = 'favorites'
const LOCAL_FAVORITES_STORAGE_KEY = 'groovemark:favorites:local'
const LOCAL_ARTISTS_STORAGE_KEY = 'groovemark:artists:local'
const LOCAL_EVENTS_STORAGE_KEY = 'groovemark:events:local'

export function getStoredAuthMode(): AuthMode {
  try {
    const value = localStorage.getItem(AUTH_MODE_KEY)
    return value === 'google' || value === 'local' ? value : null
  } catch {
    return null
  }
}

export function setStoredAuthMode(mode: Exclude<AuthMode, null>) {
  try {
    localStorage.setItem(AUTH_MODE_KEY, mode)
  } catch (error) {
    console.error('Error storing auth mode:', error)
  }
}

export function clearStoredAuthMode() {
  try {
    localStorage.removeItem(AUTH_MODE_KEY)
  } catch (error) {
    console.error('Error clearing auth mode:', error)
  }
}

export function getStoredLocale(): string | null {
  try {
    return localStorage.getItem(LOCALE_STORAGE_KEY)
  } catch {
    return null
  }
}

export function setStoredLocale(locale: string) {
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, locale)
  } catch (error) {
    console.error('Error storing locale:', error)
  }
}

function getScopedStorageKey(
  authMode: Exclude<AuthMode, null>,
  userId: string | null | undefined,
  localKey: string,
  googlePrefix: string,
  entityLabel: string,
) {
  if (authMode === 'local') {
    return localKey
  }

  if (!userId) {
    throw new Error(`Google ${entityLabel} storage requires a user id.`)
  }

  return `${googlePrefix}:${userId}`
}

export function getFavoritesStorageKey(authMode: Exclude<AuthMode, null>, userId?: string | null) {
  return getScopedStorageKey(
    authMode,
    userId,
    LOCAL_FAVORITES_STORAGE_KEY,
    'groovemark:favorites:google',
    'favorites',
  )
}

export function getArtistsStorageKey(authMode: Exclude<AuthMode, null>, userId?: string | null) {
  return getScopedStorageKey(
    authMode,
    userId,
    LOCAL_ARTISTS_STORAGE_KEY,
    'groovemark:artists:google',
    'artists',
  )
}

export function getEventsStorageKey(authMode: Exclude<AuthMode, null>, userId?: string | null) {
  return getScopedStorageKey(
    authMode,
    userId,
    LOCAL_EVENTS_STORAGE_KEY,
    'groovemark:events:google',
    'events',
  )
}

export function readStorage<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

// Persist `value` and let a rejected write reach the caller. A store whose
// single key is rewritten whole on every save (KTD3) cannot treat a refused
// write as a log line: the record just typed would be gone while the save
// reported success. `writeStorage` keeps wrapping this in the swallow-and-log
// behaviour its existing callers rely on.
export function writeStorageOrThrow<T>(key: string, value: T) {
  localStorage.setItem(key, JSON.stringify(value))
}

export function writeStorage<T>(key: string, value: T) {
  try {
    writeStorageOrThrow(key, value)
  } catch (error) {
    console.error(`Error persisting storage key "${key}":`, error)
  }
}

export function removeStorage(key: string) {
  try {
    localStorage.removeItem(key)
  } catch (error) {
    console.error(`Error removing storage key "${key}":`, error)
  }
}

// Serializes read-modify-write cycles against one storage key. A repository
// that keeps a whole collection under a single key rewrites it in full on every
// save -- list, mutate, replace -- with no storage-level lock, so two saves
// racing between the read and the write would silently drop one writer's
// record. Chaining every write through one promise makes each wait for the
// previous to settle, whether it resolved or rejected.
export function createWriteQueue() {
  let queue: Promise<unknown> = Promise.resolve()

  return function enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const result = queue.then(operation, operation)
    queue = result.then(
      () => undefined,
      () => undefined,
    )
    return result
  }
}

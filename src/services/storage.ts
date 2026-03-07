import type { AuthMode } from '../types/auth'

export const AUTH_MODE_KEY = 'groovemark_auth_mode'
export const LOCALE_STORAGE_KEY = 'groovemark_locale'
export const LEGACY_FAVORITES_STORAGE_KEY = 'favorites'
const LOCAL_FAVORITES_STORAGE_KEY = 'groovemark:favorites:local'

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

export function getFavoritesStorageKey(authMode: Exclude<AuthMode, null>, userId?: string | null) {
  if (authMode === 'local') {
    return LOCAL_FAVORITES_STORAGE_KEY
  }

  if (!userId) {
    throw new Error('Google favorites storage requires a user id.')
  }

  return `groovemark:favorites:google:${userId}`
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

export function writeStorage<T>(key: string, value: T) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
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

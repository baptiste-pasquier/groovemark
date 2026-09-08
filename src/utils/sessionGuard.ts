import type { AuthMode } from '../types/auth'

export interface SessionContext {
  authMode: AuthMode
  userId?: string | null
}

function sessionKeyFor(context: SessionContext): string {
  return `${context.authMode ?? 'none'}:${context.userId ?? 'anonymous'}`
}

// Shared re-init guard for a store's `initializeForCurrentSession`: skip the
// reload when nothing changed (same auth session, already initialized, not
// forced), otherwise record the new session and let the caller proceed.
// Both useArtistsStore and useFavoritesStore had their own copy of this
// exact logic.
export function createSessionGuard() {
  let sessionKey = ''

  return {
    shouldSkip(context: SessionContext, initialized: boolean, force: boolean): boolean {
      const nextSessionKey = sessionKeyFor(context)
      if (initialized && !force && sessionKey === nextSessionKey) {
        return true
      }
      sessionKey = nextSessionKey
      return false
    },
    reset() {
      sessionKey = ''
    },
  }
}

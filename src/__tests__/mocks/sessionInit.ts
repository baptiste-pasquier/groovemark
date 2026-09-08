import { selectRepositories } from '../../services/favoritesRepository'
import type { SessionInitOptions } from '../../services/favoritesRepository'
import { useAuthStore } from '../../stores/auth'

// Builds the SessionInitOptions a store's initializeForCurrentSession now
// expects (a pre-computed repository selection), from the auth store state
// the test has already set up -- mirrors what stores/app.ts does for real.
export function sessionInit(
  backendAvailable: boolean,
  options: { force?: boolean } = {},
): SessionInitOptions {
  const authStore = useAuthStore()
  if (!authStore.authMode) {
    throw new Error('sessionInit() requires the auth store to have an authMode set already.')
  }
  return {
    selection: selectRepositories({
      authMode: authStore.authMode,
      userId: authStore.userId,
      backendAvailable,
    }),
    force: options.force,
  }
}

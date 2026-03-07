import i18n, { DEFAULT_LOCALE, SUPPORTED_LOCALES } from '../i18n'
import { getStoredLocale, setStoredLocale } from './storage'

type SupportedLocaleCode = (typeof SUPPORTED_LOCALES)[number]['code']

export function resolveInitialLocale(): SupportedLocaleCode {
  const storedLocale = getStoredLocale()
  if (storedLocale === 'en' || storedLocale === 'fr') {
    return storedLocale
  }

  const browserLocale =
    typeof navigator !== 'undefined'
      ? navigator.language || navigator.languages?.[0] || DEFAULT_LOCALE
      : DEFAULT_LOCALE
  const normalizedLocale: SupportedLocaleCode = browserLocale.toLowerCase().startsWith('fr')
    ? 'fr'
    : 'en'
  setStoredLocale(normalizedLocale)
  return normalizedLocale
}

export function initializeLocale() {
  i18n.global.locale.value = resolveInitialLocale() as never
}

export function updateLocale(locale: SupportedLocaleCode) {
  i18n.global.locale.value = locale as never
  setStoredLocale(locale)
}

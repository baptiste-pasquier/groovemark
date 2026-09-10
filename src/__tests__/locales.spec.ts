import { describe, it, expect } from 'vitest'
import en from '../i18n/locales/en.json'
import fr from '../i18n/locales/fr.json'

type Messages = { [key: string]: string | Messages }

function leafKeys(messages: Messages, prefix = ''): string[] {
  return Object.entries(messages).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key
    return typeof value === 'string' ? [path] : leafKeys(value, path)
  })
}

function missingFrom(reference: string[], candidate: string[]): string[] {
  const present = new Set(candidate)
  return reference.filter((key) => !present.has(key)).sort()
}

describe('Locale key parity', () => {
  it('carries the same leaf keys in both shipped locale files', () => {
    const enKeys = leafKeys(en as Messages)
    const frKeys = leafKeys(fr as Messages)

    expect({
      missingFromFr: missingFrom(enKeys, frKeys),
      missingFromEn: missingFrom(frKeys, enKeys),
    }).toEqual({ missingFromFr: [], missingFromEn: [] })
  })

  it('names the key and the file when a locale is missing one', () => {
    const complete: Messages = { app: { title: 'GrooveMark', tagline: 'Save your sets' } }
    const partial: Messages = { app: { title: 'GrooveMark' } }

    const completeKeys = leafKeys(complete)
    const partialKeys = leafKeys(partial)

    expect(missingFrom(completeKeys, partialKeys)).toEqual(['app.tagline'])
    expect(missingFrom(partialKeys, completeKeys)).toEqual([])
  })
})

import { vi } from 'vitest'

const storage: Record<string, string> = {}

export const localStorageMock: Storage = {
  getItem: vi.fn((key: string) => storage[key] ?? null),
  setItem: vi.fn((key: string, value: string) => {
    storage[key] = value
  }),
  removeItem: vi.fn((key: string) => {
    delete storage[key]
  }),
  clear: vi.fn(() => {
    Object.keys(storage).forEach((key) => delete storage[key])
  }),
  key: vi.fn((index: number) => Object.keys(storage)[index] ?? null),
  get length() {
    return Object.keys(storage).length
  },
}

Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  configurable: true,
})

export function resetLocalStorageMock() {
  localStorage.clear()
  vi.clearAllMocks()
}

export function getLocalStorageState() {
  return { ...storage }
}

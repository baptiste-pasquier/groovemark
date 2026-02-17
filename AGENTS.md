# AGENTS.md

Guidelines for AI coding agents working in the GrooveMark codebase.

## Project Overview

Vue 3 SPA (TypeScript, Composition API) for bookmarking music sets with timestamps.
Stack: Vue 3, Pinia v3, Tailwind CSS v4, PocketBase, vue-i18n, Vite 7.

## Build / Lint / Test Commands

```bash
# Development
npm run dev                          # Start dev server (port 5173)

# Build
npm run build                        # Type-check + Vite build (parallel)
npm run build-only                   # Vite build without type-check

# Type checking
npm run type-check                   # vue-tsc --build

# Linting and formatting
npm run lint                         # ESLint with --fix
npm run format                       # Prettier --write

# Unit tests (Vitest, jsdom environment)
npm run test:unit                    # Watch mode
npm run test:unit -- run             # Single run (CI)
npx vitest run src/__tests__/auth.spec.ts          # Run a single test file
npx vitest run -t "test name"                      # Run a single test by name

# E2E tests (Playwright)
npm run test:e2e                     # Run all E2E tests
npx playwright test e2e/vue.spec.ts  # Run a single E2E test file
```

### CI Pipeline (what runs on PR)

1. `vue-tsc --build` (type-check)
2. `prettier --check .` (formatting check -- no auto-fix)
3. `eslint .` (lint check -- no auto-fix)
4. `vitest run` (unit tests)
5. Playwright tests (separate workflow, skipped on draft PRs)

### Pre-commit Hook (Husky + lint-staged)

- `*.{ts,tsx,vue}` files: `eslint --cache --fix`
- All files: `prettier --write --ignore-unknown`

## Code Style

### Formatting (Prettier)

- **No semicolons** (`semi: false`)
- **Single quotes** (`singleQuote: true`)
- **100 character line width**
- Trailing commas: ES5 default (objects, arrays)
- 2-space indentation
- Tailwind class sorting via `prettier-plugin-tailwindcss`
- LF line endings enforced (`.gitattributes`)

### Imports

Order imports as follows:

1. Vue/framework (`vue`, `pinia`, `vue-i18n`)
2. Third-party libraries (`pocketbase`, `lucide-vue-next`, `@vueuse/core`)
3. Local components (`.vue` files)
4. Local stores, services, types, utils
5. Side-effect imports (CSS) last

```ts
import { ref, computed } from 'vue'
import { useFavoritesStore } from '../stores/favorites'
import type { Favorite } from '../types/favorite'
```

- Use **relative paths** (`../`, `./`). The `@/` alias is configured but not used.
- Use `import type` for type-only imports.
- Named imports by default; default imports only for `.vue` components and singleton modules.
- No barrel files / index re-exports.

### TypeScript

- Strict mode enabled (via `@vue/tsconfig/tsconfig.dom.json`).
- Use `interface` for object shapes, `type` for unions/aliases.
- Avoid `any` -- use proper typing or generics.
- Use `as` assertions sparingly, only for DOM APIs or localStorage casts.
- Use generics with PocketBase SDK: `pb.collection('x').getFullList<MyType>()`.
- Use TypeScript utility types (`Omit`, `Partial`, `Record`) where appropriate.

```ts
export interface Timestamp {
  time: string
  label: string
}
export type AuthMode = 'google' | 'local' | null
```

### Naming Conventions

| Entity                | Convention       | Example                      |
| --------------------- | ---------------- | ---------------------------- |
| Variables, functions  | camelCase        | `isMenuOpen`, `handleImport` |
| String constants      | UPPER_SNAKE_CASE | `AUTH_MODE_KEY`              |
| Types, interfaces     | PascalCase       | `Favorite`, `AuthMode`       |
| Vue components (file) | PascalCase       | `FavoriteCard.vue`           |
| TS files              | camelCase        | `favorites.ts`, `url.ts`     |
| Pinia stores          | `use[Name]Store` | `useFavoritesStore`          |
| Test files            | `[name].spec.ts` | `auth.spec.ts`               |
| Event emits           | camelCase        | `'update:modelValue'`        |

### Vue Components

- Always use `<script setup lang="ts">` with Composition API. No Options API.
- Section order: `<script setup>` -> `<template>` -> `<style scoped>` (optional).
- Props via `defineProps<T>()` with TypeScript generics (no runtime validation).
- Emits via `defineEmits<T>()` with call-signature syntax.
- Use `v-model` pattern (`modelValue` prop + `update:modelValue` emit).
- Style with Tailwind utility classes only -- avoid scoped CSS unless needed for animations.
- Icons from `lucide-vue-next` as named Vue component imports.
- i18n via `const { t } = useI18n()` composable.

### Functions

- Use `function` declarations for named component/store methods.
- Use arrow functions only for callbacks (`.map`, `.filter`), computed bodies, watchers, and inline template handlers.

```ts
// Named function declaration
function addFavorite() {
  /* ... */
}

// Arrow only for callbacks
favorites.value.filter((f) => f.id !== id)
const allArtists = computed(() => {
  /* ... */
})
```

### Error Handling

- Wrap async operations in `try/catch`; log with `console.error`.
- Return safe defaults on failure (empty arrays, `null`).
- Use `instanceof Error` guard before accessing `.message`.
- Use the store's `showAlert()` / `showConfirm()` for user-facing errors.
- Empty `catch {}` is acceptable only for non-critical operations (e.g., localStorage parsing).
- Use `finally` blocks for cleanup (e.g., `isLoading = false`).

### Pinia Stores

- Use Setup Store syntax: `defineStore('name', () => { ... })`.
- State via `ref()` or `reactive()` with `toRefs()`.
- Computed properties via `computed()`.
- Reset state via `Object.assign(state, initialState())` factory pattern.
- Cross-store access by calling `useOtherStore()` inside the store function.

### Exports

- Named exports for stores, types, services, and utility functions.
- Default exports only for singleton instances (`pb`, `i18n`) and Vite/ESLint configs.

## Project Structure

```
src/
  __tests__/           # Unit tests (centralized, not co-located)
    mocks/             # Test mocks (e.g., PocketBase mock)
  components/          # Vue components by feature domain
    auth/              # Authentication UI
    favorites/         # Favorite cards, grid, search, add button
    filters/           # Artist sidebar and list
    layout/            # Header bar
    modals/            # Dialogs (alert, confirm, favorite edit)
  i18n/locales/        # en.json, fr.json
  services/            # PocketBase client and CRUD service
  stores/              # Pinia stores (auth, favorites)
  types/               # TypeScript interfaces
  utils/               # Pure utility functions (URL, time parsing)
```

## Copilot Instructions

From `.github/copilot-instructions.md`:

> Always use Context7 MCP tools to resolve library IDs and get library docs
> automatically for code generation, setup, configuration, and API documentation.

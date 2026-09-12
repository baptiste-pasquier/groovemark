# AGENTS.md

Guidelines for AI coding agents working in the GrooveMark codebase.

## Project Overview

Vue 3 SPA (TypeScript, Composition API) for bookmarking music sets with timestamps.
Stack: Vue 3, Pinia v3, Tailwind CSS v4, PocketBase, vue-i18n, Vite 7.

### Current Architecture

- App bootstrap is centralized:
  - `useAppStore` resolves auth, backend availability, and boot state
  - `initializeLocale()` runs from `src/main.ts` before mount
- State is split by responsibility:
  - `useFavoritesStore` owns favorites domain data and persistence flows
  - `useFavoritesUiStore` owns search, sort, filters, and dialog state
  - `useAuthStore` owns auth mode and PocketBase session state
  - `useArtistsStore` owns artist identity: load, resolve-or-create, cache mirror
  - `useEventsStore` owns events domain data and the per-artist performance views
  - `useEventsUiStore` owns the events tab's search
  - `useArtistsUiStore` owns slug lookup and the artists table's sort, search and column descriptor
- The read-only switch is `useAppStore.isReadOnly`, derived over every domain's load-failure flag
  and every domain's effective post-fallback mode. `useFavoritesStore.isReadOnly` is a
  pass-through. Do not push a read-only flag from a domain store, and do not add a second switch
- Persistence is repository-based:
  - `PocketBaseFavoritesRepository` for authenticated online sessions
  - `LocalFavoritesRepository` for local mode and authenticated offline cache
  - `PocketBaseArtistsRepository` / `LocalArtistsRepository` mirror the same split for artist identity
  - `PocketBaseEventsRepository` / `LocalEventsRepository` do the same for events, and the
    interface speaks in whole events -- no caller ever assembles a performance row
  - `selectRepositories()` returns a favorites, an artists and an events repository pair under one
    mode, from a single call; `useAppStore` calls it once per session and hands the same selection
    to all three domain stores
- Navigation is `vue-router` 4, HTML5 history with the base the build injects:
  - three destinations (`mixes`, `events`, `artists`) plus an artist page keyed on the artist's slug
  - build an artist address from the named route and a `slug` param, never by concatenation -- a
    slug is a folded display name and can carry a slash
  - the boot state machine stays the outer gate: `booting` and `unauthenticated` short-circuit
    before any route renders
- Responsive layout is token-based:
  - Layout sizing tokens live in `src/assets/tailwind.css`
  - Semantic layout classes such as `.app-shell`, `.favorites-header`, and `.card-grid`
    are the source of truth for the card destinations. `.card-grid` carries the column
    progression the mixes and events grids share; each grid keeps its own element id
  - See `docs/conventions/frontend-layout.md` before changing layout tokens or templates
- localStorage keys are intentionally scoped:
  - `groovemark:favorites:local`
  - `groovemark:favorites:google:<userId>`
  - `groovemark:artists:local`
  - `groovemark:artists:google:<userId>`
  - `groovemark:events:local`
  - `groovemark:events:google:<userId>`
  - Events are stored whole, performances nested; a line-up is never a key of its own
  - Do not reintroduce a shared `favorites` key

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
npm run format                       # Prettier . --write

# Unit tests (Vitest, jsdom environment)
npm run test:unit                    # Watch mode
npm run test:unit -- run             # Single run (CI)
npx vitest run src/__tests__/auth.spec.ts          # Run a single test file
npx vitest run -t "test name"                      # Run a single test by name

# E2E tests (Playwright)
npm run test:e2e                     # Run all E2E tests
npx playwright test e2e/vue.spec.ts  # Run a single E2E test file
npm run test:demo                    # Regenerate the committed README demo GIF
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
- Use `useFavoritesUiStore().showAlert()` / `showConfirm()` for user-facing errors.
- Empty `catch {}` is acceptable only for non-critical operations (e.g., localStorage parsing).
- Use `finally` blocks for cleanup (e.g., `isLoading = false`).

### Pinia Stores

- Use Setup Store syntax: `defineStore('name', () => { ... })`.
- State via `ref()` by default; use `reactive()` only when it materially simplifies grouped state.
- Computed properties via `computed()`.
- Setup stores should expose an explicit `$reset()` when they need reset behavior.
- Cross-store access by calling `useOtherStore()` inside the store function.

#### Store Responsibilities

- `useAppStore`: bootstrapping (`booting | unauthenticated | ready`, backend availability), the one repository selection handed to every domain store, and the one read-only switch
- `useFavoritesStore`: favorites CRUD, backup import/export, cache sync
- `useFavoritesUiStore`: filtered lists, sort/filter/search state, per-artist mix aggregates, alert/confirm dialogs
- `useArtistsStore`: artist identity load, resolve-or-create, cache mirror
- `useEventsStore`: events load, whole-event save, delete, the events half of an import, and the per-artist performance views and aggregates
- `useEventsUiStore`: the events tab's search, its sort direction and its filtered list
- `useArtistsUiStore`: slug lookup for the artist address, and the artists table's rows, sort, search and column descriptor
- `useArtistsStore` and `useEventsStore` load from bootstrap independently of `useFavoritesStore`; do not load either from inside another domain store
- Each destination keeps its own search state; do not share a search ref between two destinations
- Leaving a destination clears that destination's search, through the single `router.afterEach`
  guard in `src/router/index.ts` -- not an unmount hook in each view. A search box is uncontrolled
  while its term lives in an app-scoped store, so without this a returning view shows an empty box
  over a filtered list. Only the search is cleared: the artists sort and the mixes artist filter
  stay visible in their own controls, so neither can lie about what is filtering
- A per-artist number is read from the store that owns it (`useEventsStore` for the live half, `useFavoritesUiStore` for the mixes half); do not re-derive one in a component or in the artists-UI store
- Do not move dialog state back into `useFavoritesStore`
- Do not put locale initialization inside view components; keep it in services/bootstrap

### Exports

- Named exports for stores, types, services, and utility functions.
- Default exports only for singleton instances (`pb`, `i18n`) and Vite/ESLint configs.

## Project Structure

```
src/
  __tests__/           # Unit tests (centralized, not co-located)
    mocks/             # Test mocks (e.g., PocketBase mock)
  components/          # Vue components by feature domain
    artists/           # Artist page, artists table and its view
    auth/              # Authentication UI
    events/            # Event cards, grid, search, verdict badge and picker
    favorites/         # Favorite cards, grid, search, add button, mixes view
    filters/           # Artist sidebar and list
    layout/            # Header bar and destination switcher
    modals/            # Dialogs (alert, confirm, favorite edit, event edit)
  i18n/locales/        # en.json, fr.json
  router/              # Route table (destinations and the artist address)
  services/            # PocketBase client, repositories, storage/locale/backup helpers
  stores/              # Pinia stores (app, artists, artistsUi, auth, events, eventsUi, favorites, favoritesUi)
  types/               # TypeScript interfaces and shared app/auth aliases
  assets/              # Global CSS (Tailwind base)
  utils/               # Pure utility functions (URL, favorite, artist, event helpers)
```

### Storage and PocketBase Rules

- The `favorites` collection should be treated as user-owned data.
- Client assumptions rely on an `owner` relation field and user-scoped API rules:
  - `@request.auth.id != "" && owner = @request.auth.id` for list/view/update/delete
- The `artists` collection follows the same owner-scoped pattern (`owner` relation, list/view/update/delete rule, plus a create-owner guard), with a unique index on `(owner, slug)`.
- The `events` and `performances` collections follow that same owner-scoped pattern. Two additions are load bearing:
  - `performances.eventId` cascades on delete and `performances.artistId` does not -- a line-up dies with its night, an artist outlives its performances
  - the `performances` create and update rules also correlate each submitted relation id with the caller, so a row cannot reference another account's event or artist
- Saving an event uses `/api/batch`, which a settings migration enables; the client mirrors its two bounds in `src/utils/event.ts`. Keep the migration and those constants in step.
- Read a line-up with `sort: 'position,created,id'` -- rows written in one batch share a `created` timestamp. Restamp `position` on every row of every save.
- One rule decides which local write reports a refusal, and both halves are load bearing. A write
  the caller must act on **throws** (`writeStorageOrThrow`, as the events and artists repositories
  do): the storage key is rewritten whole, so a refused write discards the record just created and
  a silent success makes it vanish on the next load. A redundant **mirror** of data already saved
  elsewhere swallows and logs, and never sits inside the `try` that decides whether a load
  succeeded -- otherwise a device that cannot cache turns a healthy session read-only. The
  favorites repository still swallows on its primary path; that is a known gap, not a pattern to
  copy.
- Authenticated offline fallback uses the user-scoped local cache, not local-mode storage.
- A backup file is one versioned envelope (`{ formatVersion, mixes, events }`); an import refuses anything that does not declare a version it knows, and no relation id is ever exported.
- If updating import/export or migration behavior, preserve separation between:
  - local mode data
  - authenticated user cache

## Docker

- Version pins for Docker images (e.g., PocketBase version) live in the Dockerfile `ARG` defaults, not in the GitHub Actions workflow.
- Do not duplicate version numbers in `docker-build.yml` `build-args` -- the Dockerfile is the single source of truth.

## Coding Guidance

- Always use Context7 when I need library/API documentation, code generation, setup or configuration steps without me having to explicitly ask.

## Documentation

`docs/` has one topology and one routing rule. **Read [`docs/README.md`](docs/README.md)
before creating or substantially extending anything under `docs/`.** Full rules:
[`docs/conventions/documentation.md`](docs/conventions/documentation.md).

### Where a paragraph goes

Two axes. **Lifecycle first**: `docs/explanation/`, `docs/how-to/`, `docs/reference/`, and
`docs/conventions/` are _maintained_ and are the sources of truth; `docs/journal/` is
_append-only_, dated, and **never cited as truth**. Then, for maintained text, the
[Diátaxis](https://diataxis.fr/compass/) compass -- run it on **the paragraph**, not on the
file you have open.

| The content…          | …serves the reader…              | …belongs in                                   |
| --------------------- | -------------------------------- | --------------------------------------------- |
| informs **action**    | **applying** a skill (working)   | `docs/how-to/`                                |
| informs **action**    | **acquiring** a skill (studying) | a tutorial -- we have none, so `docs/how-to/` |
| informs **cognition** | **applying** a skill (working)   | `docs/reference/`                             |
| informs **cognition** | **acquiring** a skill (studying) | `docs/explanation/`                           |

Four extensions, for text that is not about the product:

| The paragraph…                                   | belongs in                |
| ------------------------------------------------ | ------------------------- |
| tells a future writer or agent what to do        | `docs/conventions/`       |
| recounts what was tried, failed, or was measured | `docs/journal/solutions/` |
| records a choice between options                 | `docs/journal/decisions/` |
| names something not built yet                    | a GitHub issue            |

A maintained doc states the rule **once** and links the journal entry for the evidence. It
does not retell the story.

### Where a plugin's artifacts go

Every dated artifact a plugin writes is a journal entry. **The paths below override the ones
the plugins' own skills name** -- an instruction in this file takes precedence over a skill's.

| Running                               | Do not write to           | Write to                                                                      |
| ------------------------------------- | ------------------------- | ----------------------------------------------------------------------------- |
| `superpowers:brainstorming`           | `docs/superpowers/specs/` | `docs/journal/specs/`                                                         |
| `superpowers:writing-plans`           | `docs/superpowers/plans/` | `docs/journal/plans/`                                                         |
| a compound-engineering artifact skill | `docs/<artifact-name>/`   | under `docs/journal/`, per `docs_root` in `.compound-engineering/config.yaml` |

**Only the directory changes.** Keep the plugin's own filename
(`YYYY-MM-DD-<topic>-design.md`) and its own frontmatter -- impose a second schema and the
plugin keeps writing its own anyway. The gate asks a journal entry for no frontmatter at all,
and it fails `docs/superpowers/` as an unknown folder, so the redirect is binding rather than
advisory.

**In a plan or a spec, cite a repo file as a backticked path, not a markdown link**, unless
the path resolves from the artifact's own folder. The link check reads journal entries too,
and a plugin writes those links relative to whatever directory the plan is about, which
resolves from nowhere under `docs/journal/plans/`. A plan names its spec as
`../specs/<file>.md`, never as an absolute `docs/...` link.

A plan or a spec is a dated record of intent, so the no-backlog rule below does not reach it:
a plan's own `Open Questions` section stays where the plugin wrote it.

### Rules that are enforced

`scripts/check_docs.py` runs in the Husky pre-commit hook (when a staged file is under
`docs/`) and as its own step in CI (`npm run check:docs`). It needs only a `python3`
interpreter -- no pip dependency. These fail:

- **Never narrate a past attempt, failure, or measured symptom in `docs/reference/`,
  `docs/conventions/` or `docs/how-to/`.** Write a `docs/journal/solutions/` entry and leave
  the distilled rule with a link. `docs/explanation/` **may** narrate, so the gate **warns**
  there rather than failing. `docs/journal/` is exempt.
- **Never add a backlog, TODO or "future work" section to a maintained doc.** Unbuilt work
  lives in the issue tracker and nowhere else -- `gh issue list --label backlog` to read it,
  `gh issue create --label backlog` to add an item, and **link the issue** rather than
  describing the missing work. A `TODO` comment in a source file is fine, and a doc may point
  at one. `docs/journal/` is exempt, so a plan's own `Open Questions` section stays where the
  plugin wrote it.
- **Every maintained doc carries frontmatter** with `title`, `type` (equal to its folder
  name), `audience`, `status`, `stale_after`, and appears in `docs/README.md`. A passed
  `stale_after` **warns** rather than fails.
- **Every `docs/conventions/` file opens with a `Scope:` line** naming the artifact it
  governs.
- **Every relative link and every `#fragment` resolves.**
- **Filenames are kebab-case**, and a `docs/journal/decisions/` entry is
  `NNNN-with-dashes.md`.

### Rules that are reviewed, not gated

- **Before implementing a fix or a non-obvious behaviour change, check
  `docs/journal/solutions/`** for an entry in the relevant area.
- **Record a lasting architectural choice as an ADR** under `docs/journal/decisions/`. An
  accepted decision is never edited -- a change adds a new entry marking the old superseded.
- **Documentation prose**: lead with the conclusion; one claim per paragraph; no filler or
  hedging; prefer a table to enumerative prose.

### What to update when

| You changed                                                 | Update                                |
| ----------------------------------------------------------- | ------------------------------------- |
| the PocketBase schema or API rules                          | `docs/reference/pocketbase-schema.md` |
| app bootstrap, persistence, or state-store responsibilities | `docs/explanation/architecture.md`    |
| the favorites layout tokens or breakpoints                  | `docs/reference/responsive-layout.md` |
| local dev, Docker, or auth setup steps                      | the matching `docs/how-to/*.md`       |
| user-facing behaviour, setup, local workflow                | `README.md`                           |
| what an agent must always know                              | this file                             |
| notable project changes                                     | `CHANGELOG.md`                        |

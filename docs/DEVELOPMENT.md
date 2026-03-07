# Development Guide

This guide covers local setup, day-to-day commands, and editor tooling for GrooveMark.

## Prerequisites

- Node.js `^24.0.0`
- npm
- PocketBase if you want to test authenticated sync locally
- Docker optionally, if you prefer running PocketBase in a container

## Project Setup

Install dependencies from the repository root:

```sh
npm install
```

## Running the App Locally

Start the frontend:

```sh
npm run dev
```

The Vite dev server runs on `http://localhost:5173` by default.

If you want to test the authenticated PocketBase flow, start PocketBase separately:

```sh
./pocketbase serve
```

Or with Docker:

```sh
cd docker
docker-compose up pocketbase -d
```

See [PocketBase Setup](./POCKETBASE_SETUP.md) for collection and auth configuration.

## Build and Type Check

Build with type-checking:

```sh
npm run build
```

Build without type-checking:

```sh
npm run build-only
```

Run type-checking only:

```sh
npm run type-check
```

## Testing

Run unit tests in watch mode:

```sh
npm run test:unit
```

Run unit tests once:

```sh
npm run test:unit -- run
```

Run a single unit test file:

```sh
npx vitest run src/__tests__/auth.spec.ts
```

Run a specific unit test by name:

```sh
npx vitest run -t "test name"
```

Install Playwright browsers the first time:

```sh
npx playwright install
```

Run end-to-end tests:

```sh
npm run test:e2e
```

Run a single Playwright test file:

```sh
npx playwright test e2e/vue.spec.ts
```

Common Playwright variants:

```sh
npm run test:e2e -- --project=chromium
npm run test:e2e -- --debug
```

## Linting and Formatting

Lint and auto-fix:

```sh
npm run lint
```

Format the repository:

```sh
npm run format
```

## Recommended IDE Setup

[VSCode](https://code.visualstudio.com/) +
[Volar](https://marketplace.visualstudio.com/items?itemName=Vue.volar)
(and disable Vetur).

## Type Support for `.vue` Imports in TS

TypeScript cannot handle type information for `.vue` imports by default, so the project
uses `vue-tsc` for type-checking. In editors, use Volar so the TypeScript language
service understands Vue single-file components.

## Customize Configuration

See the [Vite Configuration Reference](https://vite.dev/config/).

# mixstach

MixStash is a Vue 3 application for saving your favorite music sets with precise timestamps, now powered by Pocketbase for data storage.

## Features

- Save favorite YouTube and SoundCloud mixes
- Add timestamps to mark important parts of your mixes
- Filter by artists
- Search functionality
- Import/Export favorites as JSON
- Pocketbase integration with localStorage fallback for offline support

## Recommended IDE Setup

[VSCode](https://code.visualstudio.com/) + [Volar](https://marketplace.visualstudio.com/items?itemName=Vue.volar) (and disable Vetur).

## Type Support for `.vue` Imports in TS

TypeScript cannot handle type information for `.vue` imports by default, so we replace the `tsc` CLI with `vue-tsc` for type checking. In editors, we need [Volar](https://marketplace.visualstudio.com/items?itemName=Vue.volar) to make the TypeScript language service aware of `.vue` types.

## Pocketbase Setup

This application uses [Pocketbase](https://pocketbase.io/) as a backend for storing favorites.

### 1. Install Pocketbase

Download Pocketbase from [pocketbase.io/docs](https://pocketbase.io/docs/) for your operating system.

### 2. Start Pocketbase

```sh
# Extract the downloaded file and run
./pocketbase serve
```

By default, Pocketbase runs on `http://localhost:8090`.

### 3. Configure the Collection

1. Open the Pocketbase admin UI at `http://localhost:8090/_/`
2. Create a new collection named `favorites`
3. Add the following fields:
   - `url` (Text, required)
   - `title` (Text, required)
   - `artists` (JSON, optional) - for storing array of artist names
   - `type` (Text, required) - either "youtube" or "soundcloud"
   - `thumbnail` (Text, optional)
   - `timestamps` (JSON, optional) - for storing array of timestamp objects

### 4. Configure API Rules (Optional)

For development, you can allow public access to the `favorites` collection:
- List/Search Rule: `@request.auth.id != ""`
- View Rule: `@request.auth.id != ""`
- Create Rule: `@request.auth.id != ""`
- Update Rule: `@request.auth.id != ""`
- Delete Rule: `@request.auth.id != ""`

For production, implement proper authentication.

### 5. Environment Configuration

Copy `.env.example` to `.env` and update the Pocketbase URL if needed:

```sh
cp .env.example .env
```

Default configuration:
```
VITE_POCKETBASE_URL=http://localhost:8090
```

### Fallback to localStorage

If Pocketbase is not available, the application automatically falls back to using localStorage for data persistence. This provides offline support and ensures the app works even without a backend connection.

## Customize configuration

See [Vite Configuration Reference](https://vite.dev/config/).

## Project Setup

```sh
npm install
```

### Compile and Hot-Reload for Development

```sh
npm run dev
```

### Type-Check, Compile and Minify for Production

```sh
npm run build
```

### Run Unit Tests with [Vitest](https://vitest.dev/)

```sh
npm run test:unit
```

### Run End-to-End Tests with [Playwright](https://playwright.dev)

```sh
# Install browsers for the first run
npx playwright install

# When testing on CI, must build the project first
npm run build

# Runs the end-to-end tests
npm run test:e2e
# Runs the tests only on Chromium
npm run test:e2e -- --project=chromium
# Runs the tests of a specific file
npm run test:e2e -- tests/example.spec.ts
# Runs the tests in debug mode
npm run test:e2e -- --debug
```

### Lint with [ESLint](https://eslint.org/)

```sh
npm run lint
```

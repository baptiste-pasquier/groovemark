# GrooveMark <!-- omit from toc -->

GrooveMark is a Vue 3 application for saving your favorite music sets with precise timestamps, now powered by Pocketbase for data storage.

- [Features](#features)
- [Documentation](#documentation)
- [Docker Deployment](#docker-deployment)
  - [Quick Start with Docker Compose](#quick-start-with-docker-compose)
  - [Using Pre-built Images](#using-pre-built-images)
  - [Building Images Locally](#building-images-locally)
  - [Environment Variables](#environment-variables)
- [Recommended IDE Setup](#recommended-ide-setup)
- [Type Support for `.vue` Imports in TS](#type-support-for-vue-imports-in-ts)
- [Pocketbase Setup](#pocketbase-setup)
  - [1. Install Pocketbase](#1-install-pocketbase)
  - [2. Start Pocketbase](#2-start-pocketbase)
  - [3. Configure the Collection](#3-configure-the-collection)
  - [4. Configure API Rules (Optional)](#4-configure-api-rules-optional)
  - [5. Environment Configuration](#5-environment-configuration)
  - [Fallback to localStorage](#fallback-to-localstorage)
- [Customize configuration](#customize-configuration)
- [Project Setup](#project-setup)
  - [Compile and Hot-Reload for Development](#compile-and-hot-reload-for-development)
  - [Type-Check, Compile and Minify for Production](#type-check-compile-and-minify-for-production)
  - [Run Unit Tests with Vitest](#run-unit-tests-with-vitest)
  - [Run End-to-End Tests with Playwright](#run-end-to-end-tests-with-playwright)
  - [Lint with ESLint](#lint-with-eslint)


## Features

- Save favorite YouTube and SoundCloud mixes
- Add timestamps to mark important parts of your mixes
- Filter by artists
- Search functionality
- Import/Export favorites as JSON
- Pocketbase integration with localStorage fallback for offline support
- Docker deployment ready with CI/CD support

## Documentation

For detailed documentation, see the [`docs/`](./docs) folder:

- **[Docker Deployment Guide](./docs/DOCKER.md)** - Comprehensive guide for Docker deployment, production setup, troubleshooting, and CI/CD
- **[Pocketbase Schema](./docs/POCKETBASE_SCHEMA.md)** - Database schema and collection configuration details

## Docker Deployment

GrooveMark can be easily deployed using Docker and Docker Compose, with both the application and Pocketbase backend running in containers.

### Quick Start with Docker Compose

The easiest way to run GrooveMark with Docker:

```bash
# Clone the repository
git clone https://github.com/baptiste-pasquier/groovemark.git
cd groovemark/docker

# Start both services
docker-compose up -d

# Access the application
# App: http://localhost:8080
# Pocketbase admin: http://localhost:8090/_/
```

The application will be available at `http://localhost:8080` and Pocketbase at `http://localhost:8090`.

### Using Pre-built Images

Pre-built images are automatically published to GitHub Container Registry on every release:

```bash
# Navigate to docker folder
cd groovemark/docker

# Run with docker-compose using remote images
docker-compose -f docker-compose.prod.yml up -d
```

Available image tags:
- `latest` - Latest stable version from main branch
- `develop` - Latest development version
- `v*` - Specific version tags (e.g., `v1.0.0`)
- `<branch>-<sha>` - Specific commit builds

### Building Images Locally

Build the Docker images yourself:

```bash
# From the repository root
# Build the Vue app
docker build -t groovemark-app -f docker/Dockerfile .

# Build Pocketbase with default version
docker build -t groovemark-pocketbase -f docker/Dockerfile.pocketbase .

# Build Pocketbase with specific version
docker build --build-arg PB_VERSION=0.34.2 -t groovemark-pocketbase -f docker/Dockerfile.pocketbase .

# Run with your local images
cd docker
docker-compose up -d
```

### Environment Variables

Configure the application using environment variables:

**For the Vue App:**
- `VITE_POCKETBASE_URL` - URL where Pocketbase is accessible (default: `http://localhost:8090`)

**Important:** The `VITE_POCKETBASE_URL` is embedded into the application **at build time**, not at runtime. This means:
- For local development with Docker Compose, set this in a `.env` file before building
- For production deployments, set this environment variable before building the Docker image
- You need to rebuild the Docker image if you want to change the Pocketbase URL

Example `.env` file in the `docker/` directory:
```bash
VITE_POCKETBASE_URL=http://pocketbase:8090
```

For production deployments with a custom domain:
```bash
# Set before building
VITE_POCKETBASE_URL=https://api.yourdomain.com docker-compose build app
```

**Data Persistence:**

Pocketbase data is persisted using Docker volumes. The `pocketbase_data` volume stores:
- Database files
- User uploads
- Configuration

To backup your data:
```bash
# Create a backup
docker-compose exec pocketbase tar czf /tmp/backup.tar.gz /pb/pb_data
docker cp groovemark-pocketbase:/tmp/backup.tar.gz ./pocketbase-backup.tar.gz
```

To restore from backup:
```bash
# Stop services
docker-compose down

# Remove old volume
docker volume rm groovemark_pocketbase_data

# Start services
docker-compose up -d

# Restore data
docker cp ./pocketbase-backup.tar.gz groovemark-pocketbase:/tmp/backup.tar.gz
docker-compose exec pocketbase tar xzf /tmp/backup.tar.gz -C /
docker-compose restart pocketbase
```

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
   - `url` (URL, required)
   - `title` (Text, required)
   - `artists` (JSON, optional) - for storing array of artist names
   - `type` (Text, required) - either "youtube" or "soundcloud"
   - `thumbnail` (URL, optional)
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

<p align="center">
  <img src="public/icon.svg" alt="GrooveMark Logo" width="120" height="120" />
</p>

# GrooveMark <!-- omit from toc -->

GrooveMark is a modern music bookmarking application. It allows you to save and organize your favorite YouTube and SoundCloud mixes with precise timestamps.

- [Features](#features)
- [Architecture](#architecture)
- [Technologies](#technologies)
- [Documentation](#documentation)
- [Quick Start](#quick-start)
  - [Docker](#docker)
  - [Local Development](#local-development)

## Features

- 🎵 **Save Mixes**: Save favorite YouTube and SoundCloud mixes
- ⏱️ **Timestamps**: Add timestamps to mark important parts of your mixes
- 🏷️ **Artist Filtering**: Organize your collection by artists
- 🔍 **Search**: Quickly find specific mixes
- 🔐 **Authentication**: Sign in with Google SSO or continue in local mode (no account needed)
- ☁️ **Cloud Sync**: When using Google SSO, favorites sync across devices via PocketBase
- 🔌 **Offline Support**: Local mode stores data in browser localStorage
- 💾 **Import/Export**: Backup and restore favorites as JSON

## Architecture

GrooveMark is built as a modern Single Page Application (SPA) with a Backend-as-a-Service (BaaS) architecture.

- **Frontend**: A Vue 3 application that handles the UI, state management, and business logic. It communicates with the backend via the PocketBase SDK.
- **Backend**: PocketBase serves as the all-in-one backend, providing:
  - **Database**: SQLite-based data storage for favorites and users.
  - **Authentication**: Handles Google SSO and session management.
  - **API**: REST API for data synchronization.
- **Offline Capability**: The application implements a repository pattern that automatically switches between PocketBase (online) and `localStorage` (offline/local mode), ensuring the app remains functional without an internet connection.
- **Deployment**: The entire stack is containerized using Docker, with Nginx serving the frontend and PocketBase running in a separate container.

## Technologies

| Category          | Stack                                                                                                                     |
| :---------------- | :------------------------------------------------------------------------------------------------------------------------ |
| **Core Frontend** | [Vue 3](https://vuejs.org/) (Composition API), [TypeScript](https://www.typescriptlang.org/), [Vite](https://vitejs.dev/) |
| **State & Utils** | [Pinia](https://pinia.vuejs.org/), [VueUse](https://vueuse.org/), [Vue I18n](https://vue-i18n.intlify.dev/)               |
| **UI & Styling**  | [Tailwind CSS](https://tailwindcss.com/), [Lucide Vue](https://lucide.dev/)                                               |
| **Backend & Ops** | [PocketBase](https://pocketbase.io/), Docker                                                                              |
| **Testing & QA**  | [Vitest](https://vitest.dev/), [Playwright](https://playwright.dev/), ESLint, Prettier                                    |

## Documentation

- **[Development Guide](./docs/DEVELOPMENT.md)** - Setup local environment, IDE, and run commands.
- **[Pocketbase Setup](./docs/POCKETBASE_SETUP.md)** - Install and configure the backend.
- **[Pocketbase Schema](./docs/POCKETBASE_SCHEMA.md)** - Database schema details.
- **[Authentication Setup](./docs/AUTHENTICATION.md)** - Google SSO and local mode guide.
- **[Docker Deployment](./docs/DOCKER.md)** - Deploy with Docker and Docker Compose.

## Quick Start

### Docker

```bash
git clone https://github.com/baptiste-pasquier/groovemark.git
cd groovemark/docker
docker-compose up -d
```

Access the app at `http://localhost:8080` and Pocketbase at `http://localhost:8090/_/`.

### Local Development

```bash
npm install
npm run dev
```

See [Development Guide](./docs/DEVELOPMENT.md) for more details.

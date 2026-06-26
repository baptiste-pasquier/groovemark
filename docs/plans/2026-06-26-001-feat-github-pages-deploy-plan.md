---
title: 'feat: Deploy demo to GitHub Pages'
date: 2026-06-26
type: feat
origin: docs/brainstorms/2026-06-26-github-pages-deploy-requirements.md
status: ready
---

# feat: Deploy demo to GitHub Pages

## Summary

Add a GitHub Actions workflow that builds and deploys GrooveMark to GitHub Pages on every push to `main`. The demo runs in local-only mode — no backend, no code changes. The Vite `base` path is passed as a CLI flag in the workflow only, preserving the existing Docker build.

---

## Problem Frame

GrooveMark has no public demo. Sharing the app requires either running it locally or deploying the full Docker stack with PocketBase. A static GitHub Pages deployment would let anyone try the app instantly in local-only mode (see origin: `docs/brainstorms/2026-06-26-github-pages-deploy-requirements.md`).

---

## Requirements

- **R1.** The app is accessible at `https://baptiste-pasquier.github.io/groovemark/` after deployment
- **R2.** Deployment triggers automatically on push to `main`
- **R3.** The Vite `base` path is set via `--base=/groovemark/` CLI flag, not in `vite.config.ts`
- **R4.** The existing Docker build and CI pipeline are unaffected

---

## Key Technical Decisions

| ID   | Decision                | Choice                                                     | Rationale                                                                                             |
| ---- | ----------------------- | ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| KTD1 | Base path strategy      | CLI flag `--base=/groovemark/` in workflow build step only | Avoids modifying `vite.config.ts`, which would break the Docker build that serves at `/` (see origin) |
| KTD2 | Pages deployment method | `actions/upload-pages-artifact` + `actions/deploy-pages`   | Standard GitHub-recommended approach for static sites; no `gh-pages` branch to maintain               |
| KTD3 | Node version            | `lts/*` with npm cache                                     | Matches existing CI and Playwright workflows (`ci.yml`, `playwright.yml`)                             |

---

## Scope Boundaries

### In scope

- New workflow file `.github/workflows/deploy.yml`

### Out of scope

- No changes to `vite.config.ts`
- No changes to application code
- No auth UI changes
- No custom domain
- No vue-router 404 fallback

### Deferred to Follow-Up Work

- Custom domain configuration if needed later
- Optional banner or visual indicator for "demo mode"

---

## Implementation Units

### U1. Create GitHub Pages deployment workflow

**Goal:** Add a workflow that builds the Vite app with the correct base path and deploys to GitHub Pages.

**Requirements:** R1, R2, R3, R4

**Dependencies:** None

**Files:**

- Create `.github/workflows/deploy.yml`

**Approach:**

The workflow has two jobs:

1. **build** — Checkout, setup Node (matching `ci.yml` pattern: `actions/checkout@v5`, `actions/setup-node@v6`, `node-version: 'lts/*'`, `cache: 'npm'`), `npm ci`, then `npx vite build --base=/groovemark/`. Upload the `dist/` directory using `actions/upload-pages-artifact`.

2. **deploy** — Uses `actions/deploy-pages` to publish the uploaded artifact. Depends on the build job. Runs in the `github-pages` environment with `url: ${{ steps.deployment.outputs.page_url }}`.

The workflow needs `permissions: pages: write, id-token: write, contents: read` at the top level. Triggered on `push` to `main` only (not PRs — PRs don't deploy). Add `concurrency` group `pages` with `cancel-in-progress: false` to prevent overlapping deployments.

**Patterns to follow:**

- `ci.yml` for Node setup steps (checkout, setup-node, npm ci)
- `docker-build.yml` for permissions structure

**Test scenarios:**

- Push to `main` triggers the workflow and deploys successfully to `https://baptiste-pasquier.github.io/groovemark/`
- The deployed app loads correctly with all assets (JS, CSS, images) resolving under `/groovemark/`
- The app detects backend unavailability and enters local-only mode without errors
- The existing CI workflow (`ci.yml`) continues to run independently and is unaffected
- The existing Docker build workflow (`docker-build.yml`) continues to work with default base `/`

**Verification:** After merging, navigate to `https://baptiste-pasquier.github.io/groovemark/` — the app should load, display the local-mode UI, and allow adding/managing favorites in localStorage.

---

## Open Questions

- **Manual setup required:** GitHub Pages must be enabled in the repository settings (Settings > Pages > Source: GitHub Actions). This is a one-time manual step after the workflow is merged.

---

## Sources & Research

- Existing workflows: `ci.yml`, `playwright.yml`, `docker-build.yml` for action versions and Node setup patterns
- Origin: `docs/brainstorms/2026-06-26-github-pages-deploy-requirements.md`

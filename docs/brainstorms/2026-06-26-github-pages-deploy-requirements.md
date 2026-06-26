# GitHub Pages Demo Deployment

**Date:** 2026-06-26
**Status:** Ready for planning

## Desired Outcome

Visitors can access a live demo of GrooveMark at `https://baptiste-pasquier.github.io/groovemark/` running in local-only mode (no backend). The demo auto-deploys on every push to `main`.

## Scope

### In scope

- GitHub Actions workflow that builds the Vite app with `--base=/groovemark/` and deploys to GitHub Pages
- Triggered on push to `main`
- Uses the standard `actions/deploy-pages` approach (build artifact upload + Pages deployment)

### Out of scope

- No changes to `vite.config.ts` — the `base` override is CLI-only in the workflow
- No changes to app code — existing `backendAvailable` detection already provides local-mode fallback
- No auth UI changes — Google login button stays visible; the app gracefully handles backend absence
- No custom domain setup
- No vue-router 404 fallback (no router in use)

## Key Decisions

| Decision           | Choice                                          | Rationale                                                                      |
| ------------------ | ----------------------------------------------- | ------------------------------------------------------------------------------ |
| Base path strategy | CLI flag `--base=/groovemark/` in workflow only | Preserves Docker build (which serves at `/`) without touching `vite.config.ts` |
| Auth UI in demo    | Keep as-is                                      | App already detects backend unavailability and falls back to local mode        |
| Deploy trigger     | Push to `main`                                  | Matches existing CI trigger; demo stays in sync with latest release            |

## Dependencies

- GitHub Pages must be enabled on the repository (Settings > Pages > Source: GitHub Actions)

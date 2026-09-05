---
title: Architecture notes
type: explanation
audience: [human, agent]
status: stable
stale_after: 2026-12-15
---

# Architecture Notes

This document captures the application-level behavior that complements the high-level
architecture overview in the main [README](../../README.md).

## Bootstrap Flow

The app resolves locale, auth state, and favorites readiness before rendering the main
UI. This keeps the shell from rendering an inconsistent state while stores are still
hydrating.

## App States

The main shell explicitly transitions through three states:

- `booting`
- `unauthenticated`
- `ready`

This keeps startup behavior predictable and separates login flow from the main
application view.

## Persistence Model

The persistence strategy is intentionally split by auth mode:

- PocketBase is the source of truth for authenticated sessions when available
- `localStorage` is the source of truth for local mode
- Authenticated offline fallback uses a user-scoped cache

This avoids mixing anonymous favorites with authenticated user data.

## Storage Keys

See [PocketBase Schema](../reference/pocketbase-schema.md#storage-keys) for the current
list of browser storage keys and the legacy migration note.

## Import Flow

JSON parsing and validation happen before favorites are written. Invalid files surface a
UI alert instead of mutating state.

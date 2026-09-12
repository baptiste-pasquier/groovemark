---
title: Frontend layout conventions
type: conventions
audience: [agent, human]
status: stable
stale_after: 2026-12-10
---

# Frontend Layout Conventions

**Scope: editing the responsive layout of GrooveMark's card destinations (Vue templates and the
layout tokens in `src/assets/tailwind.css`).**

If the layout changes, prefer this order:

1. Change the token in `@theme`
2. Recompute the shell width formulas in [Responsive Layout](../reference/responsive-layout.md)
   if needed
3. Keep component templates using semantic classes instead of arbitrary values

Avoid reintroducing raw values like `min-[87rem]` or `max-w-[108.5rem]` directly in Vue
templates unless the layout system is being redesigned.

## Sharing A Layout Class Between Destinations

A layout class is named after what it lays out, never after one destination, as soon as a
second destination needs it. One class then owns the behaviour for both, so a breakpoint change
cannot reach one surface and miss the other.

Renaming such a class is one change, in this order:

1. Pin the current rendering of every surface that carries the class with a test that does not
   name the class, so the rename can be proved not to have degraded any of them
2. Grep the whole tree for the old name, including `src/assets/tailwind.css`, the Vue
   templates, `src/__tests__/`, `e2e/` and every doc under `docs/`
3. Rename, then re-point every occurrence in the same change
4. Record the new name in [Responsive Layout](../reference/responsive-layout.md), together with
   any behaviour one surface deliberately does not share with the others

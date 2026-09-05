---
title: Frontend layout conventions
type: conventions
audience: [agent, human]
status: stable
stale_after: 2026-12-10
---

# Frontend Layout Conventions

**Scope: editing the favorites responsive layout (Vue templates and the layout tokens in
`src/assets/tailwind.css`).**

If the layout changes, prefer this order:

1. Change the token in `@theme`
2. Recompute the shell width formulas in [Responsive Layout](../reference/responsive-layout.md)
   if needed
3. Keep component templates using semantic classes instead of arbitrary values

Avoid reintroducing raw values like `min-[87rem]` or `max-w-[108.5rem]` directly in Vue
templates unless the layout system is being redesigned.

---
title: Demo preview
type: how-to
audience: [human, agent]
status: stable
stale_after: 2026-12-20
---

# Demo Preview

![GrooveMark demo preview](../demo.gif)

The repository includes a committed GIF preview at [`docs/demo.gif`](../demo.gif).

Regenerate it locally with:

```bash
npm run test:demo
```

The dedicated Playwright flow:

- starts on the welcome screen
- continues in local mode
- loads a seeded collection of real YouTube examples with their real thumbnails
- adds one favorite manually
- highlights timestamps and artist filtering
- switches to the events destination, showing two attended nights with their line-ups and
  verdicts
- opens a performer's own page from a credited name on an event card, and brings its live
  half into frame -- at the page's scroll top that half sits below the mixes grid

`e2e/fixtures/demoFavorites.ts` seeds three storage keys before the app boots:
`groovemark:favorites:local`, `groovemark:events:local` and `groovemark:artists:local`. Seed an
artist record for every name the mixes and the events credit -- a mix credits an artist by
relation id, and an event card folds the display name it carries into the artist's address, so
a credited name with no matching record reaches the not-found page rather than an artist page.

`npm run test:demo` saves intermediate screenshots in `test-results/demo-frames` and writes
the final GIF to `docs/demo.gif`. Frames become GIF frames in filename order, so a new step's
screenshot has to keep the `NN-name.png` numbering.

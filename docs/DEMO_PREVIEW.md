# Demo Preview

![GrooveMark demo preview](./demo.gif)

The repository includes a committed GIF preview at [`docs/demo.gif`](./demo.gif).

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

`npm run test:demo` saves intermediate screenshots in `test-results/demo-frames` and writes
the final GIF to `docs/demo.gif`.

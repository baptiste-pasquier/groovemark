/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    // The /api/batch endpoint is disabled by default, and an event save is one
    // batch transaction (KTD2): without this the event and its performances
    // would have to be written one request at a time, which cannot fail as a
    // whole. Setting it here rather than in the dashboard keeps it reproducible
    // in the Docker image -- a hand-configured instance would otherwise read
    // and list events fine and fail only on save.
    const settings = app.settings()

    settings.batch.enabled = true
    // Bounds live in src/utils/event.ts (BATCH_MAX_REQUESTS,
    // BATCH_TIMEOUT_SECONDS) so the client can refuse an oversized batch
    // before sending it; the settings endpoint is superuser-only, so the
    // client can never read them back from the server.
    settings.batch.maxRequests = 50
    // PocketBase measures this one in seconds.
    settings.batch.timeout = 3

    return app.save(settings)
  },
  (app) => {
    const settings = app.settings()

    // Disabling the endpoint is the whole reversal: the two bounds are inert
    // while it is off, and they already hold PocketBase's own default values.
    settings.batch.enabled = false

    return app.save(settings)
  },
)

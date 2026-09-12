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
    // The first two bounds are mirrored in src/utils/event.ts
    // (BATCH_MAX_REQUESTS, BATCH_TIMEOUT_SECONDS) so the client can refuse an
    // oversized batch before sending it and name the reason; the settings
    // endpoint is superuser-only, so the client can never read them back from
    // the server.
    settings.batch.maxRequests = 50
    // PocketBase measures this one in seconds.
    settings.batch.timeout = 3
    // The third is a server-side ceiling only, so nothing mirrors it: the
    // client has no reason to evaluate it, and a body that reaches it is not a
    // request this app makes. Left unset it means PocketBase's own default of
    // roughly 128MB -- four times what an ordinary record create accepts -- and
    // the server buffers that body before any collection rule is consulted, so
    // owner-scoping does not bound the cost. The largest batch this app sends
    // is 51 small JSON sub-requests, on the order of ten kilobytes, so 1MB is
    // already two orders of magnitude of headroom. It assumes no file field
    // ever travels in a batch; add one and this has to be raised.
    settings.batch.maxBodySize = 1048576

    return app.save(settings)
  },
  (app) => {
    const settings = app.settings()

    // Disabling the endpoint would be reversal enough on its own -- every bound
    // is inert while it is off -- but maxBodySize is the one value here that is
    // not PocketBase's own default, so it is put back explicitly rather than
    // left behind for a later enable to inherit silently. 0 means "use the
    // built-in default", which is what the endpoint had before this migration.
    settings.batch.enabled = false
    settings.batch.maxBodySize = 0

    return app.save(settings)
  },
)

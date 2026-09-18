/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const collection = app.findCollectionByNameOrId('_pb_users_auth_')

    // The earlier users migration only turned OAuth2 on; it never touched the access rules, so
    // they are still the PocketBase defaults -- and the default create rule is the **empty
    // string**, which means "anyone", unauthenticated callers included. On localhost that is
    // inert. On a public origin it is an open write endpoint on a single-operator instance: a
    // stranger can POST /api/collections/users/records and get an account, and every collection
    // here is owner-scoped, so that account then has its own readable and writable corner of the
    // database.
    //
    // The trap: PocketBase creates the OAuth2 account by replaying the record-create API
    // internally (apis.sendOAuth2RecordCreateRequest posts to /api/collections/users/records), so
    // this rule is evaluated for it too. The caller is unauthenticated at that moment -- it is a
    // first sign-in -- so any rule phrased as "must already be signed in", and equally a locked
    // rule (null, superusers only), bricks the only sign-in path on a clean instance. Local mode
    // never touches PocketBase, so Google sign-in is the only way an account is ever created.
    //
    // What separates the two: PocketBase tags that internal request with the OAuth2 request
    // context, which rules read as `@request.context`. A plain API call carries the "default"
    // context. So the rule admits exactly the OAuth2 sign-up path and nothing else.
    //
    // Setting this here rather than in the dashboard keeps it reproducible in the Docker image,
    // which is the same reason the batch settings live in a migration: a hand-configured instance
    // would sign in and serve data normally and differ only in who else can open an account.
    collection.createRule = '@request.context = "oauth2"'

    return app.save(collection)
  },
  (app) => {
    const collection = app.findCollectionByNameOrId('_pb_users_auth_')

    // Back to the PocketBase default: an empty (not null) rule, i.e. open to everyone.
    collection.createRule = ''

    return app.save(collection)
  },
)

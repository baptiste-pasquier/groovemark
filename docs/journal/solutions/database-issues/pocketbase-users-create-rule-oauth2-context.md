---
title: "PocketBase's default users create rule is open to anyone, and the obvious fixes brick sign-in"
date: 2026-09-19
category: database-issues
module: auth
problem_type: database_issue
component: api_rules
symptoms:
  - Anyone can POST /api/collections/users/records against a public instance and get an account
  - Every collection is owner-scoped, so a self-created account gets its own writable corner of the database
  - Tightening the rule to '@request.auth.id != ""' or locking it to superusers makes Google sign-in fail on a clean instance
root_cause: config_error
resolution_type: migration
severity: high
tags: [pocketbase, api-rules, oauth2, users-collection, migration, request-context]
framework_version: pocketbase 0.40.2
---

# PocketBase's default users create rule is open to anyone, and the obvious fixes brick sign-in

## Problem

`pocketbase/pb_migrations/1788708042_updated_users.js` turns OAuth2 on for the `users`
collection but never touches its access rules, so they stayed at the PocketBase defaults. The
default create rule on an auth collection is the **empty string**, which means "anyone",
unauthenticated callers included -- not `null` (superusers only), which is easy to assume.

On localhost that is inert. On a public origin it is an open account endpoint on what is meant to
be a single-operator instance. Because `favorites`, `artists`, `events` and `performances` are all
owner-scoped, a stranger who creates an account does not read the operator's data -- but they do
get a durable, writable corner of the operator's database, and an unauthenticated write endpoint
on an otherwise closed deployment.

## Symptoms

- `POST /api/collections/users/records` with only an email and password succeeds unauthenticated
  and returns a real record.
- Nothing in the app surfaces this: the client only ever calls `authWithOAuth2`, so the open
  endpoint is invisible from the UI and from every existing test.

## What Didn't Work

Both obvious tightenings break the only sign-in path the app has, and both break it only on a
clean instance -- the case nobody exercises locally, because a developer's PocketBase already has
its account.

PocketBase creates the OAuth2 account by **replaying the record-create API internally**:
`apis.sendOAuth2RecordCreateRequest` posts to `/api/collections/users/records`, so the collection's
create rule is evaluated for it too. The caller is unauthenticated at that moment -- it is a first
sign-in, the account does not exist yet. So:

| Rule tried               | What it does to a first-ever Google sign-in               |
| ------------------------ | --------------------------------------------------------- |
| `@request.auth.id != ""` | Rejects it. The caller has no identity yet, by definition |
| `null` (superusers only) | Rejects it. The sign-in is not a superuser request        |
| `''` (the default)       | Accepts it, and accepts every stranger too                |

Local mode never touches PocketBase, so Google sign-in is the only path that ever creates an
account here. Any of the first two rules leaves a fresh deployment with no way in at all.

## Solution

`pocketbase/pb_migrations/1789769200_users_close_anonymous_create.js` sets the create rule to:

```js
collection.createRule = '@request.context = "oauth2"'
```

PocketBase tags that internal sign-up request with the OAuth2 request context, which rules read as
`@request.context`. A plain API call carries the `"default"` context. So the rule admits exactly
the OAuth2 sign-up path and nothing else.

The down direction restores `''`, not `null` -- the PocketBase default is an empty rule, and
reverting to a locked one would leave a clean instance unable to sign anyone in.

The rule is pinned verbatim by `src/__tests__/pocketbaseMigrations.spec.ts`, along with the down
direction, rather than merely asserted non-empty: both of the tightenings in the table above would
satisfy a "not empty" assertion while breaking sign-in.

## Why This Works

Measured against the version pinned in `docker/Dockerfile.pocketbase` (v0.40.2), on a container
built from this repo's full migration set with an empty `pb_data`:

| Request                                                   | Before the migration  | After                          |
| --------------------------------------------------------- | --------------------- | ------------------------------ |
| Anonymous `POST /api/collections/users/records`           | `200`, record created | `400 Failed to create record.` |
| First-ever `POST /api/collections/users/auth-with-oauth2` | `200`, record created | `200`, record created          |

The "before" column is a control instance of the same binary started with no migrations at all,
which confirms the open endpoint is PocketBase's own default and not something this repo
introduced.

The OAuth2 half was exercised end to end rather than reasoned about, because that is the half
whose failure only shows up on a clean instance. A throwaway migration pointed the generic `oidc`
provider at a local stub token/userinfo server, and the sign-in was driven through the real
`auth-with-oauth2` endpoint against a database with no users in it. The response came back with
`meta.isNew: true` and a created record, which is the exact case the rule has to keep working.
The stub and its migration lived in a scratchpad and were never committed.

Note that a refused create returns `400 Failed to create record.` on v0.40.2, not the `403` an
auth-collection rule failure returns on some earlier versions -- worth knowing before writing an
assertion on the status code.

## Prevention

- **A PocketBase collection whose rules a migration never set is not "locked down by default".**
  Check every rule the app relies on. An empty-string rule means anyone; `null` means superusers
  only. The two look similar in a dashboard and mean opposite things.
- **Never phrase a rule on an auth collection as "must already be authenticated" without
  checking what it does to first sign-in.** Account creation through OAuth2 is an internal replay
  of the record-create API by an unauthenticated caller. `@request.context` is what separates it
  from a plain API call.
- **Verify a rule change on an auth collection against an empty database, not a developer's.**
  A rule that breaks only first-ever sign-in passes every local check on an instance that already
  has an account, and fails on the first real deployment.

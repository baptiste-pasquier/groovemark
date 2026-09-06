---
title: Version PocketBase Migrations in Docker - Plan
type: feat
date: 2026-09-06
artifact_contract: ce-unified-plan/v1
artifact_readiness: implementation-ready
product_contract_source: ce-plan-bootstrap
execution: code
---

# Version PocketBase Migrations in Docker - Plan

## Goal Capsule

- **Objective:** PocketBase's schema, defined by `pocketbase/pb_migrations/*.js`, is versioned in git and ships automatically with every PocketBase Docker image, so a fresh dev or production PocketBase container always has the current `favorites` / `users` / `_superusers` schema with no manual admin-UI setup step.
- **Means:** Bake migrations into the image at build time via `COPY`, the same mechanism for local dev builds and the CI-published production image (KTD1).
- **Authority:** Product Contract requirements govern scope. Planning Contract KTDs govern implementation mechanism within that scope. Implementation Units override neither.
- **Stop conditions:** None identified. Research found no evidence invalidating either session-settled decision below.
- **Execution profile:** `code`, Standard depth, no elevated risk — the first rollout recreates PocketBase's data volume from empty in both dev and production (KTD applies via the Key Decision below), so no existing schema can collide with the baked-in migrations.
- **Tail ownership:** The implementer (`ce-work` or the user) commits per unit and opens the PR. This plan does not launch an autonomous pipeline.

---

## Product Contract

### Summary

Track `pocketbase/pb_migrations/` in git and copy it into the PocketBase Docker image at build time, so migrations apply automatically in dev and production. Update the docker-compose files and docs to match, and stop suggesting a bind-mount alternative that no longer applies.

### Problem Frame

`pocketbase/pb_migrations/` is currently excluded from git by a blanket `pb_migrations/` rule in the root `.gitignore`. The three migrations that define the app's schema (`_superusers`, `users`, `favorites`) exist only on the machine that generated them and are never built into a Docker image. `docs/how-to/pocketbase-setup.md` currently tells a new operator to create the `favorites` collection by hand through the admin UI instead of relying on migrations.

### Requirements

**Packaging**

- R1. `pocketbase/pb_migrations/` is tracked in git, including its three existing migration files. `pocketbase/pb_data/`, `test/pb_migrations/`, `test/pb_data/`, and the `pocketbase` binary remain ignored.
- R2. `docker/Dockerfile.pocketbase` copies `pocketbase/pb_migrations/` into the image at build time, so every image build — local dev and CI — includes the current migrations.
- R3. `docker/docker-compose.prod.yml` no longer suggests bind-mounting migrations as an alternative to the baked-in image.

**Documentation**

- R4. `docs/how-to/docker-deployment.md`, `docs/how-to/pocketbase-setup.md`, and `docs/reference/pocketbase-schema.md` describe the baked-in migrations behavior and the local workflow for authoring a new migration.
- R5. `CHANGELOG.md` records the change under `Unreleased`.

### Key Decisions

- **Bake migrations into the image at build time; do not bind-mount them in dev** (session-settled: user-approved — chosen over a dev bind-mount for rebuild-free iteration: keeps one identical dev/prod mechanism, since the prod compose only consumes the pre-built ghcr.io image with no local repo mounted). Governs R2, R3.
- **Every existing PocketBase data volume this change reaches — local dev included — is recreated from empty, not upgraded in place** (session-settled: user-directed — chosen over a pre-flight verification step against existing collection IDs, or an in-place upgrade of a populated volume: production is relaunched from scratch on this change specifically so dev and production migration state stay mirrored, which eliminates the collection-ID collision risk rather than merely checking for it). Governs the Risks entry below and Definition of Done.

### Scope Boundaries

- Baking `pocketbase/pb_hooks` into the Docker image is out of scope — that `COPY` line in `docker/Dockerfile.pocketbase` stays commented. `pb_hooks` is already git-tracked independently of this change and is unaffected by it.
- Pre-flight verification of existing collection IDs is out of scope: the Key Decision above recreates data volumes from empty instead of checking what they already contain.

#### Deferred to Follow-Up Work

- Version-pinned production image tags and a scripted rollback procedure for `docker-compose.prod.yml` (it always pulls `:latest` today) — a broader operational change outside this plan.

### Risks & Dependencies

- **Risk (resolved for this rollout):** `pocketbase/pb_migrations/1788708315_created_favorites.js` creates the `favorites` collection with hardcoded collection and field IDs, which would collide with any existing, differently-ID'd `favorites` collection — including one already created by hand in a dev Docker volume or the bare-metal `pocketbase/pb_data` directory via the current manual setup steps in `pocketbase-setup.md`. Resolved by the Key Decision above: every data volume this change reaches, dev and production alike, is recreated from empty as part of the rollout, so no pre-existing collection is present to collide. This resolution is scoped to this rollout; a later migration that touches an already-populated collection should still consider whether its target IDs match what is live.
- **Dependency:** `.github/workflows/docker-build.yml` already builds and pushes `groovemark-pocketbase` to `ghcr.io` on push to `main`/`develop` and on version tags, with no workflow changes needed. The next such push after this change lands is what actually publishes an image with migrations baked in.

---

## Planning Contract

### Key Technical Decisions

- KTD1. **Scope the `.gitignore` fix to explicit, non-negated entries.** Remove the blanket `pb_migrations/` line and add an explicit `test/pb_migrations/` entry; leave `pb_data/` and `pocketbase/pocketbase` untouched. Rationale: a blanket removal would also start tracking the unrelated `test/pb_migrations/` fixture directory, and a negation pattern layered on top of a blanket ignore is an unreliable git idiom. Governs U1.
- KTD2. **Migration authoring workflow: generate, don't hand-write.** A new migration is produced by making the schema change against a locally running PocketBase instance (admin UI, or the `pocketbase migrate collections` CLI) started as `cd pocketbase && ./pocketbase serve` — this exact invocation is pinned because it is what makes the resulting migration file land in `pocketbase/pb_migrations/`, matching the directory the Docker `COPY` reads from. The generated file is then committed and shipped by rebuilding the image (dev) or merging to trigger the CI build and redeploying (prod). Rationale: the three existing migration files' content and naming exactly match PocketBase's own auto-generated migration format, evidencing this is how they were produced. Governs U4.
- KTD3. **Document the existing rollback path; do not build new rollback tooling.** Record that a bad migration is rolled back by redeploying a prior `groovemark-pocketbase` image tag already pushed by CI, or by running `pocketbase migrate down` against the persisted volume — as an operational note, not new automation. Rationale: no production data is at risk yet, so building version-pinning infrastructure now would be scope creep; the deferred item above tracks it for later. Governs U4.

---

## Implementation Units

### U1. Track `pocketbase/pb_migrations/` in git

- **Goal:** Stop `pocketbase/pb_migrations/` from being silently excluded from version control, while the unrelated test fixtures and generated data stay ignored.
- **Requirements:** R1
- **Dependencies:** none
- **Files:**
  - `.gitignore`
  - `pocketbase/pb_migrations/1788707944_updated__superusers.js`
  - `pocketbase/pb_migrations/1788708042_updated_users.js`
  - `pocketbase/pb_migrations/1788708315_created_favorites.js`
- **Approach:** Per KTD1, remove the blanket `pb_migrations/` line from `.gitignore` and add an explicit `test/pb_migrations/` entry in its place. Leave the existing `pb_data/` and `pocketbase/pocketbase` lines as they are. Stage and commit the three existing, previously-untracked migration files.
- **Test expectation:** none -- pure git-tracking and config change, verified structurally below.
- **Verification:** `git ls-files pocketbase/pb_migrations` lists all three files. `git check-ignore -v test/pb_migrations`, `pocketbase/pb_data`, `test/pb_data`, and `pocketbase/pocketbase` each still report ignored.

### U2. Bake migrations into the PocketBase Docker image

- **Goal:** Every PocketBase image build — local dev and CI — includes the current migrations.
- **Requirements:** R2
- **Dependencies:** U1
- **Files:** `docker/Dockerfile.pocketbase`
- **Approach:** Uncomment the existing `COPY ./pocketbase/pb_migrations /pb/pb_migrations` line. Leave the adjacent `pb_hooks` `COPY` line commented (Scope Boundaries).
- **Execution note:** This is packaging, not application code; prefer a runtime smoke check over unit coverage.
- **Test scenarios:**
  - Happy path: build the image (`docker compose -f docker/docker-compose.yml build pocketbase`), start it against a fresh volume, and confirm the `favorites`, `users`, and `_superusers` collections exist with the shape the three migrations define.
  - Integration: container start logs show all three migrations applying with no errors.
- **Verification:** A fresh container boots healthy (`/api/health`) and the collections above are present and correctly shaped, with no admin-UI setup step performed.

### U3. Retire the stale bind-mount alternative in the production compose file

- **Goal:** `docker-compose.prod.yml` no longer suggests an alternative that contradicts the baked-in-image design.
- **Requirements:** R3
- **Dependencies:** U2
- **Files:** `docker/docker-compose.prod.yml`
- **Approach:** Remove the commented `../pocketbase/pb_migrations:/pb/pb_migrations:ro` line and its `migrations and hooks` comment header; keep the commented `pb_hooks` bind-mount line, updating its comment to reference hooks only.
- **Test expectation:** none -- comment cleanup only.
- **Verification:** The file no longer implies migrations can be bind-mounted as an alternative to the image build.

### U4. Document the new migrations workflow

- **Goal:** An operator or future contributor can find out, without asking, that migrations ship with the image and how to add a new one.
- **Requirements:** R4
- **Dependencies:** U1, U2, U3
- **Files:**
  - `docs/how-to/docker-deployment.md`
  - `docs/how-to/pocketbase-setup.md`
  - `docs/reference/pocketbase-schema.md`
- **Approach:**
  1. In `docker-deployment.md`'s Pocketbase Image section, add a line stating migrations from `pocketbase/pb_migrations/` are copied into the image at build time and applied automatically on container start. Add a short operational note for rollback per KTD3 (redeploy a prior published image tag, or run `pocketbase migrate down` against the volume). Add a one-time rollout note per the Key Decision above: the first deploy of this change recreates the PocketBase data volume from empty (dev and production) rather than upgrading an existing one in place.
  2. In `pocketbase-setup.md`, replace the manual "create the `favorites` collection by hand" step with a statement that migrations create it automatically. Add a short "Adding a new migration" procedure per KTD2, pinning `cd pocketbase && ./pocketbase serve` as the required local invocation.
  3. In `pocketbase-schema.md`, add a line stating the schema's canonical source is `pocketbase/pb_migrations/*.js`, baked into the Docker image at build time.
- **Test expectation:** none -- documentation only.
- **Verification:** `npm run check:docs` passes. Each updated file states the current rule rather than narrating the prior manual-setup behavior.

### U5. Record the change in `CHANGELOG.md`

- **Goal:** The change is discoverable from the project's change history.
- **Requirements:** R5
- **Dependencies:** U1, U2, U3, U4
- **Files:** `CHANGELOG.md`
- **Approach:** Add one entry under `## [Unreleased]` / `### Added` noting that PocketBase migrations are now versioned and baked into the PocketBase Docker image.
- **Test expectation:** none.
- **Verification:** The entry is present under `Unreleased`.

---

## Verification Contract

- `npm run check:docs` — the documentation gate; required because U4 touches `docs/how-to/` and `docs/reference/`.
- `npm run format` and `npm run lint` — the repo's standard pre-commit checks apply to every touched file (`.gitignore`, YAML, Markdown).
- Manual smoke check (per U2): `docker compose -f docker/docker-compose.yml build pocketbase && docker compose -f docker/docker-compose.yml up pocketbase`, then confirm the collections and container logs described in U2's Verification.

## Definition of Done

- All five units are complete and their individual Verification criteria pass.
- `pocketbase/pb_migrations/*.js` is tracked in git; `pocketbase/pb_data/`, `test/pb_migrations/`, `test/pb_data/`, and the `pocketbase` binary remain ignored.
- A local image build boots PocketBase with the current schema already applied, with no manual admin-UI step.
- The first rollout recreates PocketBase's data volume from empty, dev and production alike, rather than upgrading an existing schema in place.
- `docker-compose.prod.yml`, the three docs files, and `CHANGELOG.md` reflect the new behavior.
- No leftover debug output, temporary files, or commented-out dead code remains in `docker/`, `.gitignore`, or the touched docs.

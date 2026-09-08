---
title: Artist Entity - Plan
type: feat
date: 2026-09-05
topic: artist-entity
artifact_contract: ce-unified-plan/v1
artifact_readiness: implementation-ready
product_contract_source: ce-brainstorm
execution: code
deepened: 2026-09-07
---

# Artist Entity - Plan

## Goal Capsule

- **Objective:** Every mix that credits the same performer points at one artist, spelling variants included, so the artist list stops showing the same person twice.
- **Means:** Promote artists into a record of their own, created inline from the artist field and resolved during import, shipped as a single destructive PocketBase migration with no client-side data conversion, because production holds no favorites yet (KTD2).
- **Product authority:** This plan owns the artist entity and the resolution of artist names on import. Renaming, merging, the artist view, and everything about events are not active scope — see How This Work Fits Together.
- **Execution profile:** Cross-cutting. New collection, new store, new repository pair, and a schema-only migration. Ships behind no flag; the migration plus a manual re-import of the operator's JSON backup are the deploy.
- **Stop conditions:** Stop and ask if a requirement here would need the artist view to exist, or if production stops being empty before this ships — the whole approach assumes there is no existing favorite to preserve across the migration.
- **Tail ownership:** This plan ends at a green branch. Commit, PR, and CI belong to whoever runs the shipping step.

---

## Product Contract

### Summary

Artists become a record identified independently of their display name. Typing an unknown name in a mix's artist field creates one on the spot; typing a known name under a different casing or accent reuses the existing one. Importing a JSON backup resolves each name to an existing artist or creates one, collapsing spelling variants within the file into a single artist named by the most frequent spelling.

### Problem Frame

An artist exists in GrooveMark only as a string copied into each favorite's `artists` array (`src/types/favorite.ts:11`). Nothing binds two copies of the same name together, so the app contradicts itself: the artist field suggests `amelie lens` while the user types `AMELIE`, then stores the typed form as a separate artist because tag deduplication compares exactly (`src/components/favorites/ArtistTagsInput.vue`). The grid filter compares exactly too (`src/stores/favoritesUi.ts:51`), so the two spellings filter to two disjoint sets of mixes.

The cost is invisible until artists are used as an axis rather than a label. A per-artist view that gathers everything about a performer is only as trustworthy as the join it rests on, and a join on free text drifts every time a name is retyped. That drift is unrecoverable today: nothing in the app can merge two spellings after the fact.

Production carries no favorites yet — the only account is the author's, and its data lives in a JSON export outside the database. This plan is scoped to that fact: the schema ships as a destructive migration, and the account is repopulated by importing that backup afterwards, rather than by converting anything already stored.

### Requirements

**Artist identity**

- R1. An artist is a record identified independently of its display name, and a favorite references artists by that identity rather than by a copied name string.
- R2. Typing a name with no matching artist in a mix's artist field creates that artist inline. No separate screen is visited to create one.
- R3. Suggestion and matching in the artist field ignore case, accents, and surrounding whitespace.
- R4. An artist record carries a display name and nothing else.
- R5. The artist list, the grid's artist filter, and the search box operate on artist identity, so filtering by an artist returns every mix crediting them regardless of how the name was typed.
- R8. An artist that no record references stops appearing in the artist list.
- R16. Every artist reference a stored favorite carries resolves to a name in the mode that stored it, including while the backend is unreachable.

**Import and compatibility**

- R12. The JSON export keeps its current shape — an array of favorites carrying artist names written out in full.
- R13. Importing a file resolves each artist name to an existing artist or creates one. Names in the file matching one another under R3 collapse into a single new artist elected by the most frequent spelling, with ties broken per KTD5. An existing artist's display name is never changed by an import.
- R18. An import that cannot create an artist leaves the affected favorite unimported rather than crediting it with fewer artists than the file lists.

**Access control**

- R14. The artists collection is readable and writable only by the account that owns the record, on create as well as on read, update and delete, and rejects an owner submitted by anyone else.

### Data shape

```mermaid
flowchart TB
  subgraph before["Today"]
    B1["favorite"] --> B2["artists: text names"]
  end
  subgraph after["After"]
    A1["favorite"] --> A2["relation: artist ids"]
    A1 --> A3["artists: text names, kept in sync"]
    A2 --> A4["artist record: display name + slug"]
  end
```

### Key Decisions

- **Artists become a record rather than normalized strings.** An identity removes the ghost-artist class outright instead of making it repairable after the fact. (session-settled: user-directed — chosen over keeping names as normalized strings with a merge-and-rename tool: cleaner, and the events work will lean on this join.) Governs R1, R2, R5.
- **This work ships before the events feature, as its own plan.** Building events first would cement the current name-matching inconsistency in a second place. (session-settled: user-directed — chosen over one combined plan and over events-first.)
- **Renaming and the merge that falls out of it ship with the artist view, not here.** The rename belongs on the artist page rather than bolted onto the filter list. (session-settled: user-directed — chosen over a minimal rename affordance now, a non-destructive conversion, or pulling a reduced artist view forward: a spelling variant created independently of an import stays unmerged until then.) Governs the deferred entry in Scope Boundaries.
- **No client-side data-conversion job; artists are populated only by ordinary use and by importing a backup file.** Production holds no existing favorites, so a conversion service would run against an empty store forever. (session-settled: user-directed — chosen over the client-side read-time conversion this plan previously specified: nothing exists to convert.) Governs the removal of the prior plan's conversion requirements; R13 now owns the collapsing behavior a conversion would otherwise have done.
- **An artist carries a name only.** Links, a comment and a rating are deferred, not rejected. (session-settled: user-directed — chosen over adding any of them now.) Governs R4.
- **The export stays denormalized.** Writing names out in full keeps the entity internal and keeps older exports importable. Governs R12, R13.
- **Artists belong to one account, scoped exactly like favorites.** A shared table would leak one account's typos into another's list. (session-settled: user-approved — chosen over one artist table shared across accounts.) Governs R14, R16.
- **The migration is destructive, with no data-preservation safety net.** Production holds no data, and the operator keeps a JSON export as the account-level backup, so there is nothing a revert needs to restore. (session-settled: user-directed — chosen over keeping a frozen per-favorite snapshot of pre-migration names for an undo path: not needed when there is nothing to lose.) Governs the simplified Success Criteria and Definition of Done.

### Key Flows

- F1. Crediting an artist on a mix
  - **Trigger:** The user types into a mix's artist field.
  - **Steps:** The field suggests artists matching what has been typed, ignoring case, accents and whitespace. Accepting a suggestion credits that artist. Committing a name with no match resolves it on save: an existing artist is reused, otherwise one is created.
  - **Outcome:** The mix references one artist per credit, and no artist exists twice under two spellings.
  - **Covers:** R2, R3.

- F4. Importing a backup
  - **Trigger:** The user imports a JSON file.
  - **Steps:** Every distinct artist name in the file is resolved before the favorite loop runs. Names matching one another under R3 collapse into one artist named by the most frequent spelling in the file; an existing artist always wins over the file's own election. An artist that fails to create leaves its favorite unimported rather than under-crediting it.
  - **Outcome:** The imported favorites reference identities, not copied strings, and no artist exists twice under two spellings within the imported set.
  - **Covers:** R13, R18.

### Acceptance Examples

- AE1. **Covers R3.** Given an artist named `Amelie Lens`, when the user types `AMELIE LENS` into another mix's artist field and saves, then the mix credits the existing `Amelie Lens` and no second artist is created.
- AE5. **Covers R8.** Given an artist credited by exactly one mix, when that credit is removed from the mix, then the artist no longer appears in the artist list.
- AE6. **Covers R13.** Given a JSON file exported before this change, when it is imported, then each artist name in it resolves to an existing artist or creates one, and no import error is raised for the artist field.
- AE7. **Covers R3.** Given a mix already crediting `Amelie Lens`, when the user types `AMELIE` and saves, then the mix credits that artist once, not twice.
- AE8. **Covers R2.** Given the artist field, when the user commits a name that is empty once trimmed, then no artist is created and no credit is added.
- AE9. **Covers R13.** Given an import file whose favorites carry both `Amelie Lens` and `amelie lens`, when it is imported, then both resolve to one artist.
- AE12. **Covers R16.** Given a session that has an artist mirrored from a prior cloud session, when the backend becomes unreachable and favorites load from the cache, then every favorite still displays its artist names.
- AE17. **Covers R13.** Given an existing artist `Amelie Lens`, when a file carrying only `amelie lens` is imported, then the existing artist is credited and its display name is unchanged.
- AE18. **Covers R13.** Given an import file with three rows crediting `Amelie Lens` and one row crediting `amelie lens`, when it is imported, then one artist named `Amelie Lens` credits all four.
- AE19. **Covers R18.** Given two callers creating an artist for the same normalized name at once — an import and a mix save, or two open tabs — when both settle, then exactly one artist exists for that name and neither loses a credit.

### Scope Boundaries

**Deferred for later**

- Renaming an artist, and the merge that falls out of renaming onto an existing name. Both arrive with the artist view.
- Links on an artist record (Instagram, SoundCloud), a free-text comment, and a rating.
- Aliases — a second name pointing at the same artist without renaming it.
- A management screen listing artists with explicit merge and delete actions.
- Deleting artist records that nothing references. The collection grows monotonically for now; R8 hides them from the list. The consequence to expect: a name typed wrong once stays suggestible forever, because KTD14 draws suggestions from every loaded artist while R8 only hides unreferenced ones from the filter list. Removal arrives with the artist view's rename and merge.

**Accepted limitations**

- Two spellings of the same artist created independently — once from the artist field before an import ever saw the second spelling, or across two separate imports — stay two artists until the deferred merge ships. R13's collapsing only runs across a single import's own population, not the whole account.
- Any favorite saved before this ships — a local-mode favorite already sitting in some browser's storage, or a production favorite created between plan-writing and deploy — keeps rendering its artist names through the untouched text column, but carries no relation. It drops out of the identity-based filter list and counts (R5, R8) until it is next saved through the artist field; nothing converts it automatically. KTD2's no-conversion decision applies here too, not only to the production database being empty at plan-writing time.

**Not addressed by this plan**

- Everything about events, venues and live performances. That work is the subject of a separate brainstorm and depends on this one.
- Reconciliation of writes made while the backend is unreachable. The offline cache is read-only by design (`src/stores/favorites.ts:118`); this plan neither widens nor closes that.
- Recovering the original per-file spellings after an import collapses them. The export is denormalized by decision, so a backup taken after such an import carries the elected spellings only.

### Success Criteria

- After importing a backup, the artist list contains no two entries differing only by case, accents or whitespace.
- A JSON file exported before this change imports without error and without creating duplicate artists.
- A cloud-mode import of a large backup completes without tripping the server's rate limit on its artist-create pass.
- Both migrations apply cleanly against an empty database, and their down functions revert cleanly — no data-preservation guarantee is required, since production holds nothing to lose.

<!-- ce-section: work-relationships -->

### How This Work Fits Together

This plan owns one area: artists as a first-class record. The breakdown below is how the surrounding work is currently understood, not a committed roadmap — a later plan may revise, split or discard it.

- **Artist view** — one page per performer, and the home of renaming.
  - Depends on this plan for artist identity.
  - Enables the deferred repair path: renaming, and the merge that falls out of it.
  - Inherits a cost from KTD12: renaming an artist must also rewrite the derived names column on every favorite crediting them, or the export keeps emitting the old spelling and a re-import creates a second artist.
- **Events and live performances** — recording the nights and festivals attended, each carrying a name, a date, a venue, and the performers seen there with a score for that night's set.
  - Depends on this plan: the score is only useful next to what is already known about the performer, and that join is what this plan makes trustworthy.
  - Still to decide: an event as a container holding scored performances, and three top-level views, were explored in the dialogue that produced this plan but none of it is settled.

### Sources

- `src/types/favorite.ts:11` — `artists` is `string[]` on `Favorite`; no artist type exists.
- `src/services/storage.ts:65` — `readStorage` is an unchecked `JSON.parse(raw) as T`, so the local path gets no compile-time protection from a type change.
- `src/services/pocketbaseFavoritesRepository.ts:50,85` — `create` and `update` each list the `artists` column explicitly, so a new field must be added to both call sites by name.
- `src/services/localFavoritesRepository.ts:37-65` — `create` and `update` rebuild each record by spreading the input (`{...favorite, id, created}`), so a field added to the domain type flows through with no repository change.
- `src/stores/favorites.ts:45` — `isRateLimitedError` guards on `instanceof FavoritesRepositoryError`.
- `src/stores/favorites.ts:118,130-170` — the read-only computed, session initialization, and the cache fallback on a cloud read failure.
- `src/stores/favorites.ts:309-389` — the import loop, its rate limiter and its progress counter.
- `src/stores/favoritesUi.ts:27,35,51,55` — the derived artist list, per-artist counts, exact-match filter and name-joined search.
- `AGENTS.md` — the store-responsibility split this plan must not break.
- `pocketbase/pb_migrations/` — five tracked schema migrations, each with a working down function, baked into the Docker image.
- `docs/how-to/pocketbase-setup.md` — the documented procedure for adding a migration.
- `docs/reference/pocketbase-schema.md`, `docs/explanation/architecture.md` — the collection contract and the persistence rules this plan must keep true.

---

## Planning Contract

### Product Contract preservation

Changed, with reasons:

- **R15 removed** (prior revision) — it required scoping the favorites create rule to its owner. Already shipped: `pocketbase/pb_migrations/1788708315_created_favorites.js:5` carries the owner-scoped create rule, and the update rule was hardened in `pocketbase/pb_migrations/1788730000_updated_favorites.js`.
- **R6 and R7 removed from active scope** (prior revision) — renaming and merging move to the deferred list and ship with the artist view. The retired IDs are not reused.
- **This revision removes R9, R10, R11 and R17.** Production holds no favorites to convert, per explicit user direction to skip the read-time conversion, its frozen-snapshot safety net, and any client-side migration job. R9's collapsing behavior is not lost — it is folded into R13, scoped to a single import's population instead of the whole account. R10 ("the conversion reports no summary") and R11 (the conversion's store scope) no longer apply because the mechanism they governed does not exist. R17 (the frozen snapshot) no longer applies because the migration is destructive by decision. R18 is kept, reworded to describe only the import path. The retired IDs are not reused.
- **F3** (the read-time conversion flow) **is retired**; **F4** is added for the import flow that now owns the collapsing behavior.
- **AE4, AE10, AE13, AE14, AE15 and AE16 are retired** — each exercised the read-time conversion or its snapshot, neither of which exists in this revision. **AE18** (majority-spelling election) and **AE19** (concurrent-create race) are added to keep that test intent, retargeted at the import path and the shared create-rejection handling that survive this revision. The retired IDs are not reused.
- **R11 and R16 separated** (prior revision). R16 is the resolution guarantee, which includes the offline cache.
- **R17 restated, then removed by this revision** — see above.
- **R16, R17 and R18 added** (prior revision); R13 gained its no-rename clause. R17 is removed by this revision.
- **KTD3** (the favorite-is-unconverted detection heuristic) **and KTD11** (the frozen-snapshot merge behavior in `LocalFavoritesRepository`) **are retired** along with R17 and the conversion mechanism they served — neither applies once there is nothing to convert or preserve. The retired numbers are not reused.

Everything else keeps its meaning and its ID.

### Key Technical Decisions

- KTD1. **Artist identity is an opaque record id, carried by a multi-value relation field on favorites.** The normalized name is a unique index on the artist record, not the identity, so a rename never has to move a credit from one artist to another. It is not a one-write rename: KTD12 keeps a derived copy of the display name on every favorite, so a rename must also rewrite that column on each favorite crediting the artist. Governs R1, R5.
- KTD2. **The migration is schema-only; no data-conversion job exists.** Artists are populated only by ordinary use (the artist field) and by importing a backup, never by a read-time or server-side migration, because production holds no existing favorites to convert (see Key Decision). Both new migrations keep a working down function like the repo's existing five, and since neither carries data-preservation logic, each down function is a plain drop. Governs R13.
- KTD4. **Normalization is an NFD fold with diacritics stripped, lowercased, trimmed, and inner whitespace collapsed**, stored as a slug and backed by a unique index on owner plus slug. Chosen over a plain lowercase comparison, which leaves accented and unaccented spellings as separate artists — the case the Problem Frame names. Sorting stays on the display name so the list order does not change. Governs R3.
- KTD5. **On a frequency tie within an import's population, the accented spelling wins; if that does not separate the candidates, the spelling sorting first by Unicode code point on the raw name wins.** The second rule is what makes the election a total order — the accent rule decides nothing between two unaccented spellings, or between two differently accented ones, and the winner would otherwise fall out of map iteration order. The population is the importing file only; an existing artist always takes precedence so an import never renames one. Governs R13.
- KTD6. **The resolver splits into a pure part and a per-caller create policy.** Normalize, elect and look up over a supplied index are shared. Creating is not: the artist field needs interactive failure reaching the user, the import needs the shared rate limiter and per-row failure counting. Chosen over one shared create path, which would force one failure posture on both callers.
- KTD7. **A rejected create on the unique index is treated as a find.** Every caller re-reads by slug and reuses the winner, so a race between two sessions, or between the import and the artist field, costs a retry rather than a lost credit. Governs R18, AE19.
- KTD8. **Artist creates share the favorites rate limiter and retry path.** That requires one repository error base, or a structural rate-limit check, because the current guard tests `instanceof FavoritesRepositoryError` and a mirrored artists error type would silently bypass pacing. The import's create pass counts against the same budget as its favorite creates. Governs R18 and the third success criterion.
- KTD9. **The artists store loads from app bootstrap, not from inside the favorites store.** `AGENTS.md` scopes `useAppStore` to bootstrapping and `useFavoritesStore` to favorites; loading a second domain store from favorites would violate that split and add a store edge. Governs R16.
- KTD10. **An artists load failure puts the session in read-only mode rather than showing an empty artist list, through a degradation flag the favorites store owns.** A writable UI over an empty resolution index re-creates artists that already exist server-side and trips the unique index. The repository error type already carries an unused `unavailable` code for exactly this. The mode cannot be forced today — `isReadOnly` is a computed over the repository mode with no setter (`src/stores/favorites.ts:118`), and favorites initialization reassigns that mode — so the favorites store gains a `degradedReadOnly` ref plus a setter, folded into `isReadOnly`, applied after favorites initialization so the selection cannot clear it. Governs R16, R18.
- KTD12. **The favorites column keeps carrying resolved display names, written on every create and update.** It makes the export projection trivial without a live join at export time. It is a derived copy; the relation is the source of truth. The copy has a cost the artist view inherits: a rename must rewrite this column on every favorite crediting the artist, or the export (R12) keeps emitting the old spelling and a re-import resolves it to a second artist. Governs R12, R13.
- KTD13. **One selection call returns both repository pairs and one mode**, including an artists cache repository keyed alongside the favorites cache key. Two independent selections can disagree in a partial-failure window and give cloud favorites with local artists. Read-only enforcement moves into selection, so a cache-mode repository rejects writes structurally instead of through a fourth hand-rolled gate. Governs R16.
- KTD14. **The referenced artist subset and the full loaded set are two derived collections.** Filter list and counts come from what favorites actually reference, which is what makes R8 free; suggestions and resolution come from every loaded artist, or removing an artist's last credit hides it, the user retypes it, and the create hits the unique index. Governs R5, R8.
- KTD15. **The relation field uses `cascadeDelete: false` and `required: false`, and the artists collection's view rule is never null.** With cascade on, deleting an artist that is a favorite's only artist deletes the favorite; with the field required, that delete is rejected instead. A null view rule makes `expand` return nothing for non-superusers. Governs R14.

### High-Level Technical Design

One pure core, two create policies, three stores:

```mermaid
flowchart TB
  AF["Artist field on a mix"] --> CORE["Pure core: normalize, elect, look up"]
  IM["Import"] --> CORE
  AF --> P1["Policy: alert on failure"]
  IM --> P2["Policy: shared limiter, per-row failure"]
  P1 --> SEL["One selection: both repository pairs, one mode"]
  P2 --> SEL
  SEL --> PB["PocketBase artists collection"]
  SEL --> LS["Local-mode store"]
  SEL --> CACHE["Offline cache: mirrored from the artists store"]
```

Both callers run for the life of the app: the artist field on every save, import once per uploaded file.

### Assumptions

- The PocketBase relation and migration APIs are unchanged between the pinned server version and the version the research covered; the relevant APIs have been stable since v0.23.
- A backup import is the worst case for artist-create volume. Ordinary use creates at most a few artists per session.

### Risks

| Risk                                                                                                 | Mitigation                                                                                            |
| ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| An import elects a wrong display name and there is no UI repair path until the artist view ships.    | U1's election is built and reviewed against a fixture (AE18) before it is wired into the import path. |
| Artist creates bypass the rate limiter and repeat the incident that motivated the import retry work. | KTD8 routes every artist create through the shared limiter and retry.                                 |
| Two callers create the same artist at once and race the unique index.                                | KTD7 turns a rejected create into a find.                                                             |
| An artists load failure leaves a writable UI over an empty resolution index.                         | KTD10 puts the session in read-only mode instead.                                                     |

### Sequencing

U1 is pure and unblocks everything. U2 carries the migration and the artists cache key. U3 wires bootstrap and selection. U4 and U5 need U1-U3. U6 tracks whichever unit breaks a test double. U7 lands last.

---

## Implementation Units

### U1. Artist type, normalization, and the pure resolver core

- **Goal:** A pure module that turns a name into a normalized slug, elects a display name from a name multiset, and looks up a slug in a supplied index.
- **Requirements:** R3, R4; supports R2, R13.
- **Dependencies:** none.
- **Files:** `src/types/artist.ts`, `src/utils/artist.ts`, `src/__tests__/artistUtils.spec.ts`.
- **Approach:**
  1. Define the artist shape: id, display name, slug.
  2. Implement normalization per KTD4.
  3. Implement the election as a pure function over a list of names, with the KTD5 tie-break, taking the population as an argument rather than reaching for it.
  4. Expose lookup over a supplied index. No creating, no I/O — the create policies live with their callers per KTD6.
- **Patterns to follow:** `src/utils/url.ts` and `src/utils/favorite.ts` for pure-utility shape and their specs.
- **Test scenarios:**
  - Names differing only by case normalize to the same slug.
  - Names differing only by accents normalize to the same slug.
  - Leading, trailing and repeated inner whitespace collapse to the same slug.
  - Covers AE8. A name that is empty once trimmed produces no slug and is rejected.
  - Covers AE18. Election picks the most frequent spelling among four variants.
  - Election picks the accented form when two spellings tie.
  - Election over two unaccented spellings tied on frequency picks the code-point-first one, per KTD5's second tie-break.
  - Election over the same multiset in a different order returns the same name.
- **Verification:** The utility spec covers every normalization axis in KTD4 and both election rules in KTD5.

### U2. Schema and artists persistence

- **Goal:** The artists collection exists, favorites carry a relation to it, and an artists repository trio mirrors the favorites one.
- **Requirements:** R1, R14, R16.
- **Dependencies:** U1.
- **Files:** `pocketbase/pb_migrations/<timestamp>_created_artists.js`, `pocketbase/pb_migrations/<timestamp>_updated_favorites.js`, `src/services/artistsRepository.ts`, `src/services/localArtistsRepository.ts`, `src/services/pocketbaseArtistsRepository.ts`, `src/services/storage.ts`, `src/types/favorite.ts`, `src/services/favoritesRepository.ts`, `src/services/pocketbaseFavoritesRepository.ts`, `src/__tests__/artistsRepository.spec.ts`.
- **Approach:**
  1. First migration creates the artists collection carrying a display name, a slug, and an `owner` relation to `users` (required, `cascadeDelete: false`), with the five owner-scoped rules copied from the favorites contract, including the owner-reassignment guard, plus a unique index on owner and slug. R4 constrains the user-meaningful fields, not the ownership plumbing every collection carries.
  2. Second migration adds one field to favorites: the relation per KTD15. The existing `artists` text column and its write path are untouched. Name the new column explicitly in the migration and reuse that name everywhere, so the migration and the repository mapping cannot drift; it must not collide with the existing `artists` column.
  3. Both migrations get a real down function, per the convention every file in `pocketbase/pb_migrations/` follows. Per KTD2 each down function is a plain drop — no data to preserve.
  4. Add two artists storage keys mirroring the favorites key scheme, one for local mode and one per authenticated user; do not widen or reuse a favorites key.
  5. Give the artists repositories a `findBySlug`, and share the favorites error base so the rate-limit guard recognises their failures per KTD8. The PocketBase artists repository sets `owner: pb.authStore.model?.id` on create, mirroring `src/services/pocketbaseFavoritesRepository.ts:55`, or every create is rejected by the copied create rule.
  6. Carry the relation through the favorites layer: surface it on the `Favorite` domain type and `FavoriteRecordInput`, and map it explicitly in `PocketBaseFavoritesRepository`'s `list`, `create` and `update`. `LocalFavoritesRepository` needs no change — its `create` and `update` already rebuild each record by spreading the input (`src/services/localFavoritesRepository.ts:37-65`), so the new field flows through automatically. Without this no later unit can derive the referenced-artist subset KTD14 needs.
- **Patterns to follow:** `src/services/favoritesRepository.ts` for interface shape; the existing migrations for dialect and down functions.
- **Test scenarios:**
  - The local repository round-trips an artist through its own storage key.
  - The local repository never writes to a favorites key.
  - A backend create failure surfaces as an error the rate-limit guard recognises.
  - Two artists with the same slug and owner cannot both be created.
  - Covers AE19. `findBySlug` returns the existing artist after a create was rejected by the index.
- **Verification:** Both migrations apply and revert cleanly against an empty database; the repository spec passes.

### U3. Selection, artists store, and bootstrap

- **Goal:** One selection call yields both repository pairs and one mode, and the artists store loads at bootstrap without being able to break it.
- **Requirements:** R16.
- **Dependencies:** U1, U2.
- **Files:** `src/services/favoritesRepository.ts`, `src/stores/artists.ts`, `src/stores/app.ts`, `src/stores/favorites.ts`, `src/__tests__/artists.spec.ts`, `src/__tests__/favorites.spec.ts`.
- **Approach:**
  1. Widen selection to return both pairs and one mode per KTD13, so favorites and artists can never disagree about the mode.
  2. Move read-only enforcement into selection, scoped to `create`, `update` and `delete`: in cache mode those reject writes with the `unavailable` code. `replaceAll` stays writable — it is the cache mirror's own escape hatch, and `initializeForCurrentSession` calls `persistCacheSnapshot()` through it immediately after `list()` in cache mode too, so rejecting it empties the user's offline list. Keep `blockIfReadOnly` in the favorites store as the user-facing gate that raises `messages.offline_read_only`; the repository rejection is a structural backstop behind it, not a replacement.
  3. Add the artists store with an explicit `$reset`, keyed on the same session identity as favorites.
  4. Initialize it from `src/stores/app.ts` before favorites, inside the existing try, per KTD9. Join the sign-out reset site.
  5. Mirror the loaded artists into the artists cache repository after a successful cloud load and after any artist create, on the model of `persistCacheSnapshot()` in `src/stores/favorites.ts`. Nothing else writes that cache, and without it a cache-mode session renders an empty artist sidebar — AE12 would pass only through the denormalized names column, while the identity-derived filter list and counts from U4 render nothing.
  6. On load failure, leave the list empty and put the session in read-only mode per KTD10: the artists store swallows its own load failure and exposes the outcome as a readable result (e.g. a `loadFailed` ref) rather than throwing, so the bootstrap catch that signs the user out is never triggered. Add `degradedReadOnly` and its setter to the favorites store, fold it into `isReadOnly`, and have `src/stores/app.ts` read the artists store's outcome and call the setter immediately after favorites initialization has run, so the repository selection cannot overwrite it. Clear `degradedReadOnly` in `$reset()` and at the start of each `initializeForCurrentSession` call, so a prior session's degraded state can never leak into the next one.
- **Patterns to follow:** `src/stores/favorites.ts` session keying and `$reset`; `src/stores/app.ts` bootstrap and sign-out handling.
- **Test scenarios:**
  - Signing out clears artists along with favorites.
  - Two authenticated users in sequence never see each other's artists.
  - Local mode and an authenticated session keep separate artist sets.
  - A backend failure while loading artists leaves the session read-only and does not sign the user out.
  - The read-only state set by an artists load failure survives favorites initialization rather than being cleared by it.
  - Signing out, or starting a new session, clears a prior session's degraded read-only state.
  - Cache mode rejects an artist create at the repository, and the store guard still raises the offline read-only alert.
  - Cache mode still writes the favorites cache snapshot after a read, and the offline list is not emptied.
  - Covers AE12. Falling back to the cache still resolves every favorite's artist names.
  - The artist filter list is non-empty in cache mode after a prior cloud session mirrored its artists.
- **Verification:** The existing session-isolation and read-only specs still pass, and their artist equivalents pass.

### U4. Wire the UI to artist identity

- **Goal:** The artist field, filter list, search and card work from identity, with no persistence in components.
- **Requirements:** R2, R3, R5, R8. Realizes F1.
- **Dependencies:** U1, U2, U3.
- **Files:** `src/stores/favoritesUi.ts`, `src/stores/favorites.ts`, `src/components/favorites/ArtistTagsInput.vue`, `src/components/modals/FavoriteModal.vue`, `src/components/filters/ArtistList.vue`, `src/components/favorites/FavoriteCard.vue`, `src/i18n/locales/en.json`, `src/i18n/locales/fr.json`, `src/__tests__/ArtistTagsInput.spec.ts`, `src/__tests__/FavoriteCard.spec.ts`, `src/__tests__/favoritesUi.spec.ts`.
- **Approach:**
  1. Keep `ArtistTagsInput.vue` presentational — names in, names out. Resolution and creation happen in `addOrUpdateFavorite`, where the read-only guard, the alert path and the repository already are.
  2. Derive the filter list and counts from what favorites reference; derive suggestions and resolution from every loaded artist. Two collections, per KTD14.
  3. Switch the filter, counts and list keys from name to identity together; the `all` sentinel must stop sharing a value space with artist names.
  4. Deduplicate credits on identity, which closes the same-favorite duplicate case.
  5. Keep the display sort on the name so the list order does not visibly change.
- **Patterns to follow:** the existing v-model contract on `ArtistTagsInput.vue`; the `artist` i18n namespace.
- **Test scenarios:**
  - Covers AE1. Saving a differently-cased known name credits the existing artist.
  - Covers AE7. Saving a name the mix already credits does not credit it twice.
  - Covers AE5. Removing the last credit for an artist drops it from the filter list but leaves it suggestible.
  - Filtering by an artist returns mixes originally typed with different casing.
  - Search still matches on artist name.
  - The card renders resolved names.
  - The tag input spec needs no backend double.
- **Verification:** The grid, filter and modal behave as today for a store with no spelling variants, and merge the variants where they exist.

### U5. Export and import

- **Goal:** The export keeps its shape through a testable projection, and the import resolves and collapses artist names without multiplying writes — the only path that creates artists from existing data, since production starts with none.
- **Requirements:** R12, R13, R18. Realizes F4.
- **Dependencies:** U1, U2, U3.
- **Files:** `src/stores/favorites.ts`, `src/services/favoriteImport.ts`, `src/__tests__/favoriteImport.spec.ts`.
- **Approach:**
  1. Extract the export projection as a pure function so the shape is testable without a DOM.
  2. Resolve every distinct name in the file in one pass before the favorite loop, after the duplicate-URL skip, sharing the import's limiter per KTD8.
  3. Apply KTD5's population: an existing artist wins over the file's election.
  4. Implement it once across both import branches, which currently diverge.
- **Test scenarios:**
  - Covers AE6. A pre-change export imports with no artist-field error.
  - Covers AE9. A file carrying two spellings of one name yields one artist.
  - Covers AE17. Importing a lowercase spelling of an existing artist does not rename it.
  - An import whose rows are all duplicate URLs creates no artists.
  - Exported JSON carries artist names as strings, not identities.
  - An artist create rejected by the rate limit is retried, not counted as a failed favorite.
  - An artist create that fails outright leaves the favorite unimported rather than crediting fewer artists.
  - A row whose artist name is empty once trimmed drops that credit silently, mirroring AE8, rather than counting the favorite as unimported under R18.
  - The existing rate-limit and progress specs still pass unchanged.
- **Verification:** Export, wipe, import reproduces the same artists and credits.

### U6. Test doubles and fixtures

- **Goal:** The doubles tell the two collections apart, and the browser fixtures still pass with favorites that predate the relation field.
- **Requirements:** supports R13, R16.
- **Dependencies:** U2, U4.
- **Files:** `src/__tests__/mocks/pocketbase.ts`, `e2e/fixtures/demoFavorites.ts`, `e2e/favorite-creation.spec.ts`, `e2e/demo.spec.ts`.
- **Approach:**
  1. Key the PocketBase double by collection name so a queued response cannot fire on the wrong collection.
  2. Keep the reset helper's contract; the specs queuing responses in sequence are the fragile part.
  3. Leave the browser fixtures in the old shape deliberately — they simulate local-mode data untouched by this feature — and confirm the demo flow still passes without those items needing to appear in the identity-derived artist filter.
- **Test scenarios:**
  - A response queued for one collection does not satisfy a call to the other.
  - The reset helper clears both collections' state.
  - The demo e2e spec still passes: filtering by a newly created artist still hides the old-shape favorites, and the old-shape favorites still render their names on their cards through the untouched text column.
- **Verification:** The unit suite passes with no spec relying on the shared-double behaviour, and the browser tests pass against old-shape fixtures.

### U7. Documentation, decision record, and changelog

- **Goal:** The schema, architecture, agent instructions and changelog describe what shipped, and the architectural choice is recorded.
- **Requirements:** none directly; required by the repo's documentation rules.
- **Dependencies:** U2, U3, U5.
- **Files:** `docs/reference/pocketbase-schema.md`, `docs/explanation/architecture.md`, `docs/how-to/pocketbase-setup.md`, `docs/journal/decisions/0002-artists-as-a-first-class-record.md`, `AGENTS.md`, `CHANGELOG.md`.
- **Approach:**
  1. Add the artists collection and its rules to the schema reference, plus the relation column on favorites.
  2. Record the artists store, the widened selection and the cache mirroring in the architecture explanation, including why the cache is mirrored from the artists store rather than populated independently.
  3. Fix the setup guide's update rule, stale against the shipped owner-reassignment guard, and add the artists collection to its field list.
  4. Write the decision record for artists-as-a-record, the derived-name column KTD12 keeps on favorites, and the decision to ship a destructive schema-only migration since production holds no data yet — the repo requires an ADR for a lasting architectural choice.
  5. Update the store, repository and storage-key lists in `AGENTS.md`, which enumerate all three.
  6. Add a changelog entry.
- **Test expectation:** none — documentation only.
- **Verification:** `npm run check:docs` passes, the new decision record is numbered and indexed, and every relative link resolves.

---

## Verification Contract

| Gate                            | Command                                                                                                                                                                                                       | Applies to                                    |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| Type check                      | `npm run type-check`                                                                                                                                                                                          | every unit                                    |
| Format                          | `npx prettier --check .`                                                                                                                                                                                      | every unit, including the new migrations      |
| Lint                            | `npx eslint .`                                                                                                                                                                                                | every unit                                    |
| Unit tests                      | `npm run test:unit -- run`                                                                                                                                                                                    | U1-U6                                         |
| One spec                        | `npx vitest run src/__tests__/<file>.spec.ts`                                                                                                                                                                 | while iterating                               |
| Browser tests                   | `npm run test:e2e`                                                                                                                                                                                            | U4, U6                                        |
| Demo GIF                        | `npm run test:demo`                                                                                                                                                                                           | U6, only if artist rendering changed visually |
| Docs gate                       | `npm run check:docs`                                                                                                                                                                                          | U7                                            |
| Migrations, forward and reverse | `cd pocketbase && ./pocketbase serve`, then `./pocketbase migrate down 2` against the empty database, confirming both down functions run without error                                                        | U2                                            |
| Artists API rules               | with two accounts against a local server, confirm the second account cannot list, view, update or delete the first account's artist record, and cannot create an artist carrying the first account's owner id | U2                                            |

---

## Definition of Done

- Every requirement in the Product Contract is met or explicitly deferred in Scope Boundaries.
- Every gate in the Verification Contract passes on the branch.
- The PocketBase image carrying both migrations is deployed and healthy before the app image is rolled out. The two images deploy independently and nothing enforces the order; app-first leaves every cloud session read-only until the backend catches up, because KTD10 turns a missing artists collection into a read-only session. Backend-first is safe — the new column is optional and the old client ignores it.
- Both migrations apply and revert cleanly against an empty database.
- A JSON export taken from the pre-migration app imports cleanly after the migration ships, creating one artist per normalized spelling and crediting every favorite in the file.
- The offline read-only path attempts no write, and still resolves artist names.
- No artist create bypasses the shared rate limiter.
- Both locales carry every new string.
- Abandoned approaches leave no dead code, unused helpers, or commented-out blocks in the diff.

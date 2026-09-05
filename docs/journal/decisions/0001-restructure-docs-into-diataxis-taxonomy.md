---
status: accepted
date: 2026-09-03
decision-makers: [baptiste-pasquier]
---

# Restructure `docs/` into a Diátaxis + journal taxonomy

## Context and Problem Statement

`docs/` had grown to nine flat files plus `docs/brainstorms/` and `docs/plans/`, with no
index and a 20.6:1 added-to-removed line ratio since December 2025. Reference, how-to, and
explanation content were interleaved per file, one fact (the legacy `favorites` localStorage
key migration) was stated verbatim in three files, and two `docs/plans/` entries described
already-shipped features (`deploy.yml`, `e2e/favorite-creation.spec.ts`) while still carrying
a "ready for planning" status.

A second question sat inside the same restructure: the taxonomy comes with a CI gate
(`scripts/check_docs.py` in the skill this taxonomy is based on), and the project otherwise
has no Python anywhere in its stack (see `AGENTS.md`) — only Node/TypeScript.

## Decision Drivers

- No documentation gate existed; the pile could keep growing unchecked
- A gate installed after a restructure tends never to get installed at all
- The reference `check_docs.py` is what the skill maintains and tests; a hand-written port in
  another language can drift from it, silently, as the skill's rule set changes

## Considered Options

- Keep the flat structure and rely on review discipline
- Adopt a Diátaxis-quadrant + append-only-journal taxonomy (this skill's design), gated in CI
- Adopt the taxonomy but skip the CI gate
- For the gate itself: port `check_docs.py` to Node/ESM (matching the project's stack) versus
  adopt the reference Python script directly

## Decision Outcome

Chosen option: adopt the taxonomy and gate it with the skill's reference
`scripts/check_docs.py`, run via `python3`.

A Node/ESM port (`scripts/check-docs.mjs`) was tried first, to avoid adding Python to an
all-Node project. It was replaced with the reference script directly at the project owner's
request, favoring an implementation that tracks the skill's rule set exactly over one that
matches the project's existing stack.

- `docs/explanation/`, `docs/how-to/`, `docs/reference/`, `docs/conventions/` hold maintained
  prose; `docs/journal/{decisions,plans,ideation}/` hold dated records, never cited as truth
- `docs/brainstorms/` and `docs/plans/` moved to `journal/ideation/` and `journal/plans/`,
  marked `status: shipped`
- No `docs/BACKLOG.md`: no buried backlog items were found, and GitHub Issues stays the sole
  tracker
- `scripts/check_docs.py` is copied from the skill, adapted only in its `CONFIGURATION` block
  (`ROOT_ALLOWED_EXTRA = {"demo.gif"}`, `GENERATED_BACKLOG_HEADER = None`,
  `SECOND_LANGUAGE_MARKERS = None`, `CATEGORY_KEY = None`, `FILLER` trimmed to its English
  phrases)
- `scripts/check_docs.py` has no third-party dependency: frontmatter is parsed by a
  stdlib-only parser built into the script, not PyYAML
- `npm run check:docs` runs `python3 scripts/check_docs.py`; the Husky pre-commit hook runs it
  when a staged file is under `docs/`; CI (`ci.yml`) adds a Python setup step and runs
  `npm run check:docs` as its own step

### Consequences

- Good, because a new paragraph now has exactly one correct home, checked in CI and
  pre-commit
- Good, because the checker tracks the skill's reference implementation exactly; a future
  rule change is a file copy plus a `CONFIGURATION` diff, not a re-port
- Good, because the script needs no pip dependency — only a `python3` interpreter, which
  keeps the added toolchain surface to one language runtime rather than one runtime plus a
  package to install and cache
- Bad, because this is now the only Python file in an otherwise pure Node/TypeScript project,
  so contributors need `python3` to run the pre-commit hook locally, and CI needs a Python
  setup step it didn't need before

### Confirmation

`scripts/check_docs.py`, run via `npm run check:docs` in the Husky pre-commit hook and as its
own step in CI.

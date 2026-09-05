---
title: Documentation conventions
type: conventions
audience: [agent, human]
status: stable
stale_after: 2026-12-05
---

# Documentation conventions

**Scope: the prose in `docs/`.**

## Placement

The routing table lives in [`../README.md`](../README.md) and is not repeated here. Run the
compass on **the paragraph**, not on the file you happen to have open. That is what stops a
paragraph landing in a doc merely because that doc was already open.

### Never narrate an incident in a maintained doc

A passage that recounts a past attempt, a failure, or a measured symptom does not belong in
`how-to/`, `reference/` or `conventions/`. CI fails on one there.

`explanation/` is the exception, and CI only warns: explaining why the code is shaped this
way sometimes needs the attempt that failed. What still does not belong there is the **full
write-up** — symptoms, measurements, a traceback. That is a journal entry, and the
explanation links it.

`journal/` is exempt outright. Recording what failed is what it is for.

Markers: `used to`, `we tried`, `before this fix`, `an earlier version did X`,
`3 attempts out of 4`.

Write it as a `journal/solutions/<slug>.md` entry (created on its first use — there is none
yet). Leave behind **the distilled rule, one or two sentences, plus a link**.

### What stays inline

A hard-won **invariant** is explanation, not an incident. It stays.

The test: **would a reader who never saw the bug still need this to work on the code?** Yes
means it is explanation. No means it is a journal entry.

### Never write a backlog

No TODO section, no "future work", no "not yet implemented" list anywhere in `docs/`.
Unbuilt work lives in the issue tracker and nowhere else — `gh issue list --label backlog` to
read it, `gh issue create --label backlog` to add an item, and **link the issue** from the
doc rather than describing the missing work. This project keeps no mirror of it in `docs/`:
`main` has no branch protection, so a mirror-refreshing workflow could push here, but there
is currently nothing to mirror (zero issues in the tracker). Revisit if that changes — see
`references/backlog.md` in the `docs-taxonomy` skill for the mirror's design.

A `TODO` comment in a source file is fine, and a doc may point at one. What is banned is a
**list of unbuilt work** inside prose, because nothing ever prunes it.

### Record a lasting choice as a decision

A library choice, a pattern, a schema shape with cross-cutting consequences: write an entry
in [`journal/decisions/`](../journal/decisions/README.md). An accepted decision is never
edited — a change adds a new entry marking the old one superseded.

### Read before you fix

Before implementing a fix or a non-obvious behaviour change, check `journal/solutions/` (once
it has entries) for one in the relevant area. That store exists so the same wall is not hit
twice.

## Prose

These rules govern documentation prose. They are what keeps a doc legible once the incident
narratives are gone.

### Lead with the conclusion

The rule or the fact leads the paragraph. Justification and mechanism follow. A reader who
stops after the first sentence still has the point.

### One claim per paragraph

A paragraph that argues two things splits into two.

This is the anti-accretion mechanism, and it is why the rule exists rather than a line
limit. A single-claim paragraph is individually replaceable: the next writer edits it or
deletes it. A multi-claim paragraph resists that, so the next writer appends a third claim,
and the paragraph grows instead of changing.

### No filler, no hedging

Every sentence carries a fact, a rule, or a pointer.

Banned openers, checked by CI: `it is worth mentioning that`, `it should be noted that`,
`it is important to note that`, `as mentioned previously`.

Delete a hedging adverb — `arguably`, `somewhat`, `possibly`. Uncertainty is different from
hedging: state it as a fact about what is known.

### Prefer a table to enumerative prose

Three or more cases in one sentence become a table. `reference/pocketbase-schema.md`'s field
table is the pattern to copy.

## Language

**English.** All of `docs/`, the journal included. Renaming a symbol or a URL to match is
never required — quote it verbatim inside backticks.

## Frontmatter

Every maintained doc (`explanation/`, `how-to/`, `reference/`, `conventions/`):

```yaml
---
title: Title
type: explanation | how-to | reference | conventions
audience: [human, agent]
status: draft | stable | deprecated
stale_after: YYYY-MM-DD
---
```

`stale_after` is an absolute date rather than a `last_reviewed` one on purpose: a review date
has to be remembered, and an expiry announces itself. When one fires, re-date the doc or fix
what drifted. It warns and never fails, because a shared expiry date would otherwise redden
every unrelated PR on one day.

`journal/decisions/` uses [MADR](https://adr.github.io/madr/) frontmatter instead.
`journal/plans/` and `journal/ideation/` keep the `title`/`date`/`type`/`origin`/`status`
schema they already use.

## Every `conventions/` file states its scope

Line one of the body, before anything else: what artifact this file governs. There is one
other file in this family today, [`frontend-layout.md`](./frontend-layout.md), which governs
the favorites responsive layout rather than documentation prose — a reader must never have
to infer which file governs what.

## Review

**A pull request that adds prose to a maintained doc says what it removed, or why nothing
needed removing.**

This is the compensation for the size check being a warning rather than a failure. Growth is
not the defect on its own; growth that nobody looked at is.

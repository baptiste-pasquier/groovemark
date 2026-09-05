# `journal/decisions/` — architectural decision records

One architectural choice per entry, in [MADR 4.0.0](https://adr.github.io/madr/) format.

Path: `journal/decisions/NNNN-title-with-dashes.md` — `NNNN` a consecutive four-digit
number, the title lowercase and dash-separated.

## An accepted decision is never edited

A decision that changes gets a **new** entry. The new entry says what it supersedes; the old
entry's `status` becomes `superseded by ADR-NNNN`. Nothing is deleted.

## When to write one

A library choice, an architectural pattern, or a schema shape with cross-cutting
consequences — something a future reader would otherwise have to reverse-engineer from the
code and would reasonably question.

Not a bug fix (that is `journal/solutions/`, created on its first entry), and not an
implementation plan (that is [`../plans/`](../plans/)).

## Template

```markdown
---
status: 'proposed | rejected | accepted | deprecated | superseded by ADR-0123'
date: YYYY-MM-DD
decision-makers: [who decided]
consulted: [who was asked] # optional
informed: [who was told] # optional
---

# Short title, naming the problem and the chosen solution

## Context and Problem Statement

## Decision Drivers <!-- optional -->

## Considered Options

## Decision Outcome

### Consequences <!-- optional -->

### Confirmation <!-- optional -->
```

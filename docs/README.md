# GrooveMark documentation

Start here. This file is the map, and it carries the one rule for deciding where a new
paragraph goes.

## Two axes

**Lifecycle first.** Is this text _maintained_, or is it a _dated record_?

- The folders below the line are **maintained**. They are edited, pruned, and kept true.
  They are the sources of truth.
- `journal/` is **append-only**. Entries are dated, never revised, and **never cited as
  truth**. A maintained doc may link a journal entry; a journal entry never governs code.

**Then, for maintained text, the [Diátaxis](https://diataxis.fr/) quadrant.**

| Folder                         | The question it answers                  | Shape                               |
| ------------------------------ | ---------------------------------------- | ----------------------------------- |
| [`explanation/`](explanation/) | _Why does it work this way?_             | Narrative allowed. Human-first.     |
| [`how-to/`](how-to/)           | _How do I reach this goal?_              | Numbered steps.                     |
| [`reference/`](reference/)     | _What is true?_                          | Tables and contracts. No narrative. |
| [`conventions/`](conventions/) | _What must I do when I write?_           | Imperative, checkable. Agent-first. |
| [`journal/`](journal/)         | _What happened, and what did we decide?_ | Dated records.                      |

There is no `tutorials/` folder — Diátaxis's fourth quadrant is real, but nothing here is a
tutorial yet, and an empty quadrant invites the wrong thing to fill it. It gets a folder when
the first tutorial is written.

## Where does this paragraph go?

The **Diátaxis compass**, two questions in order. It works at paragraph scale, which is the
scale at which docs actually drift.

| The content…          | …serves the reader…              | …belongs in                             |
| --------------------- | -------------------------------- | --------------------------------------- |
| informs **action**    | **applying** a skill (working)   | `how-to/`                               |
| informs **action**    | **acquiring** a skill (studying) | a tutorial — we have none, so `how-to/` |
| informs **cognition** | **applying** a skill (working)   | `reference/`                            |
| informs **cognition** | **acquiring** a skill (studying) | `explanation/`                          |

Four extensions, for text that is not about the product:

| The paragraph…                                          | goes to              | never to            |
| ------------------------------------------------------- | -------------------- | ------------------- |
| tells a future writer or agent what to do               | `conventions/`       | `explanation/`      |
| recounts what was tried, what failed, what was measured | `journal/solutions/` | anywhere maintained |
| records a choice between options                        | `journal/decisions/` | `explanation/`      |
| names something not built yet                           | a GitHub issue       | prose, anywhere     |

**The rule that keeps this from sprawling:** a maintained doc states the rule **once** and
links the journal entry for the evidence. It does not retell the story.

Full rules, including how to write the sentence itself:
[`conventions/documentation.md`](conventions/documentation.md).

## The index

Every maintained doc appears here. A doc missing from this list fails CI.

### `explanation/`

- [`architecture.md`](explanation/architecture.md) — bootstrap flow, app states, persistence
  model, events and performances, navigation, backup flow

### `how-to/`

- [`development.md`](how-to/development.md) — local setup, commands, editor tooling
- [`docker-deployment.md`](how-to/docker-deployment.md) — Docker Compose deployment,
  configuration, CI/CD, troubleshooting
- [`authentication-setup.md`](how-to/authentication-setup.md) — Google SSO and local mode
  setup, troubleshooting, security practices
- [`pocketbase-setup.md`](how-to/pocketbase-setup.md) — PocketBase install, collection, API
  rule and batch-endpoint setup
- [`demo-preview.md`](how-to/demo-preview.md) — regenerating the README demo GIF

### `reference/`

- [`pocketbase-schema.md`](reference/pocketbase-schema.md) — fields and API rules for the
  `favorites`, `artists`, `events` and `performances` collections, instance settings, value
  shapes on read, storage keys
- [`responsive-layout.md`](reference/responsive-layout.md) — layout tokens, shell width
  formulas, breakpoint behavior, destination switcher, artist page, artists table

### `conventions/`

- [`documentation.md`](conventions/documentation.md) — where a paragraph goes, and how to
  write it. Governs the prose in `docs/`
- [`frontend-layout.md`](conventions/frontend-layout.md) — governs editing the favorites
  responsive layout (Vue templates and layout tokens)

### `journal/`

- [`decisions/`](journal/decisions/) — one architectural choice per entry, MADR format. An
  accepted decision is never edited
- [`solutions/`](journal/solutions/) — what broke, what was tried, what the measurement said
- [`ideation/`](journal/ideation/) — exploration that fed a spec or a plan
- [`plans/`](journal/plans/) — implementation plans, kept for provenance
- `specs/` — the approved design a plan implements. Created on its first use; there is none
  yet

Template: [`decisions/README.md`](journal/decisions/README.md).

A plugin's dated artifacts land in these categories and nowhere else — the redirect is in
[`../AGENTS.md`](../AGENTS.md), and `docs/superpowers/` fails check 1 below as an unknown
folder. Each artifact keeps its own filename and frontmatter; only the directory is ours.

## Not in this tree

| What                        | Where                                               | Why                                                                       |
| --------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------- |
| Unbuilt work                | GitHub Issues                                       | No backlog mirror is kept in `docs/` — see `conventions/documentation.md` |
| PocketBase server internals | [`pocketbase.io/docs`](https://pocketbase.io/docs/) | Third-party, owned upstream                                               |

## What CI enforces

`scripts/check_docs.py` runs in the Husky pre-commit hook and as its own step in CI
(`npm run check:docs`). It needs only a `python3` interpreter -- no pip dependency, no
PyYAML. It fails on:

1. a file whose `type` frontmatter does not match its folder, or a file in an unknown folder
2. missing or invalid frontmatter — a key present but empty counts as missing
3. a relative link, or a `#fragment`, that does not resolve
4. a maintained doc missing from the index above
5. past-tense incident narration in `reference/`, `conventions/` or `how-to/`
6. a banned filler phrase
7. a section headed `TODO`, `Backlog`, `Future work`, `Roadmap` or `Open questions`
8. a filename that is not kebab-case, or a decision record not named `NNNN-with-dashes.md`
9. a `conventions/` file that does not open with a `Scope:` line
10. a loose, unrecognized file at the root of `docs/` (only `README.md` and `demo.gif` are
    allowed there)

It **warns**, without failing, on: incident narration in `explanation/`, a maintained doc
past 150 prose lines (`reference/`: 250), and a `stale_after` date that has passed. Neither
of the last two ever fails, because neither depends on the change under review — a shared
expiry would otherwise redden every unrelated PR on the day it fires.

`docs/journal/` is exempt from checks 5, 6 and 7. It is append-only: an entry records what
was measured, in the words used at the time, and cannot be corrected into compliance later.

See [ADR-0001](journal/decisions/0001-restructure-docs-into-diataxis-taxonomy.md) for why
this taxonomy was adopted, and why the gate is the skill's reference `check_docs.py`.

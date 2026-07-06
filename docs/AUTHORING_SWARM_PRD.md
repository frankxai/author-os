# AuthorOS Authoring Swarm PRD

Status: active draft
Owner: AuthorOS product
Date: 2026-07-05

## Product Summary

AuthorOS Authoring Swarm is the governed writing-team layer for Starlight, FrankX, Arcanea, AuthorOS, and future client/product surfaces.

It gives every project a way to:

- discover all writing artifacts;
- classify each artifact by domain, team, and risk;
- install standards and locked-state files;
- route work to specialist authoring skills;
- verify claims before public publishing;
- protect brand voice, positioning, legal claims, canon, and community promise;
- expose status to cockpits and command centers.

The product should feel like an editorial command system, not a chat prompt collection.

## Problem

The Starlight estate contains many kinds of writing:

- public websites;
- product and offer copy;
- social/media drafts;
- books and worldbuilding;
- technical docs;
- policy/legal text;
- agent instructions and skills;
- community challenges and onboarding.

Without a governed authoring system:

- cheap or generic agents can flatten premium voice;
- high-risk claims can slip into public copy;
- standards drift across repos;
- brand positioning gets rewritten ad hoc;
- social/offer writing can become manipulative instead of trust-building;
- command centers cannot see writing quality, risk, or queue state.

## Users

### Frank

Wants the estate to write with intelligence, style, depth, proof, and taste while staying safe and inspectable.

### Coding Agents

Need deterministic routing, standards, locked-state files, and report formats so they know when to inventory, critique, rewrite, verify, or escalate.

### Authoring Specialists

Need skill packs, rubrics, and artifact context to produce consistent reviews or drafts.

### Future Operators

Need dashboards and queue state that show what is being reviewed, blocked, approved, or ready.

## Goals

1. Make authoring work discoverable across repos.
2. Route work to the right team and risk gate.
3. Protect locked state from unauthorized rewrites.
4. Make quality measurable through a shared rubric.
5. Make claim verification a first-class workflow.
6. Create reusable skills and templates that work across Codex, Claude Code, Copilot, Cursor, Cascade, and future agents.
7. Feed command-center surfaces with structured authoring telemetry.

## Non-Goals

- No autonomous publishing.
- No live social posting.
- No legal advice without human review.
- No hidden model memory as source of truth.
- No broad rewrite across repos without inventory and approval.
- No production deployment or PR opening from this PRD alone.

## Core Requirements

### R1: Repo Inventory

The CLI must scan a repo and emit:

- artifact path;
- title;
- extension;
- domain classification;
- assigned team;
- risk level;
- locked-state status;
- word count;
- signal counts for money, numbers, legal terms, source markers, hype, and AI tics;
- recommendations.

### R2: Estate Inventory

The CLI must read the estate manifest and scan selected lanes with limits:

```bash
author-os authoring inventory --estate --lanes site,frankx --limit-repos 12 --max-files 500
```

The output must summarize by lane, team, risk, repo, and priority artifacts.

### R3: Standards Bootstrap

The CLI must install authoring standards into a target repo:

```bash
author-os authoring init --repo .
```

It must:

- copy templates without overwriting by default;
- create `reports/authoring/`, `reports/authoring/council/`, and `reports/authoring/evals/`;
- add or update an `authoros.json` `authoring` block;
- support `--dry-run`, `--force`, and `--json`.

### R4: Skill Pack

The repo must include initial skills:

- `authoring-inventory`
- `website-narrative-review`
- `claim-verification`
- `offer-positioning-review`
- `council-synthesis`

Each skill must state:

- trigger;
- required context;
- procedure;
- output format;
- guardrails.

### R5: Locked State

Templates must exist for:

- `BRAND_VOICE_LOCKED.md`
- `POSITIONING_LOCKED.md`
- `LEGAL_CLAIMS_LOCKED.md`
- `COMMUNITY_PROMISE_LOCKED.md`
- `AUTHORING_STANDARD.md`
- `WRITING_EVAL_RUBRIC.md`
- `AUTHORING_PROJECT_BRIEF.md`

Agents may propose changes to locked files but must not mutate them unless explicitly approved.

### R6: Reporting

Reports should be saved under:

```text
reports/authoring/
  inventory.json
  council/
  evals/
```

Future cockpit ingestion must not require scraping terminal output.

## Success Metrics

| Metric | Target |
|---|---:|
| Repo inventory runtime on medium repo | under 30 seconds |
| Estate sample scan | at least 2 repos without errors |
| Inventory output schema stability | 100% deterministic required fields |
| Standards init dry run | no filesystem mutation |
| Standards init overwrite incidents | 0 |
| Locked-state direct mutation by skill | 0 |
| Test suite | passing |
| Public copy claim verification false confidence | 0 known cases |

## Release Criteria For v0

- `npm test` passes.
- `author-os authoring init --repo . --dry-run --json` works.
- `author-os authoring inventory --repo . --json` works.
- `author-os authoring inventory --estate --lanes site --limit-repos 2` works.
- Initial PRD, user flows, metrics, templates, and skills exist.
- Cross-agent rollout packet exists in `starlight-agent-config`.

## Risks

| Risk | Mitigation |
|---|---|
| Scanner over-classifies artifacts | Treat v0 as routing suggestion, not final truth. |
| Too many risk items create noise | Add filters and priority scoring in v1. |
| Locked files become stale | Add standards drift checks and review cadence. |
| Agents copy templates into wrong repos | Require `--repo` display and `--dry-run` for first pass. |
| Legal copy appears "approved" because scanned | Always label legal/policy as human-required. |

## Next Version

v1 should add:

- `authoring review`;
- `authoring claims`;
- `authoring standards doctor`;
- cockpit panel ingestion;
- model-council report format;
- hook integration for locked-state protection.

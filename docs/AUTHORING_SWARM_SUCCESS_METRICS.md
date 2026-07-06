# Authoring Swarm Success Metrics

## North Star

Public and strategic writing becomes more intelligent, trustworthy, stylish, and measurable while agent rewrites become safer and more observable.

## Product Metrics

| Metric | v0 Target | Evidence |
|---|---:|---|
| Repo inventory works | 1 repo | CLI JSON output |
| Estate inventory works | 2+ repos | CLI summary output |
| Standards bootstrap dry-run works | 100% | CLI JSON output |
| Standards bootstrap skips existing files by default | 100% | CLI output |
| Initial skills available | 5 skills | `skills/*/SKILL.md` |
| Templates available | 7 templates | `templates/authoring/*.md` |
| Tests pass | 100% | `npm test` |

## Quality Metrics

| Metric | v0 Target | Notes |
|---|---:|---|
| Important public artifacts scored | tracked, not enforced | v1 cockpit panel |
| Ship threshold for premium surfaces | 90/100 | human review for high-stakes |
| Unsupported legal/claims published | 0 | human-required risk bucket |
| Locked-state unauthorized edits | 0 | future hook enforcement |
| AI-tic markers in final copy | trending down | scanner signal, not final score |

## Operational Metrics

| Metric | v0 Target |
|---|---:|
| Time to first repo inventory | under 2 minutes |
| Time to first standards bootstrap | under 2 minutes |
| Time for future agent to understand authoring contract | under 5 minutes |
| Broad rewrite attempts without inventory | 0 |
| Report files saved under expected path | 100% when `--save` used |

## Council Metrics

| Metric | Target |
|---|---:|
| Council packet includes locked files read | 100% |
| Council synthesis preserves dissent | 100% |
| Council recommends direct locked-state mutation | 0 |
| Council output includes next prompt/task | 100% |

## Command Center Metrics

| Panel | Required Data |
|---|---|
| Authoring inventory | repo, artifact count, domains, teams, risks |
| Active authoring queue | task id, repo, team, risk, owner, status |
| Council reviews | score, dissent, decision, required fixes |
| Claims ledger | claim, source, status, risk, last verified |
| Standards drift | missing brief, missing rubric, missing locked files |

## Current v0 Evidence

As of 2026-07-05:

- `author-os authoring inventory --repo . --json` works.
- `author-os authoring inventory --estate --lanes site --limit-repos 2` works.
- `npm test` passes.
- The first estate sample found public-surface, brand-positioning, high, and human-required buckets.

## v1 Success Definition

AuthorOS v1 is successful when:

1. A public website repo can be initialized with standards.
2. Inventory finds high-risk copy.
3. A reviewer skill produces a score and patch proposal.
4. Claim verification blocks unsupported claims.
5. Council synthesis picks a next pass.
6. The cockpit shows the result without reading terminal logs.

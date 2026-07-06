---
name: authoring-inventory
description: Read-only inventory and classification of writing artifacts across a repo or estate. Use before broad rewrites, standards audits, authoring-team routing, website copy audits, offer audits, social/content audits, legal-copy audits, or command-center authoring visibility work.
license: MIT
---

# Authoring Inventory

You are a read-only authoring auditor. Your job is to discover what writing exists, classify it, assign the right authoring team, and identify risk. You do not rewrite content in this skill.

## Required Inputs

- Repository root or estate manifest.
- Relevant `AGENTS.md`.
- `authoros.json` if present.
- Existing authoring standards or locked files if present.

## Procedure

1. Read repo-local instructions.
2. Run the AuthorOS inventory command when available:

```bash
author-os authoring inventory --repo . --json
```

For estate work:

```bash
author-os authoring inventory --estate --lanes site,frankx,arcanea --json
```

3. Classify artifacts by domain:
   - website
   - offer
   - social
   - book
   - documentation
   - research
   - legal
   - brand
   - community
4. Assign team:
   - `website-narrative`
   - `offer`
   - `social-media`
   - `book`
   - `documentation`
   - `research`
   - `legal-and-policy`
   - `brand-voice`
   - `community`
   - `editorial-triage`
5. Flag risk:
   - `locked-state`
   - `human-required`
   - `high`
   - `claim-verification`
   - `brand-positioning`
   - `public-surface`
   - `technical-accuracy`
   - `normal`
6. Produce a report. Do not edit files unless the user explicitly asks for standards installation or follow-up implementation.

## Output

```json
{
  "scope": "repo|estate",
  "artifactCount": 0,
  "teamCounts": {},
  "riskCounts": {},
  "priorityArtifacts": [],
  "missingControls": [],
  "recommendedNextTasks": []
}
```

## Guardrails

- Do not mutate files during inventory.
- Do not summarize private secrets.
- Do not infer legal compliance from file names alone.
- If an artifact has legal, pricing, health, financial, or performance claims, route it to claim verification and human review.

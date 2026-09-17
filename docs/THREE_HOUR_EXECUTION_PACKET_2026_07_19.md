# Agentic Author OS Three-Hour Execution Packet

Date: 2026-07-19
Controller: Codex
Repo: `C:\Users\frank\starlight\repos\author-os`
Branch: `codex/author-os-preview`
Remote: `https://github.com/frankxai/author-os.git`
Lane verification: PASS via `node C:\Users\frank\starlight\tools\verify-lane.mjs C:\Users\frank\starlight\repos\author-os`

## Current Posture

Machine admission for overnight/swarm work is HOLD: `pp preflight --workload overnight` reported CPU at 88 percent against the 60 percent overnight ceiling, PP posture `constrain`, and 8 dev-server processes already active. Do not start local swarms, new builds, browser QA, or additional dev servers until PP is retried and admits the workload.

The repo has existing uncommitted work in `bin/quality-check.js`. Treat it as an active prior-agent/user edit. Do not revert it. Avoid overlapping edits unless explicitly taking ownership of the quality gate lane.

The AuthorOS preview is already meaningfully advanced:

- Hosted cockpit preview is available at `https://author-31sappz0y-starlight-intelligence.vercel.app`.
- Core verification previously passed with zero live endpoint blockers and five warnings.
- Vercel project is `author-os` / `prj_egkMJ3M6ew4hLvx3vm0pwVUSrvEj`, team `team_q6LNT6rnFRlqlcjBJ2Wxz6PE`.
- Remaining production blockers are provider setup and human-owned secrets, not missing app surface.

## Known Production Blockers

Required values still missing in both preview and production:

- `CLERK_SECRET_KEY`
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `AUTHOROS_MCP_AUTHORIZATION_SERVER_URL`
- `POSTGRES_URL`
- `BLOB_READ_WRITE_TOKEN`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `STRIPE_PRICE_PRO_LOCAL`
- `STRIPE_PRICE_CLOUD_CREATOR`
- `STRIPE_PRICE_CLOUD_STUDIO`
- `STRIPE_PRICE_AGENCY_SMALL_PRESS`
- `AI_GATEWAY_API_KEY`

Do not invent or print secret values. Provider dashboards, Stripe products/prices, Clerk app config, Postgres/Blob provisioning, AI Gateway key creation, and production promotion remain human-gated.

## Three-Hour Portfolio

Cap the active portfolio at three lanes. Each lane must produce a file artifact and a resultRef. A task invocation, model output, or generic status update is not progress.

### Lane A: Production Readiness Env Dossier

Queue id: `1cdfade4-3e5b-4810-a309-8965fe14e877`
Priority: 2

Outcome: a sanitized provider/env setup dossier for the 13 missing required values.

Artifact contract:

- Map each env var to provider, dashboard/source owner, setup step, validation command, and blocker state.
- Include only variable names and scopes, never secret values.
- Include the next command sequence for local and Vercel validation.
- Include exact human-gated actions.

Verification:

```powershell
author-os cloud-env --require-ready --env-file .env.local
author-os production-evidence --env-file .env.local --remote-env-audit --preview-branch authoros-preview --require-ready --save
```

Allowed now: report-only documentation.
Blocked until PP/provider readiness: Vercel env writes, provider changes, deploys, money actions.

### Lane B: MCP And Agent Install Proof

Queue id: `814151c1-96a0-4954-a0f1-9a4179e02fb0`
Priority: 3

Outcome: install-proof matrix for Codex, Claude App via MCP, local CLI, and hosted cockpit.

Artifact contract:

- Prove client config generation path for local, hosted, and both modes.
- Document scopes and auth expectations for hosted MCP.
- Summarize hosted JSON-RPC capability surface: tools, resource templates, prompts, and OAuth protected-resource metadata.
- Explain how Codex/Claude should use AuthorOS: local project filesystem plus remote cockpit MCP, with approval-required actions for revisions/exports.

Verification:

```powershell
author-os mcp --client-config --mode local --host claude --save .authoros/mcp-client-config.json
author-os mcp --client-config --mode both --host codex --url https://author-31sappz0y-starlight-intelligence.vercel.app --token-env AUTHOROS_MCP_TOKEN
npm run verify:live -- https://author-31sappz0y-starlight-intelligence.vercel.app
```

Allowed now: read-only proof matrix.
Blocked: global MCP registration, token creation, secret storage, production deployment.

### Lane C: Offer OS Packaging And First-Pack Readiness

Queue id: `cd138838-8c67-4e9b-8b61-d5934d1d0c64`
Priority: 3

Outcome: commercial packaging plan turning open core into the first sellable AuthorOS/Arcanea offer.

Artifact contract:

- Founder lifetime local: exact promise, exclusions, install flow, support boundary.
- Cloud Creator, Cloud Studio, Agency/Small Press: entitlements, credit ledger, collaboration, marketplace, support promises.
- Foundry Pack: pack manifest checklist, included workflows, genre templates, publishing ops, asset/DAM conventions.
- Concierge setup sprint: intake, deliverables, proof packet, handoff, upsell path.
- Launch copy skeleton that stays truthful: no checkout/live-cloud claims until provider blockers are cleared.

Verification:

```powershell
author-os packs
author-os launch-plan --save
author-os production-evidence --no-env-file
```

Allowed now: strategy, copy skeleton, entitlement checklist.
Blocked: Stripe config, payments, public offer publication, external sends.

## Controller Rules For The Next Three Hours

1. No new local swarm or build until `pp preflight --workload overnight` or a narrower workload returns allow or a bounded admission that matches the command.
2. One writer in `author-os` at a time. Preserve `bin/quality-check.js` unless that lane is explicitly claimed.
3. Prefer Vercel preview verification over localhost for long-lived checks.
4. If a preview push is needed, inspect Vercel deployments first and avoid racing any BUILDING deployment less than 10 minutes old.
5. Every completed lane must return a resultRef path and the exact verification commands run.
6. Money, provider config, secrets, production promotion, public launch, and external sends stay human-gated.

## Best Next Action

If PP remains HOLD, complete Lane A as pure documentation and update the queue with a resultRef. If PP improves to bounded, run only the smallest relevant read-only command group and avoid full `ci:local` until CPU is under the configured ceiling. If PP returns allow, run Lane B verification first because it proves the core wedge: AuthorOS works as both hosted cockpit and MCP-native agent surface for Codex and Claude.

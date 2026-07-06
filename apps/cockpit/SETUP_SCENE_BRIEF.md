# Production Setup Contract Scene Brief

## Surface

`/setup` in the Vercel-hosted Arcanea Author Cockpit.

## Audience

Arcanea operators, launch engineers, and AI agents preparing a Vercel preview or production deployment.

## First Read

The operator must immediately know whether the hosted product is provisionable, which connector blocks launch, how many environment values are ready, and which proof gates need to run.

## Asset Tier

Tier C: exact code-rendered product UI and browser-captured proof. No generated art, external media, or decorative primary asset is introduced.

## Product Job

- Make production setup agent-readable and human-operable.
- Bind env keys, Vercel commands, connectors, proof endpoints, and launch sequence to one shared contract.
- Avoid exposing secrets while still showing enough evidence for safe handoff.
- Connect setup, ops, billing, hosted MCP, and the author cockpit into one deployment operating system.

## Composition

- Top command nav uses the same dense cockpit chrome as `/ops` and `/billing`.
- Hero panel states setup status and next action.
- Summary panel compresses required env, connectors, blockers, and command count.
- Connector cards show provider, purpose, status, env readiness, missing key names, proof route, and evidence command.
- Workbench shows safe `vercel env add` commands and runtime state.
- Proof endpoints and operator sequence close the page as a promotion checklist.

## Motion

No authored motion. The page is an operational surface where stillness improves scan speed. Reduced motion is inherited from global CSS.

## Acceptance Gate

- `/setup` renders on desktop and mobile without horizontal overflow.
- Secret values are never shown, only key names and command prompts.
- `/api/system/setup-contract` returns the same setup contract as the UI.
- Smoke and live verification include the setup API and page.
- Design evidence includes desktop/mobile setup captures and QA metrics.

# Vercel Production Runbook

This is the hosted path for Arcanea Author Cockpit while the open-core Agentic Author OS stays local-first and installable.

## Production Shape

- App: `apps/cockpit`
- Runtime: Next.js App Router on Vercel
- Source of truth: `@author-os/core` graph contracts
- Hosted boundary: `@author-os/cloud`
- Persistence: Vercel Marketplace Postgres, with Neon as the preferred first provider
- Assets: Vercel Blob
- Billing: Stripe
- Auth: Clerk first, with the hosted request context kept provider-neutral
- AI: Vercel AI Gateway
- Durable work: Vercel Workflows and Sandbox contracts

## Vercel Project Settings

The repo root contains `vercel.json` so the Vercel project can stay rooted at the monorepo root while building only the cockpit app.

Expected settings:

- Root directory: repo root
- Framework preset: Next.js
- Node.js version: `24.x`
- Install command: `pnpm install --frozen-lockfile`
- Build command: `pnpm --filter @author-os/cockpit build`
- Output directory: `apps/cockpit/.next`
- Ignored build step: `node scripts/vercel-ignore.js`

`scripts/vercel-ignore.js` skips Vercel builds for docs-only and unrelated changes. It continues the build when app, package, CLI, script, workflow, lockfile, or Vercel config files change.
The root and cockpit packages require Node `>=24 <25`, and the GitHub workflows use `actions/setup-node` with Node `24` so CI, local launch gates, and Vercel prebuilt deployments exercise the same runtime family.

Use only one deployment path:

- Preferred early path: Vercel native Git previews for normal branches.
- Manual Actions path: set repository variable `AUTHOR_OS_USE_ACTIONS_VERCEL=true` only when you intentionally want the workflow-based prebuilt deploy path.
- Do not enable both Vercel native auto-deploys and Actions-driven deploys for the same branch if they create duplicate builds.

## Required Environment

Use `apps/cockpit/.env.example` as the Vercel environment template, not as launch evidence. The readiness contract treats placeholder secrets, example Postgres URLs, fake Stripe price ids, example AI Gateway keys, example model slugs, and placeholder analytics values as blocked or review states.

The source-of-truth contract is also available from the CLI:

```bash
author-os cloud-env
author-os cloud-env --json
author-os cloud-env --example
author-os cloud-env --vercel --baseline --project author-os --environments production,preview --app-url https://author.arcanea.ai --preview-branch codex/author-os-preview
author-os cloud-env --vercel --audit --project author-os --environments production,preview
author-os cloud-env --vercel --project author-os --environments production,preview --preview-branch codex/author-os-preview
author-os cloud-env --vercel --apply-file .env.providers.local --environments production,preview --preview-branch codex/author-os-preview --require-ready
author-os cloud-env --vercel --apply-file .env.providers.local --environments production,preview --preview-branch codex/author-os-preview --apply
author-os setup-contract
author-os setup-contract --json
author-os setup-contract --save
```

`cloud-env --vercel --baseline` prints apply-ready PowerShell commands for deterministic non-secret values only. It can safely seed runtime safety, auth-provider selection, sign-in routes, Postgres adapter selection, pool limits, and token budgets before provider secrets exist. For Preview writes, pass `--preview-branch <non-production-branch>` so the Vercel CLI scopes values to a real preview branch; the production branch cannot be used as a Preview target. `cloud-env --vercel --audit` runs `vercel env ls` and compares remote name/environment presence against the AuthorOS contract and safe baseline; it does not and cannot validate encrypted values. `cloud-env --vercel` prints the complete manual `vercel env add` command ledger and labels sensitive variables. It intentionally does not print or embed secret values. `cloud-env --require-ready` rejects missing, placeholder, and invalid values, so `.env.example` cannot accidentally satisfy production readiness. `setup-contract` composes the sanitized connector map, env key status, safe Vercel commands, remote env audit command, proof endpoints, and operator promotion sequence into `reports/production-setup-contract.json` when saved.

`cloud-env --vercel --apply-file` is the safe path for provider and service values. Put real values in ignored local files such as `.env.providers.local` or `.env.local`, run the command first without `--apply` to get a redacted validation plan, then add `--apply` only after the plan is `ready`. The CLI validates each value against the production contract, refuses placeholders, refuses production branches as Preview targets, prints only redacted commands, and sends values to Vercel through stdin instead of command-line `--value`.

When auditing multiple environments, aggregate remote env counts mean "present in every requested environment." Use `environmentSummaries.production`, `environmentSummaries.preview`, and any future environment key to see exact per-environment progress. This matters when Production has already received the safe baseline but Preview still needs branch-scoped baseline commands. `production-evidence --remote-env-audit` uses those summaries for the operator queue, so a Production-complete/Preview-missing audit produces a Preview-only baseline command with `--preview-branch <non-production-branch>` instead of telling the operator to reapply Production values. Never use `main`, `master`, `production`, or `prod` as the Preview branch target.

Current remote baseline state as of July 6, 2026: the non-production branch `codex/author-os-preview` exists on GitHub and Vercel has the safe non-secret baseline for both Production and Preview. Remote env presence still blocks launch because provider/service values remain absent in both environments: `CLERK_SECRET_KEY`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `AUTHOROS_MCP_AUTHORIZATION_SERVER_URL`, `POSTGRES_URL`, `BLOB_READ_WRITE_TOKEN`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_PRICE_PRO_LOCAL`, `STRIPE_PRICE_CLOUD_CREATOR`, `STRIPE_PRICE_CLOUD_STUDIO`, `STRIPE_PRICE_AGENCY_SMALL_PRESS`, and `AI_GATEWAY_API_KEY`.

The composed launch artifact is also available from the CLI:

```bash
author-os launch-plan
author-os launch-plan --json
author-os launch-plan --save
author-os launch-plan --check-db --env-file .env.local
author-os launch-plan --check-db --preview-verified --require-ready --env-file .env.local
author-os production-evidence --env-file .env.local --remote-env-audit --preview-branch codex/author-os-preview --save
```

`launch-plan` combines the production env contract, cloud dependency readiness, database migration status, strict launch readiness, and preview verification state. `--save` writes `reports/cloud-launch-plan.json` for operators and agents. `--preview-verified` is an explicit acknowledgement that a Vercel preview URL has been inspected before promotion.
`production-evidence` composes runtime contract, env contract, setup contract, optional remote Vercel env presence audit, launch plan, migration dry-run/status, cloud readiness, optional live URL verification, local Vercel project link state, and git dirtiness into one sanitized operator artifact. In strict mode it uses the hard promotion gates: ready env/setup/cloud contracts, remote env name presence, checked database migration status, preview acknowledgement, and promotable live verification. `--save` writes `reports/production-evidence.json`; add `--remote-env-audit --live-url https://<deployment>` and `--require-ready` for the strict pre-promotion bundle. The remote audit remains presence-only and does not replace pulled env validation or provider proof.

The report includes `operatorNextActions`, a priority-ordered production queue. Use it as the handoff between Codex, CI, and the human operator: it names the next environment, provider, database, preview, and promotion action; includes only redacted commands; lists missing env names but never values; and preserves protected-preview skipped checks as a single deployment-protection action.

Live URL verification is:

```bash
npm run verify:live -- https://your-preview-url
npm run verify:live -- https://your-preview-url --expect-production --require-ready
author-os production-evidence --env-file .env.local --live-url https://your-preview-url --remote-env-audit --preview-branch codex/author-os-preview --vercel-bypass-secret $AUTHOROS_VERCEL_PROTECTION_BYPASS --require-ready --save
```

The verifier checks `/api/system/readiness`, `/api/system/setup-contract`, `/api/system/launch-plan`, `/api/system/production-evidence`, `/api/packs`, `/api/mcp`, `/api/mcp/client-config`, `/.well-known/oauth-protected-resource`, `/sign-in`, `/projects`, `/setup`, `/billing`, and `/ops`. `--expect-production` blocks demo runtime or missing auth. `--require-ready` blocks strict launch readiness failures, setup-contract blockers, launch-plan blockers, and hosted production-evidence blockers.
The hosted MCP endpoint should answer both the simple AuthorOS JSON facade and MCP JSON-RPC calls for `initialize`, `tools/list`, `tools/call`, `resources/templates/list`, `resources/list`, `resources/read`, `prompts/list`, `prompts/get`, and `ping`. The built-server smoke test exercises tool calls, project resources, resource reads, and prompt retrieval before preview deployment.

Protected previews:

- Preferred: create a Vercel Protection Bypass for Automation secret and set it locally or in CI as `VERCEL_AUTOMATION_BYPASS_SECRET` or `AUTHOROS_VERCEL_PROTECTION_BYPASS`.
- The verifier sends the secret as `x-vercel-protection-bypass` by default, matching Vercel's recommended header path.
- Use `--vercel-bypass-query` only for clients that cannot send custom headers.
- Optional browser/cookie flow: pass `--vercel-set-bypass-cookie true` or `--vercel-set-bypass-cookie samesitenone`.
- Operator-only fallback: generate a temporary Vercel share URL and pass the full URL, including `_vercel_share`, to `npm run verify:live` or `author-os production-evidence --live-url`. The verifier warms the share URL, carries the resulting cookie across API endpoint checks, and records `bypassMode: "temporary_share"` without printing the share token.
- If deployment protection blocks app JSON, the live verifier records one `vercel-deployment-protection` blocker and marks dependent endpoint, MCP, OAuth, setup, launch, and production-evidence checks as skipped. That means the next action is to provide the bypass, not to debug unrelated app contracts.
- Do not commit or print the bypass secret; the verifier report only includes `bypassProvided`, `bypassMode`, and the cookie mode.

Source docs: [Protection Bypass for Automation](https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/protection-bypass-automation), [Automated Agent Access](https://vercel.com/docs/deployment-protection/automated-agent-access).

Production cutover values:

- `AUTHOROS_DEMO_MODE=false`
- `AUTHOROS_REQUIRE_AUTH=true`
- `AUTHOROS_AUTH_PROVIDER=clerk`
- `AUTHOROS_ALLOW_TRUSTED_AUTH_HEADERS=false`
- `AUTHOROS_DEFAULT_PLAN=cloud-creator`
- `AUTHOROS_DEFAULT_AUTH_ROLE=editor`
- `AUTHOROS_MCP_AUTHORIZATION_SERVER_URL=https://<oauth-authorization-server>`
- `AUTHOROS_PROJECT_ADAPTER=postgres`
- `AUTHOROS_DB_MIGRATION_VERSION=001_author_os_cloud`
- `AUTHOROS_MIGRATION_APPLIED_BY=author-os-cli`
- `AUTHOROS_PG_POOL_MAX=5`
- `AUTHOROS_PG_IDLE_TIMEOUT_MS=5000`
- `NEXT_PUBLIC_APP_URL=<production app URL>`
- `CLERK_SECRET_KEY`
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_CLERK_SIGN_IN_URL`
- `NEXT_PUBLIC_CLERK_SIGN_UP_URL`
- `POSTGRES_URL` or `DATABASE_URL` from a Vercel Marketplace Postgres integration
- `BLOB_READ_WRITE_TOKEN`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `AI_GATEWAY_API_KEY` or `VERCEL_AI_GATEWAY_API_KEY`

Recommended managed-model routing values:

- `AUTHOROS_MODEL_EXTRACTOR`
- `AUTHOROS_MODEL_CONTINUITY`
- `AUTHOROS_MODEL_PROSE`
- `AUTHOROS_MODEL_VISUAL`
- `AUTHOROS_MODEL_OPERATIONS`
- `AUTHOROS_AI_PROVIDER_ORDER`
- `AUTHOROS_AI_FALLBACK_MODELS`
- `AUTHOROS_AI_MAX_INPUT_TOKENS`
- `AUTHOROS_AI_MAX_OUTPUT_TOKENS`

Recommended before paid traffic:

- `STRIPE_BILLING_PORTAL_CONFIGURATION`
- `STRIPE_PRICE_FOUNDRY_PACK`
- `STRIPE_PRICE_FOUNDER_LIFETIME_LOCAL`
- `STRIPE_PRICE_CONCIERGE_SETUP`
- `STRIPE_PRICE_AGENTIC_SERVICE_SPRINT`
- `SENTRY_DSN`
- `NEXT_PUBLIC_POSTHOG_KEY`
- `NEXT_PUBLIC_POSTHOG_HOST`
- `AUTHOROS_VERCEL_PROTECTION_BYPASS` or `VERCEL_AUTOMATION_BYPASS_SECRET` for protected preview verification

Fail closed before launch:

```bash
author-os cloud-env --require-ready --env-file .env.local
author-os launch-plan --check-db --env-file .env.local
author-os cloud-readiness --require-ready --env-file .env.local
```

## Database

Install a Postgres provider through Vercel Marketplace. Prefer Neon for the first rollout because it is the current Marketplace replacement for the retired first-party Vercel Postgres product.

Run the schema migration against the connected database:

```bash
author-os cloud-migrate --dry-run --env-file .env.local
author-os cloud-migrate --status --env-file .env.local
author-os cloud-migrate --apply --env-file .env.local
```

The migration runner creates and reads `author_schema_migrations`, checks SHA-256 checksums, applies pending migrations in a transaction, and never prints database credentials. After `--apply` reports `current`, set:

```text
AUTHOROS_DB_MIGRATION_VERSION=001_author_os_cloud
```

Use `author-os cloud-migrate --status --require-current --env-file .env.local` as a pre-promotion gate.

Manual fallback:

```bash
psql "$POSTGRES_URL" -f packages/cloud/migrations/001_author_os_cloud.sql
```

Before production traffic, application queries set:

```sql
select set_config('app.current_workspace_id', '<workspace_id>', true);
```

The migration enables row level security on tenant-scoped tables and isolates rows by `app.current_workspace_id`.
The hosted app now provides a Vercel Marketplace Postgres runtime bridge in `apps/cockpit/lib/postgres.js`. It lazily creates a `pg` pool, attaches it with `attachDatabasePool` when running on Vercel, and executes tenant-scoped reads/writes in a transaction using `set_config('app.current_workspace_id', workspaceId, true)`.
Project creation/import also upserts `author_workspaces` and `author_workspace_members` before writing `author_projects`, so foreign keys and RLS remain aligned for first-project onboarding.
Project saves also synchronize normalized trust tables from the graph: `author_assets`, `author_agent_runs`, `author_workflow_jobs`, `author_credit_ledger`, `author_suggestions`, `author_approvals`, and `author_exports`. The portable graph remains the cockpit source of truth, while these tables make production audit, reporting, support, and billing review queryable without parsing every graph blob.

## Asset Storage And DAM

Install Vercel Blob before accepting binary author assets in production. The cockpit app uses `@vercel/blob` lazily at request time and only when `BLOB_READ_WRITE_TOKEN` is configured, so first builds remain safe before storage provisioning.

Project asset listing:

```text
GET /api/projects/:id/assets
```

Project asset intake:

```text
POST /api/projects/:id/assets
```

The route accepts metadata-only provenance records for external/licensed references and optional `contentBase64` uploads for Blob-backed files. Binary uploads default to private Blob access. Every accepted asset is appended to the portable project graph with rights, provenance, storage, `usedIn`, tags, byte size, and creator metadata. If `usedIn` references a story entity, the route also links the asset id into that entity's `assetIds`. Saving the project syncs the asset into the normalized `author_assets` table under the active workspace RLS scope.

Production behavior:

- Metadata-only asset records can be catalogued without Blob.
- Binary uploads fail closed with `ASSET_STORAGE_NOT_CONFIGURED` until Blob is attached.
- Demo smoke uses an in-memory `demo-blob://` adapter and never writes external files.
- Private assets should be served through authorized routes rather than pasted into public pages.

Hosted project creation/import:

```text
POST /api/projects
```

This route accepts a starter project seed (`title`, `genre`, `targetWords`, optional `template`, `premise`, and `audience`), an explicit blank graph request (`blank: true` or `seedMode: "blank"`), a pasted manuscript, or a portable Author OS `graph`. Imported graphs are normalized to the authenticated workspace before persistence.

It also accepts a hosted manuscript-text import:

```json
{
  "title": "Imported Book",
  "sourceName": "manuscript.md",
  "manuscriptText": "# Imported Book\n\n## Chapter One\n\nDraft text..."
}
```

Markdown headings become chapter/scene boundaries. Plain text is chunked into reviewable chapters. The import creates a `manuscript` provenance asset, imported scenes, and queued import-review tasks. It does not apply AI rewrites or extract canon automatically; those remain explicit agent runs.

Workspace project listing:

```text
GET /api/projects
```

This route returns the authenticated workspace's project summaries through the same tenant-scoped adapter used by the cockpit and hosted MCP.

## Auth Boundary

Production requests resolve tenant identity through Clerk before any hosted project service is called. The app-level resolver maps Clerk `userId`, `orgId`, `orgRole`, and optional AuthorOS claims into the neutral hosted context used by `@author-os/cloud`.

Default production behavior:

- `AUTHOROS_REQUIRE_AUTH=true` refuses any request without verified auth.
- Raw identity headers such as `x-author-os-user-id` are accepted only for demo/local previews.
- `AUTHOROS_ALLOW_TRUSTED_AUTH_HEADERS=true` is reserved for a reviewed gateway that strips client-supplied identity headers and injects verified context.
- If no Clerk organization is present, the resolver creates a solo workspace id from the Clerk user id.
- Plan and role can come from Clerk claims; otherwise `AUTHOROS_DEFAULT_PLAN` and `AUTHOROS_DEFAULT_AUTH_ROLE` are used until Stripe entitlements fully own the plan source.
- Runtime safety seal: if `VERCEL_ENV=production` or `VERCEL_TARGET_ENV=production`, demo adapters are disabled even when `AUTHOROS_DEMO_MODE=true` is missing or accidentally set. Readiness still blocks until `AUTHOROS_DEMO_MODE=false` is explicitly configured, but production targets fail closed instead of serving sample author data.

## Verification Gates

Local gates:

```bash
npm run runtime:check
npm test
node bin/author.js production-evidence --no-env-file
pnpm --filter @author-os/cockpit build
node bin/author.js mcp --manifest
node bin/author.js readiness --json
node bin/author.js launch-plan --json --no-env-file
node bin/author.js cloud-readiness --json
node bin/author.js cloud-migrate --dry-run --json --no-env-file
node scripts/smoke-hosted-cockpit.mjs
node scripts/verify-live-cockpit.mjs https://your-preview-url
```

CI gates:

- `.github/workflows/author-os-ci.yml` runs runtime contract verification, local tests, launch-plan reporting, cloud dry-run readiness, production evidence collection, cockpit build, and built-server smoke.
- `.github/workflows/vercel-preview.yml` is manual and gated by `AUTHOR_OS_USE_ACTIONS_VERCEL=true`; it runs runtime contract verification, tests, preview env pull, launch-plan reporting, dry-run migration, readiness, production evidence collection, local smoke, `vercel build`, `vercel deploy --prebuilt`, and live URL verification with a pinned Vercel CLI version.
- `.github/workflows/vercel-promote.yml` is manual and production-environment gated; it requires runtime contract verification, `cloud-env --require-ready`, `cloud-migrate --status --require-current`, `cloud-readiness --require-ready`, `launch-plan --check-db --preview-verified --require-ready`, strict live URL verification, and a strict production evidence bundle before `vercel promote`, also using the pinned Vercel CLI version.

Required GitHub/Vercel secrets for the manual Actions path:

- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`
- `VERCEL_AUTOMATION_BYPASS_SECRET` when Vercel Authentication or deployment protection is enabled on preview deployments

Repository variable:

- `AUTHOR_OS_USE_ACTIONS_VERCEL=true`

Hosted smoke gates:

- `GET /api/system/readiness`
- `GET /api/system/setup-contract`
- `GET /api/system/launch-plan`
- `GET /api/system/production-evidence`
- `GET /api/packs`
- `GET /api/projects`
- `POST /api/projects`
- `GET /api/projects/prj_luminous_archive/context`
- `POST /api/projects/prj_luminous_archive/packs`
- `GET /api/projects/prj_luminous_archive/assets`
- `POST /api/projects/prj_luminous_archive/assets`
- `GET /api/projects/prj_luminous_archive/readiness`
- `POST /api/projects/prj_luminous_archive/agent-runs`
- `POST /api/projects/prj_luminous_archive/exports`
- `POST /api/projects/prj_luminous_archive/suggestions/<suggestionId>/approval`
- `GET /api/mcp`
- `POST /api/mcp`
- `GET /api/billing/status`
- `POST /api/billing/stripe/checkout`
- `POST /api/billing/stripe/portal`
- `POST /api/billing/stripe/webhook`
- `POST /api/service-intake`
- `/projects`
- `/projects/prj_luminous_archive/cockpit`
- `/setup`
- `/billing`
- `/ops`

Production readiness is not proven until `/api/system/readiness` returns `ready`, auth is required, database rows are tenant-isolated, private assets require authorization, Stripe entitlements map to `createEntitlementSnapshot`, and AI Gateway calls record `AgentRun` plus `CreditLedger`.
For Postgres-backed production, readiness also expects workflow and export activity to be visible in the normalized audit tables as well as embedded in the project graph.

`GET /api/system/readiness` returns two readiness layers:

- `cloud`: dependency presence for local/demo and preview checks.
- `launch`: strict production blockers and warnings. Production launch requires demo mode off, auth required, Clerk selected and keyed, Clerk sign-in/up URLs, Postgres adapter selected, migration version declared, Blob, Stripe, AI Gateway, and canonical HTTPS URL configured.

`GET /api/system/production-evidence` returns the hosted sanitized proof bundle: env contract summary, setup connector summary, cloud and launch readiness, launch-plan summary, runtime mode, deployment context, and explicit evidence checks. It must not expose secret values; it is the live counterpart to `author-os production-evidence`.

## Billing And Activation

Stripe checkout route:

```text
POST /api/billing/stripe/checkout
```

The route creates a Stripe Checkout Session for a sellable `offerCatalog` id such as `foundry-pack`, `pro-local`, `founder-lifetime-local`, `cloud-creator`, `cloud-studio`, `agency-small-press`, `concierge-setup`, or `agentic-service-sprint`. Demo mode returns a deterministic Stripe-like checkout URL and records an in-memory `checkout.session.created` audit event. Production mode requires verified tenant context, `STRIPE_SECRET_KEY`, and a concrete `STRIPE_PRICE_*` value; lookup placeholders are rejected before contacting Stripe.

Checkout creation does not grant access. Entitlements and managed-credit grants are created only after the webhook receives and verifies the Stripe completion/subscription event.

Billing status route:

```text
GET /api/billing/status
```

This returns the authenticated workspace's sanitized plan and entitlement view: current plan, source, latest entitlement event, exportable entitlement snapshot, and whether a Stripe customer/subscription is linked. It does not expose raw Stripe customer ids to the browser response.

Billing command deck route:

```text
GET /billing
```

This renders the hosted account surface for the current workspace: plan state, entitlement limits, audit evidence, checkout actions, customer portal access, cloud offer cards, and launch-pack/service readiness. The page reads from the same hosted billing adapter as `/api/billing/status`, so checkout-created audit events stay visible without granting access until a verified webhook records an entitlement.

Workspace project route:

```text
GET /projects
```

This renders the authenticated workspace hub before a single book cockpit opens: tenant project stack, project creation seed, manuscript/canon/task/readiness summaries, activation queue, runtime state, and direct cockpit links. It reads from the same hosted project service as `GET /api/projects` and hosted MCP `list_projects`, so demo mode, Postgres production mode, and agent calls share one tenant-scoped project boundary.

Production launch ops route:

```text
GET /ops
```

This renders the operator-facing activation room from the same `createLaunchOperationsPlan` used by the CLI and `/api/system/launch-plan`: launch status, blocker/review counts, stage health, priority actions, environment group readiness, runtime mode, and promotion proof commands. It must never expose secret values; it only names required environment keys and proof gates.

Production setup contract route:

```text
GET /setup
```

This renders the provisioning command room from `createProductionSetupContract`: connector status for runtime safety, Clerk, Marketplace Postgres, Blob, Stripe, AI Gateway, and observability; required and recommended env readiness; safe `vercel env add` commands; runtime state; proof endpoints; and the operator sequence from local gates to preview verification and production promotion. It must never expose secret values. The matching machine-readable endpoint is:

```text
GET /api/system/setup-contract
```

Stripe customer portal route:

```text
POST /api/billing/stripe/portal
```

Create a short-lived Stripe Customer Portal session for the authenticated workspace after checkout has linked a Stripe customer. Production uses `STRIPE_SECRET_KEY`, the latest billing customer id, and the optional `STRIPE_BILLING_PORTAL_CONFIGURATION`. Return URLs are anchored to the app origin and accepted as relative paths only. The portal session creation is recorded as `billing_portal.session.created` for operator audit, but it never changes entitlements.

Stripe webhook route:

```text
POST /api/billing/stripe/webhook
```

Production behavior:

- Requires `STRIPE_WEBHOOK_SECRET`.
- Verifies `Stripe-Signature`.
- Normalizes checkout/subscription/invoice events.
- Produces an entitlement mutation.
- Produces a credit grant for plans with included managed credits.
- Persists the normalized billing event, entitlement mutation, and credit grant through the hosted billing adapter. Demo mode uses in-memory persistence; production uses Marketplace Postgres with workspace-scoped RLS when a workspace id is present.
- The hosted tenant context reads the latest active or cancelled entitlement event when available, so Stripe can become the plan source without trusting client-supplied plan headers.

Service intake route:

```text
POST /api/service-intake
```

Use it for concierge setup, service sprints, and agency onboarding. The route returns a structured intake record in demo mode and should persist into `author_service_intakes` in production.
Demo mode stores intakes in the demo billing adapter. Production mode writes `author_service_intakes` through the same Marketplace Postgres billing adapter used by Stripe webhook persistence.

## Trust Rules

- No agent applies prose changes without an approval record.
- Every hosted agent run writes `AgentRun`.
- Every hosted managed-AI run goes through the runtime AI adapter, records Gateway tags/model/usage on `AgentRun`, and writes a matching `CreditLedger` entry.
- Every durable hosted workflow can write `author_workflow_jobs`.
- Every managed model call writes `CreditLedger`.
- Every export writes `Export`.
- Publishing gates read `PublishingReadinessReport`.
- Authors can export their work at any time.

## Hosted MCP

Local-first agents should use:

```bash
author-os mcp
author-os mcp --client-config --mode local --host claude --save .authoros/mcp-client-config.json
author-os mcp --client-config --mode both --host codex --url https://your-author-cockpit --token-env AUTHOROS_MCP_TOKEN
```

`mcp --client-config` generates install-ready `mcpServers` JSON for local stdio, hosted Streamable HTTP, or both. Hosted configs reference token environment variable names only; store the real token in the Codex/Claude/agent host secret store after OAuth or the reviewed gateway token path is configured. The hosted `/api/mcp/client-config` endpoint emits the same config shape for the active deployment origin, so operators can fetch an install-ready Codex/Claude config directly from a preview or production URL without copying stale endpoint values.

Hosted agents can discover the Vercel facade at:

```text
GET /api/mcp
GET /api/mcp/client-config?host=codex&mode=hosted
GET /api/packs
```

HTTP MCP clients discover authorization through:

```text
GET /.well-known/oauth-protected-resource
```

That document advertises `/api/mcp` as the protected resource, the configured `AUTHOROS_MCP_AUTHORIZATION_SERVER_URL`, and the AuthorOS scopes `authoros:read`, `authoros:write`, `authoros:agents`, and `authoros:export`. This follows the MCP authorization requirement for OAuth 2.0 Protected Resource Metadata ([MCP authorization](https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization), [RFC 9728](https://datatracker.ietf.org/doc/html/rfc9728)).

Tool execution goes through:

```text
POST /api/mcp
```

`POST /api/mcp` resolves the same hosted tenant context as cockpit/API routes. In production, that means verified Clerk auth unless a reviewed gateway sets `AUTHOROS_ALLOW_TRUSTED_AUTH_HEADERS=true`. Each tool maps to a scope and role gate:

- `authoros:read`: `viewer`
- `authoros:write`: `editor`
- `authoros:agents`: `agent`
- `authoros:export`: `agent`

When auth is required and the client is not authenticated, `POST /api/mcp` returns `401` with `WWW-Authenticate: Bearer ... resource_metadata="https://<app>/.well-known/oauth-protected-resource" ... scope="<required-scope>"` so Codex, Claude, and other MCP clients can discover the authorization path without hardcoding it.

The hosted route now executes the first production-safe tool set through the same tenant-scoped services as the cockpit API:

- `list_projects`
- `list_packs`
- `install_pack`
- `read_project_context`
- `read_canon`
- `search_manuscript`
- `create_scene`
- `revise_scene`
- `run_continuity_check`
- `generate_character_board`
- `export_book`
- `get_run_status`
- `read_publishing_readiness`

`list_packs` is read-only registry discovery. `install_pack` installs the selected pack or `authoros-foundry-pack` into the tenant project graph by adding boards, tasks, asset placeholders, and publishing-plan scaffolding without generating or revising manuscript prose. Hosted pack install checks `packAccess`: a workspace needs cloud marketplace access or a premium/foundry-pack entitlement; otherwise the route returns `402 PACK_ENTITLEMENT_REQUIRED`. Read tools use the hosted project service. Mutating/agent tools use the hosted workflow service and persist audit records through the active adapter. Long-running model calls, Blob asset writes, and advanced export rendering should still move into Vercel Workflows and Sandbox as the product matures.

## Agent Workflow API

Agent run route:

```text
POST /api/projects/:id/agent-runs
```

Supported first production task contracts:

- `create_scene`: creates a scene and completed agent run.
- `revise_scene`: creates an approval-gated suggestion, agent run, and credit ledger entry.
- `run_continuity_check`: creates a continuity report and completed run.
- `generate_character_board`: creates a board payload and completed/review run.
- `export_book`: creates a sandbox/export envelope and export record.
- any other task type: creates a queued run envelope.

Managed AI execution:

Add one of the following to an agent-run request to execute through the configured runtime AI adapter:

```json
{
  "useManagedAi": true
}
```

Demo/local smoke uses a deterministic dry-run adapter. Production uses Vercel AI Gateway through the AI SDK when OIDC/API key auth and an explicit route model are configured. Model slugs are intentionally deployment configuration, not hardcoded source constants. `AUTHOROS_MODEL_PROSE` is used for scene drafting/revision, `AUTHOROS_MODEL_CONTINUITY` for continuity checks, `AUTHOROS_MODEL_VISUAL` for visual tasks, and `AUTHOROS_MODEL_OPERATIONS` for operational/export tasks. The AI Gateway docs and model catalog should be checked before setting those values because provider/model slugs change over time.

Export shortcut:

```text
POST /api/projects/:id/exports
```

Approval route:

```text
POST /api/projects/:id/suggestions/:suggestionId/approval
```

This records `approved`, `rejected`, or `conditioned` decisions. Applying prose changes remains a separate explicit step so authors never lose control of the manuscript.

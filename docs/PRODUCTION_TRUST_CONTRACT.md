# Production Trust Contract

Agentic Author OS should never behave like a black-box prose generator. Every meaningful agent action must leave a reviewable trail that an author, editor, or operator can inspect before export or publication.

## Core Records

- `AgentRun`: every AI or agent operation records task type, model route, gateway tags, prompt scope, cost estimate, output pointer, and approval state.
- `WorkflowJob`: hosted multi-step work records runtime, purpose, status, steps, pause points, and the linked run.
- `Suggestion`: revisions are human-reviewable proposals. Direct apply is blocked by default.
- `Approval`: records who approved, rejected, or conditioned a suggestion before it can become applied state.
- `CreditLedger`: managed AI spend is logged per workspace, project, run, provider, model, task type, tokens, estimated cost, included credit, and billable amount.
- `Export`: every generated manuscript artifact records format, path, status, approval state, and source run.
- `PublishingReadinessReport`: combines graph validation, continuity, pending suggestions, asset rights, export records, entitlements, and credit summary.
- `BillingEvent`: every Stripe checkout/subscription/invoice event is normalized before changing access.
- `EntitlementEvent`: every plan change records the provider event, offer, plan, status, and resulting entitlement snapshot.
- `CreditGrant`: every included managed AI credit grant is explicit and traceable back to a billing event or manual grant.
- `ServiceIntake`: concierge setup and service sprint requests are structured records, not loose form submissions.
- `SchemaMigration`: hosted database migrations record version, checksum, description, operator, and applied timestamp in `author_schema_migrations`.

## Local/Core Guarantees

- Local files remain the source of truth for open-core projects.
- Authors can export anytime.
- BYOK is allowed.
- Human approval is required before applying revision suggestions.
- Credit accounting is still generated for local/dry-run workflows so cloud migration does not lose audit history.
- `author-os init` creates a portable `.authoros/project.graph.json` starter cockpit by default, with provisional chapters, scenes, beats, codex placeholders, tasks, canvas state, a starter brief asset, and a decision record. It does not generate manuscript prose. `author-os init --blank` remains available for a bare local graph.

## MCP Guarantees

The MCP surface persists audit state instead of returning throwaway JSON:

- Hosted `POST /api/mcp` must resolve the same tenant auth context as cockpit/API routes before accepting a tool call.
- Hosted MCP tools must declare a scope and minimum role before execution.
- Hosted MCP must publish OAuth 2.0 Protected Resource Metadata at `/.well-known/oauth-protected-resource`, advertising `/api/mcp`, the configured authorization server, and the AuthorOS tool scopes.
- Unauthenticated hosted MCP execution must return a `WWW-Authenticate` header with `resource_metadata` and the exact scope needed for the attempted tool.
- Hosted `POST /api/mcp` supports MCP-style JSON-RPC for `initialize`, `tools/list`, `tools/call`, `resources/templates/list`, `resources/list`, `resources/read`, `prompts/list`, `prompts/get`, and `ping` while preserving the simpler AuthorOS JSON facade for smoke tests and lightweight agents.
- `tools/list` exposes the same tool catalog as local MCP plus AuthorOS `_meta` fields for required scope and role.
- `tools/call` must resolve tenant context, check workspace entitlement/role, persist the run/artifact through the hosted services, and return MCP `content` plus structured audit data.
- `resources/templates/list` advertises project context, canon, and readiness URI templates; `resources/list` returns authorized project resource handles; `resources/read` resolves the tenant context and returns JSON resource contents through hosted services.
- `prompts/list` and `prompts/get` expose workflow templates for project brief, continuity audit, human-reviewable scene revision, and export readiness without reading private project state until the referenced resources/tools are called.
- `list_projects` reads tenant-scoped workspace project summaries.
- `read_project_context`, `read_canon`, and `search_manuscript` read from the authorized project graph.
- `create_scene` writes a scene and persists the completed run.
- `revise_scene` returns and persists a requested suggestion, an agent run, and a credit ledger entry.
- `get_run_status` reads persisted run state from the project graph.
- `export_book` writes a Markdown export and records an export artifact.
- `read_publishing_readiness` tells an agent whether the project is blocked, needs review, or is ready.

## Hosted Workflow Guarantees

- `POST /api/projects` creates or imports a project graph only after workspace-level entitlement and role checks.
- Imported graphs are normalized to the authenticated workspace before persistence; client-provided workspace ids are never trusted.
- Manuscript-text imports normalize pasted Markdown/plain text into imported chapters/scenes, a manuscript provenance asset, and queued review tasks. The import never rewrites prose, extracts canon, or applies suggestions without later explicit agent runs and approvals.
- Hosted seed creation defaults to a starter cockpit, not an empty shell: it creates provisional chapters, scene cards, beats, codex placeholders, a story canvas, review tasks, a publishing checklist, a starter brief asset, and a decision record. It does not write manuscript prose, and every starter fact remains provisional until the author approves or edits it. Explicit `blank: true` or `seedMode: "blank"` still creates a bare portable graph.
- Production hosted routes resolve identity through verified Clerk auth before creating the tenant context.
- Clerk sign-in and sign-up fallbacks must route authenticated authors to the tenant workspace hub (`/projects`) or a same-origin configured workspace path, never directly into the sample project cockpit.
- Identity headers are accepted for demo/local preview only unless `AUTHOROS_ALLOW_TRUSTED_AUTH_HEADERS=true` is explicitly enabled behind a reviewed gateway that strips client-supplied identity headers.
- `POST /api/projects/:id/agent-runs` creates a workflow envelope before work is considered accepted.
- Agent runs can request managed AI with `useManagedAi`, `managedAi`, `ai: "managed"`, or `runMode: "managed-ai"`. Managed execution records provider, model, route, Gateway tags, token usage, estimated cost, and finish reason on the `AgentRun`.
- `revise_scene` never applies text directly; it creates `Suggestion` plus `Approval`-ready state.
- `POST /api/projects/:id/suggestions/:suggestionId/approval` records human decision state.
- `GET /api/projects/:id/assets` reads the project's DAM/provenance records through the same tenant authorization boundary.
- `POST /api/projects/:id/assets` creates metadata-only or Blob-backed asset records, links them to referenced entities, records rights/provenance, and persists them into the project graph.
- `POST /api/projects/:id/exports` creates an export run plus export record and sandbox contract.
- Hosted workflows enforce tenant access and role checks before mutation.
- Demo mode may return adapter-backed dry-run state, but production must persist workflow/run/export records.
- Demo mode uses deterministic managed-AI dry runs. Production managed-AI calls must use AI Gateway/OIDC or an API key plus explicit model configuration; if the adapter is unavailable, managed runs fail closed.
- Production mode must not fall back to demo data. If the project adapter is not wired, hosted author-data routes fail closed with `PROJECT_ADAPTER_NOT_CONFIGURED`.
- Production binary asset uploads fail closed with `ASSET_STORAGE_NOT_CONFIGURED` until Vercel Blob is attached. Metadata-only provenance records remain allowed so external/licensed assets can be catalogued without copying files.
- Marketplace Postgres project reads and writes require a workspace scope so row-level security can enforce tenant isolation.
- Hosted project creation/import upserts the workspace and current workspace membership before writing the project graph, keeping foreign keys, role checks, and RLS in agreement.
- Postgres project saves synchronize graph audit records into normalized tables for assets, agent runs, workflow jobs, credit ledger entries, suggestions, approvals, and exports.

## Launch Gate Guarantees

- `GET /api/system/readiness` returns both dependency readiness and strict production launch readiness.
- `author-os cloud-env` exposes the canonical hosted environment contract, with required, recommended, sensitive, alias-aware, placeholder-aware, and invalid-value-aware variables.
- `author-os cloud-env --vercel` prints safe `vercel env add` commands and never embeds secret values.
- Preview env writes use `--preview-branch <non-production-branch>` for Vercel CLI compatibility; do not scope Preview variables to the production branch.
- `author-os cloud-env --vercel --audit` parses `vercel env ls` and records remote name/environment presence without treating encrypted values as launch-ready evidence.
- `author-os cloud-env --require-ready` must pass before launch or production promotion, and it must reject checked-in example placeholders, fake Stripe price ids, placeholder model slugs, and invalid service URLs.
- `author-os setup-contract` exposes the sanitized connector, env, command, endpoint, and promotion-sequence contract used by hosted setup surfaces.
- `author-os setup-contract --save` writes `reports/production-setup-contract.json` for operator handoff and agent review.
- `author-os launch-plan` composes env, cloud dependency, migration, strict readiness, and preview verification gates into one operator artifact.
- `author-os launch-plan --save` writes `reports/cloud-launch-plan.json` for handoff, audits, and agent review.
- `author-os launch-plan --check-db --preview-verified --require-ready` must pass before production promotion.
- `author-os production-evidence --env-file .env.local --live-url <validated-url> --remote-env-audit --preview-branch <non-production-branch> --require-ready --save` must produce a ready `reports/production-evidence.json` before production promotion.
- `production-evidence --remote-env-audit` records the Vercel env presence audit in the sanitized dossier; it is still name/environment evidence only and must be paired with pulled env validation, provider proof, migration status, and live verification.
- `node scripts/verify-live-cockpit.mjs <url> --expect-production --require-ready` must pass against the validated deployment URL before promotion.
- Protected Vercel previews must be verified with an operator/CI-only Protection Bypass for Automation secret (`AUTHOROS_VERCEL_PROTECTION_BYPASS` or `VERCEL_AUTOMATION_BYPASS_SECRET`) when deployment protection is enabled. Evidence reports may record whether a bypass was provided, but must never print the secret value.
- `author-os cloud-readiness --json` exposes the same launch blockers for CI, Vercel preview checks, and operator review.
- `author-os cloud-migrate --dry-run|--status|--apply` is the supported hosted Postgres migration path and records migration checksums before launch.
- `author-os cloud-migrate --status --require-current` should pass before production promotion.
- CI must run runtime contract verification, local tests, hosted dry-run readiness, production evidence collection, cockpit build, and built-server smoke before preview deployment.
- Production promotion must promote a validated preview artifact after migration/current-readiness checks, not rebuild a speculative production deployment.
- `GET /api/system/setup-contract` exposes the sanitized hosted setup contract so live previews can be checked with the same connector map as the CLI and `/setup`.
- `GET /api/system/launch-plan` exposes the sanitized hosted launch plan so live previews can be checked with the same contract as the CLI.
- `GET /api/system/production-evidence` exposes the hosted sanitized evidence bundle: env summary, connector summary, launch plan, launch readiness, runtime mode, deployment context, and explicit evidence checks without secret values.
- Live URL verification checks readiness, setup contract, launch plan, hosted production evidence, MCP discovery, OAuth protected-resource metadata shape, AuthorOS MCP scopes, sign-in, workspace projects, setup, billing command deck, and production launch ops surfaces before a deployment can be called verified.
- Vercel production targets must fail closed: `VERCEL_ENV=production` or `VERCEL_TARGET_ENV=production` disables demo adapters even if `AUTHOROS_DEMO_MODE=true` is missing or accidentally set. Readiness still blocks until `AUTHOROS_DEMO_MODE=false` is explicitly configured.
- Launch readiness is blocked until demo mode is disabled, auth is required, Clerk is selected and keyed with non-placeholder values, Clerk sign-in/up URLs are configured, Postgres persistence is selected, the migration version is declared, private asset storage is configured with a non-placeholder Blob token, Stripe billing and concrete price ids are configured, AI Gateway is configured, and the canonical app URL is HTTPS.
- Observability and one-off launch price IDs can warn without blocking previews, but they should be resolved before paid public launch.

## Billing Guarantees

- Checkout Session creation requires verified tenant context in production, a sellable `offerCatalog` id, and a configured concrete Stripe price id.
- Checkout creation records a `checkout.session.created` billing audit event but never grants access by itself.
- Billing status responses expose sanitized entitlement state and customer/subscription presence, not raw Stripe customer ids.
- Stripe Customer Portal sessions require an existing Stripe customer id from billing history, use app-origin relative return URLs, and record `billing_portal.session.created` without changing entitlements.
- Stripe webhook payloads require signature verification in production.
- Checkout and subscription events map to the same `offerCatalog` used by the app and CLI.
- Paid plans grant explicit entitlements and monthly managed credit records.
- Cancelled subscriptions fall back to open-core entitlements.
- Hosted tenant context may adopt the latest active or cancelled billing entitlement for the workspace; checkout-created audit events never override the plan.
- Billing routes never print secrets and persist normalized events, entitlement mutations, and credit grants through the hosted billing adapter.
- Concierge and sprint intake uses structured records tied to workspace, user, offer, goals, constraints, and requested services, then persists them through the hosted billing adapter.

## CLI Guarantees

- `author-os doctor` checks local project and package readiness.
- `author-os readiness` prints publishing gates.
- `author-os readiness --json` returns the full machine-readable report.
- `author-os readiness --save` writes `reports/readiness.json`.
- `author-os cloud-env --example` renders the checked-in production env template without real secrets; that template must remain blocked until every placeholder is replaced by real deployment values.
- `author-os audit` is an alias for readiness.

## Hosted Layer Contract

The hosted cockpit consumes the same portable graph contracts as local/MCP. The Vercel product layer should add auth, tenant isolation, Postgres persistence, Blob assets, Stripe entitlements, and Workflow/Sandbox execution without changing these core trust records.

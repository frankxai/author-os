# AuthorOS Production Environment Dossier

Date: 2026-07-19
Scope: Vercel preview and production readiness for Agentic Author OS / Arcanea Author Cockpit.
Safety: variable names, scopes, owners, and validation commands only. No secrets or provider values belong in this file.

## Executive State

The app surface is ahead of the provider plane. Hosted cockpit, setup, launch-plan, production-evidence, pack registry, MCP metadata, JSON-RPC tools/resources/prompts, and core project surfaces previously verified with zero live endpoint blockers. Production launch is blocked by missing provider-backed configuration in Vercel preview and production.

Baseline non-secret config is complete. The remaining work is a human/operator setup sprint across Clerk, AuthorOS MCP OAuth/authorization metadata, Vercel Postgres, Vercel Blob, Stripe, and Vercel AI Gateway.

## Required Values

| Env var | Provider | Scope | Owner action | Validation |
|---|---|---|---|---|
| `CLERK_SECRET_KEY` | Clerk | Preview + production secret | Create/select Clerk app for AuthorOS, copy server secret into Vercel env. | `author-os cloud-env --require-ready --env-file .env.local` |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk | Preview + production public env | Copy publishable key for the same Clerk app/environment. | `author-os cloud-readiness --require-ready --env-file .env.local` |
| `AUTHOROS_MCP_AUTHORIZATION_SERVER_URL` | Clerk/Auth service | Preview + production URL | Set the issuer/authorization server URL that hosted MCP advertises to Codex/Claude clients. | `npm run verify:live -- <preview-url>` |
| `POSTGRES_URL` | Vercel Postgres or managed Postgres | Preview + production secret | Provision database, apply schema/migration, store connection URL. | `author-os cloud-migrate --status --require-current --env-file .env.local` |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob | Preview + production secret | Create Blob store/token for assets, cover refs, portraits, moodboards, and export files. | `author-os cloud-readiness --require-ready --env-file .env.local` |
| `STRIPE_SECRET_KEY` | Stripe | Preview + production secret | Create Stripe restricted/live/test keys for the correct environment. | `author-os launch-plan --require-ready --env-file .env.local` |
| `STRIPE_WEBHOOK_SECRET` | Stripe | Preview + production secret | Create webhook endpoint for hosted app and store signing secret. | `author-os launch-plan --require-ready --env-file .env.local` |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe | Preview + production public env | Store publishable key matching the selected Stripe mode. | `author-os cloud-env --require-ready --env-file .env.local` |
| `STRIPE_PRICE_PRO_LOCAL` | Stripe | Preview + production price id | Create Pro Local recurring/founder-compatible price. | `author-os launch-plan --check-db --require-ready --env-file .env.local` |
| `STRIPE_PRICE_CLOUD_CREATOR` | Stripe | Preview + production price id | Create Cloud Creator price. | `author-os launch-plan --check-db --require-ready --env-file .env.local` |
| `STRIPE_PRICE_CLOUD_STUDIO` | Stripe | Preview + production price id | Create Cloud Studio price. | `author-os launch-plan --check-db --require-ready --env-file .env.local` |
| `STRIPE_PRICE_AGENCY_SMALL_PRESS` | Stripe | Preview + production price id | Create Agency/Small Press price. | `author-os launch-plan --check-db --require-ready --env-file .env.local` |
| `AI_GATEWAY_API_KEY` | Vercel AI Gateway | Preview + production secret | Create key with project spend tags and fail-closed budget expectations. | `author-os production-evidence --env-file .env.local --require-ready --save` |

## Setup Order

1. Clerk first: authentication gates must fail closed before user projects, MCP auth, billing, or assets are trusted.
2. Postgres second: run migration/status checks before testing collaboration, packs, tasks, runs, approvals, and entitlements.
3. Blob third: validate asset provenance, export storage, cover/portrait/moodboard upload paths.
4. Stripe fourth: create products/prices and webhook only after entitlement shape is final.
5. AI Gateway fifth: configure model routing and cost tags after tenant, run, and approval logging are working.
6. Vercel protection bypass last: create a bypass token for automated preview verification, store it only in operator/CI context as `AUTHOROS_VERCEL_PROTECTION_BYPASS` or `VERCEL_AUTOMATION_BYPASS_SECRET`.

## Vercel Apply Pattern

Use `author-os cloud-env --vercel --baseline` only for deterministic non-secret values. Apply required provider values through Vercel dashboard or a carefully reviewed Vercel CLI session that never logs values.

Recommended scopes:

- Preview: the non-production preview branch used for AuthorOS validation.
- Production: only after preview readiness, database status, live verification, and production evidence pass.

Do not use `.env.example` as evidence. Pull the configured environment locally only when needed for validation:

```powershell
vercel env pull .env.local --yes
author-os cloud-env --require-ready --env-file .env.local
author-os cloud-migrate --status --require-current --env-file .env.local
author-os cloud-readiness --require-ready --env-file .env.local
author-os launch-plan --check-db --preview-verified --require-ready --env-file .env.local
author-os production-evidence --env-file .env.local --live-url <preview-url> --remote-env-audit --preview-branch authoros-preview --require-ready --save
npm run verify:live -- <preview-url> --expect-production --require-ready
```

## Human Gates

These actions require Frank/operator approval at action time:

- Creating or changing provider secrets.
- Creating Stripe products, prices, webhook endpoints, checkout routes, invoices, refunds, or live payment paths.
- Enabling production auth/billing for real users.
- Promoting preview to production.
- Sending external email, social, partner, customer, or marketplace communications.
- Raising AI Gateway spend limits or attaching real customer credit consumption.

## Acceptance Checklist

- [ ] Vercel preview contains all required env names with non-placeholder values.
- [ ] Vercel production contains all required env names with non-placeholder values.
- [ ] Pulled `.env.local` passes `author-os cloud-env --require-ready`.
- [ ] Postgres migration status is current.
- [ ] Blob adapter readiness passes.
- [ ] Stripe prices map to the intended offer tiers.
- [ ] Hosted MCP protected-resource metadata advertises the correct authorization server.
- [ ] Live preview verification passes with `--expect-production --require-ready`.
- [ ] Production evidence file is saved and redacted.
- [ ] Preview deployment has been verified before any production promotion.

## Current Verdict

Status: HOLD for production launch.

Reason: provider-backed env values are missing. The application can remain in preview/demo/setup mode, but it should not be sold or promoted as managed cloud until the checklist above is green.

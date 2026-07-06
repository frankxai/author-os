# AuthorOS Revenue OS

AuthorOS launches as open core with paid convenience, craft depth, and outcome services.

## Principles

- Lifetime means local-only. No lifetime cloud, managed compute, or AI credits.
- BYOK is a trust feature, not a loophole.
- Managed credits are transparent: model, task, tokens, estimate, and margin are visible.
- Marketplace packs need manifests, compatibility, changelogs, QA gates, refunds, and takedowns.
- Services teach the roadmap before features are automated.

## First Commercial Bundle

Ship the AuthorOS Foundry Pack with:

- Fiction studio.
- Nonfiction authority workflow.
- Seven-pass revision system.
- Publishing ops checklist.
- Romance/erotica premium workflow.
- Launch asset system.
- Installable cockpit starter via `author-os packs install authoros-foundry-pack`, hosted `POST /api/projects/:id/packs`, and MCP `install_pack`.
- Concierge setup option.

The pack registry is discoverable through `author-os packs`, hosted `GET /api/packs`, and MCP `list_packs`. Hosted installs are entitlement-aware: cloud marketplace plans can install packs in hosted projects, while local premium/foundry-pack entitlements unlock local pack access. Pack installation is scaffolding-only: tasks, boards, asset placeholders, and publishing plans are added to the project graph, but manuscript prose is never generated or revised by the installer.

## Metrics

Track activation, import success, first continuity run, first approved suggestion, first export, pack conversion, managed credit margin, churn, refund rate, and concierge-to-cloud conversion.

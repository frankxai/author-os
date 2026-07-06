# Agentic Author OS Implementation Roadmap

## Implemented Foundation

- Portable story graph and cockpit view model in `packages/core`.
- Local filesystem adapter in `packages/local`.
- AI Gateway routing and credit ledger planning in `packages/ai`.
- Vercel/cloud adapter contracts in `packages/cloud`.
- MCP tool manifest, local tool handlers, and stdio-lite harness in `packages/mcp`.
- Hosted cockpit scaffold in `apps/cockpit`.
- Offer catalog and Foundry Pack manifest in `offers/`.

## Next Build Pass

- Replace demo data with authenticated workspace/project loading.
- Add Vercel Postgres/Blob implementations behind the `packages/cloud` contracts.
- Wrap `apps/cockpit/app/api/mcp` with production OAuth and `mcp-handler`.
- Add Workflows for outline -> draft -> critique -> revise -> export.
- Add Sandbox export worker for DOCX/EPUB/PDF/KDP packages.
- Add Playwright visual QA and screenshots for desktop/mobile.

## Production Notes

Keep Vercel as the primary app platform. Add Cloudflare only for WAF/bot/Turnstile, Access, R2 cold assets, or realtime collaboration needs that require Durable Objects.

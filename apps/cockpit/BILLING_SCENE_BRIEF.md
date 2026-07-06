# Billing Command Deck Scene Brief

## Surface

Route: `/billing`

The first viewport is an account and revenue control surface for hosted Arcanea Author Cockpit workspaces. It should answer: current entitlement, whether Stripe is linked, which upgrade action is available, and what evidence proves the account state.

## Static Composition

- Top: cockpit-aware navigation with workspace identity.
- Left hero panel: current plan, plan promise, account status, and entitlement source.
- Right hero panel: Stripe checkout and portal actions.
- Middle: entitlement limits and billing evidence side by side.
- Lower: cloud plan comparison plus launch-pack and portal readiness strip.

## Motion

V1 uses stable hover/focus states and no required motion. The named job for later motion is "payment state confirmation": a restrained state transition after checkout/webhook entitlement adoption.

## Asset Policy

No external or generated visual assets are introduced. The premium asset is Tier C exact product/account UI rendered from live billing adapter state.

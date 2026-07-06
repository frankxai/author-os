# Production Launch Ops Scene Brief

## Surface

Route: `/ops`

This is the operator activation room for taking Arcanea Author Cockpit from demo/local readiness into production. It must show the current launch gate, blocker count, dependency state, proof commands, and runtime mode without exposing secrets.

## Static Composition

- Top: cockpit-aware operator navigation and project id.
- Hero left: current promotion gate and next action from the canonical launch plan.
- Hero right: blocker/review/stage/action ledger.
- Middle: five launch stages with status and action counts.
- Workbench: production-evidence ledger, priority actions, environment groups, and runtime state.
- Bottom: exact proof commands needed before preview promotion.

## Motion

V1 uses stillness only. Future motion job: "gate resolution confirmation" when an action moves from blocked to pass after live environment verification.

## Asset Policy

No external or generated assets. The premium proof is Tier C exact product UI backed by the shared launch-plan model used by CLI, API, and live verification.

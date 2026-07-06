# Authoring Swarm User Flows

## Flow 1: Onboard A Repo

User goal: make a repo safe for authoring agents.

1. Agent reads repo-local `AGENTS.md`.
2. Agent runs:

```bash
author-os authoring init --repo . --dry-run
```

3. User/agent reviews files that would be created.
4. Agent runs:

```bash
author-os authoring init --repo .
```

5. Agent fills project brief fields.
6. Agent runs:

```bash
author-os authoring inventory --repo . --save
```

7. Repo now has standards, locked-state files, and an inventory report.

Expected result: future agents can see the writing contract before editing.

## Flow 2: Audit Public Website Copy

User goal: find the highest-risk public copy before improving the site.

1. Run inventory:

```bash
author-os authoring inventory --repo . --json
```

2. Filter artifacts where risk is:
   - `public-surface`
   - `brand-positioning`
   - `high`
   - `human-required`
3. Route:
   - website pages -> `website-narrative-review`
   - offer pages -> `offer-positioning-review`
   - legal/claims -> `claim-verification`
4. Produce report under `reports/authoring/evals/`.
5. Rewrite only after review and locked-state read.

Expected result: no broad rewrite starts before the copy surface is understood.

## Flow 3: Verify Offer Copy

User goal: make an offer stronger without manipulative selling or unsupported claims.

1. Read:
   - `AUTHORING_PROJECT_BRIEF.md`
   - `POSITIONING_LOCKED.md`
   - `LEGAL_CLAIMS_LOCKED.md`
   - `COMMUNITY_PROMISE_LOCKED.md`
2. Run offer review.
3. Extract claims.
4. Run claim verification for:
   - price;
   - refunds;
   - testimonials;
   - transformation claims;
   - earnings/performance claims.
5. Produce:
   - score;
   - trust risks;
   - proof gaps;
   - revised promise;
   - human-review flags.

Expected result: the offer becomes clearer and more trustworthy, not more aggressive.

## Flow 4: Multi-Model Council Review

User goal: avoid one model's taste flattening the work.

1. Prepare council packet:
   - artifact;
   - domain;
   - risk;
   - locked files read;
   - rubric version;
   - target score.
2. Send bounded review prompts to council seats.
3. Collect:
   - score;
   - top risks;
   - strongest line;
   - weakest line;
   - best rewrite opportunity;
   - dissent.
4. Run `council-synthesis`.
5. Decide:
   - ship;
   - focused pass;
   - strategy rewrite;
   - claim verification;
   - human review;
   - restart.

Expected result: disagreement becomes useful signal, not noisy committee output.

## Flow 5: Estate Writing Sweep

User goal: see authoring risk across the estate without editing anything.

1. Run:

```bash
author-os authoring inventory --estate --lanes site,frankx,arcanea --limit-repos 20 --save
```

2. Review:
   - by team;
   - by risk;
   - priority artifacts;
   - missing controls.
3. Create bounded tasks:
   - standards bootstrap;
   - website copy review;
   - claim verification;
   - offer review;
   - locked-state proposal.

Expected result: command center can show what needs authoring attention first.

## Flow 6: Locked-State Proposal

User goal: improve brand voice or positioning without silent mutation.

1. Agent reads locked file.
2. Agent writes `*.proposal.md`.
3. Proposal includes:
   - current wording;
   - proposed wording;
   - rationale;
   - risks;
   - affected artifacts;
   - reviewer recommendation.
4. Human approves or rejects.
5. Only after approval is the locked file updated.

Expected result: strategic truth evolves, but never gets rewritten by accident.

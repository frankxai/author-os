# AuthorOS

> The AI-native author operating system. Multi-agent. Multi-model. Multi-modal. From concept to published book.

AuthorOS is not a writing assistant. It's an **author's operating system** — a complete production pipeline with specialized agents, semantic memory, canon verification, and publishing automation.

Built by an author who wrote 200,000+ words with AI agents and needed infrastructure that didn't exist.

---

## Why AuthorOS

| What Authors Need | What They Get Today | What AuthorOS Delivers |
|---|---|---|
| Consistency across 200K words | Context window, then forget | Semantic vector search (2,200+ chunks, <2s) |
| Multiple expert perspectives | One generic model | 12+ specialized agents in parallel |
| Canon/lore verification | Hope for the best | `CANON_LOCKED.md` + Continuity Guardian |
| Structured revision | "Rewrite this" | Seven-Pass Revision Ritual |
| Publishing pipeline | Separate tools | Markdown → epub / pdf / kindle / web |
| Works everywhere | Locked to one platform | Claude Code, OpenCode, Codex, Gemini CLI |

---

## Quick Start

### Option 1: Claude Code

```bash
# Copy skills to your project
cp -r skills/ .claude/commands/

# Start writing
/story-architect outline "A healer discovers her power comes from the disease she's fighting"
/character-psychologist diamond "Elena — the healer"
/line-editor revise chapter-01.md
```

### Option 2: Any Coding Agent

Copy the markdown skill files to your agent's command directory. They're portable — plain markdown with structured prompts that work with Claude Code, OpenCode, Codex, Cursor, Windsurf, or any agent that reads markdown commands.

### Option 3: With Semantic Memory

```bash
# Install dependencies
pip install google-genai numpy

# Index your manuscripts
python3 memory/memsearch-sqlite.py index ./chapters/ ./worldbuilding/

# Search semantically
python3 memory/memsearch-sqlite.py search "What did the protagonist discover in the cave?"

# Check index status
python3 memory/memsearch-sqlite.py status
```

Set `GEMINI_API_KEY` or `GOOGLE_API_KEY` in your environment for embeddings.

### Option 4: The Writing Cockpit

```bash
# Create a local-first project with starter chapters, scenes, beats, canon placeholders, tasks, and canvas state
author-os init --title "The Clockwork Saint" --template romance-arc --genre "romantasy,mythic fantasy" --premise "A restoration scribe hears damaged books remember the people erased from them."

# See manuscript, story bible, agents, memory, reports, and next moves
author-os cockpit

# Persist or refresh the portable graph consumed by CLI, MCP, and the hosted cockpit
author-os sync

# Discover and install the full Foundry Pack workflow bundle without generating manuscript prose
author-os packs
author-os packs install authoros-foundry-pack

# Save a machine-readable cockpit report for dashboards or MCP
author-os cockpit --save

# Emit JSON for another agent, UI, or MCP server
author-os cockpit --json

# Generate install-ready MCP settings for Codex, Claude, local projects, and hosted cockpit
author-os mcp --client-config --mode both --host codex --url https://your-author-cockpit
```

`author-os init` creates `.authoros/project.graph.json` by default. The starter graph is planning scaffolding only: no manuscript prose is generated or applied. Use `--blank` for a bare local graph, or `--template three-act-novel|romance-arc|mystery-thriller|nonfiction-guide|series-bible` to choose the starter shape.

Read the product strategy in [`docs/ULTIMATE_WRITING_COCKPIT.md`](docs/ULTIMATE_WRITING_COCKPIT.md) and the agent integration plan in [`docs/AGENTIC_INTEGRATION_BLUEPRINT.md`](docs/AGENTIC_INTEGRATION_BLUEPRINT.md).

### Hosted Arcanea Author Cockpit

The hosted app lives in `apps/cockpit` and is Vercel-first. Local demo mode uses the sample project; production mode requires auth, Marketplace Postgres, Blob, Stripe, AI Gateway, and explicit launch readiness.
The checked-in `apps/cockpit/.env.example` is a template only: readiness treats placeholder secrets, example Postgres URLs, fake Stripe price ids, and example model slugs as blocked or review states.

```bash
pnpm --filter @author-os/cockpit build
author-os cloud-env
author-os setup-contract
author-os launch-plan
author-os cloud-readiness --json
author-os cloud-migrate --dry-run --json --no-env-file
author-os production-evidence --no-env-file
node scripts/smoke-hosted-cockpit.mjs
npm run verify:live -- https://your-preview-or-production-url
```

For protected Vercel previews, create a Vercel Protection Bypass for Automation secret and expose it to the verifier as `VERCEL_AUTOMATION_BYPASS_SECRET` or `AUTHOROS_VERCEL_PROTECTION_BYPASS`. The verifier sends it as the `x-vercel-protection-bypass` header by default, can fall back to `--vercel-bypass-query` for clients that cannot send headers, and only reports whether a bypass was provided, never the secret value. If protection blocks app JSON, the report keeps a single deployment-protection blocker and marks dependent contract checks as skipped so operators do not chase false app failures. For operator-only preview checks, a temporary Vercel share URL also works: pass the full URL with its `_vercel_share` query to `npm run verify:live`, and the verifier will warm the share cookie before checking JSON endpoints. Do not paste or persist temporary share URLs in committed reports.

Key hosted endpoints:

- `GET /api/system/readiness`
- `GET /api/system/setup-contract`
- `GET /api/system/launch-plan`
- `GET /api/system/production-evidence`
- `GET /api/packs`
- `GET /api/projects`
- `POST /api/projects` for starter seeds, explicit blank graphs, portable graph imports, and manuscript-text imports
- `GET /api/projects/:id/context`
- `POST /api/projects/:id/packs`
- `POST /api/projects/:id/agent-runs`
- `POST /api/projects/:id/exports`
- `POST /api/projects/:id/suggestions/:suggestionId/approval`
- `GET /api/mcp`
- `POST /api/mcp`
- `GET /api/mcp/client-config`
- `GET /.well-known/oauth-protected-resource`
- `GET /projects`
- `GET /setup`
- `GET /ops`
- `GET /billing`

Hosted MCP uses the same tenant-scoped services as the cockpit API for project listing, pack discovery/install, context/canon/search, scene creation, continuity, character boards, exports, run status, and publishing readiness. The hosted endpoint supports the existing simple AuthorOS JSON facade plus MCP-style JSON-RPC calls for `initialize`, `tools/list`, `tools/call`, `resources/templates/list`, `resources/list`, `resources/read`, `prompts/list`, `prompts/get`, and `ping`. Project context, canon, and readiness are exposed as read-only JSON resources, while prompt templates guide project brief, continuity, revision, and export-readiness workflows. It also serves OAuth 2.0 Protected Resource Metadata at `/.well-known/oauth-protected-resource`, and 401 MCP execution failures include a `WWW-Authenticate` discovery header with the required AuthorOS scope. The workspace can also import pasted Markdown/plain-text manuscripts into reviewable chapters, scenes, provenance assets, and queued import-review tasks before any agent changes the prose. Hosted pack installation requires cloud marketplace access or a premium/foundry-pack entitlement, returns a `packAccess` audit snapshot, and adds boards, tasks, asset placeholders, and publishing plans; it does not generate or revise manuscript prose.

Hosted agent installers can fetch the same config shape from `GET /api/mcp/client-config?host=codex&mode=hosted`. The response points at that deployment's `/api/mcp`, includes OAuth protected-resource metadata, and references token environment variable names instead of token values.

Agent install config:

```bash
author-os mcp --client-config --mode local --host claude --save .authoros/mcp-client-config.json
author-os mcp --client-config --mode both --host codex --url https://your-author-cockpit --token-env AUTHOROS_MCP_TOKEN
```

The generated config includes a local stdio server for open-core projects and a hosted Streamable HTTP server for Arcanea Author Cockpit. It references token environment variable names such as `AUTHOROS_MCP_TOKEN`; it never reads or embeds token values.

Production migration flow:

```bash
author-os cloud-env --example > apps/cockpit/.env.example
author-os cloud-env --vercel --baseline --project author-os --environments production,preview --app-url https://author.arcanea.ai --preview-branch authoros-preview
author-os cloud-env --vercel --audit --project author-os --environments production,preview
author-os cloud-env --vercel --project author-os --environments production,preview --preview-branch authoros-preview
author-os setup-contract --save
author-os launch-plan --save
vercel env pull .env.local --yes
author-os cloud-env --require-ready --env-file .env.local
author-os cloud-migrate --status --env-file .env.local
author-os cloud-migrate --apply --env-file .env.local
author-os cloud-migrate --status --require-current --env-file .env.local
author-os cloud-readiness --require-ready --env-file .env.local
author-os launch-plan --check-db --preview-verified --require-ready --env-file .env.local
author-os production-evidence --env-file .env.local --live-url https://your-preview-url --remote-env-audit --preview-branch authoros-preview --require-ready --save
author-os production-evidence --env-file .env.local --live-url https://your-preview-url --remote-env-audit --preview-branch authoros-preview --vercel-bypass-secret $AUTHOROS_VERCEL_PROTECTION_BYPASS --require-ready --save
npm run verify:live -- https://your-preview-url --expect-production --require-ready
```

`cloud-env --vercel --baseline` prints apply-ready commands for deterministic non-secret values only: demo mode off, auth required, Clerk provider selected, Postgres adapter selected, local sign-in routes, pool limits, and token budgets. It does not print or invent secrets, database URLs, Stripe price ids, AI Gateway keys, OAuth issuers, or observability keys. For Preview writes, pass `--preview-branch <non-production-branch>` so Vercel CLI can scope the variable to a real preview branch; do not use the production branch. `cloud-env --vercel --audit` runs `vercel env ls` and proves remote name/environment presence only; because Vercel returns encrypted values, it never replaces `cloud-env --require-ready`, provider dashboard proof, database migration checks, or live verification. `production-evidence --remote-env-audit` includes that presence-only audit in the sanitized promotion dossier, and `--require-ready` requests it automatically. `cloud-env --require-ready` rejects missing, placeholder, and invalid values. Do not use `.env.example` as deployment evidence; use a pulled `.env.local` or Vercel project environment populated with real Clerk, Postgres, Blob, Stripe, AI Gateway, app URL, and observability values.
Production evidence also emits `operatorNextActions`: a sanitized, priority-ordered queue for Codex, CI, or a human operator. It consolidates remote env presence, local env value validation, provider connector blockers, database migration state, protected-preview access, live verification, and launch-plan blockers into executable next commands without embedding secrets.
Vercel production targets are sealed against demo runtime: even if `AUTHOROS_DEMO_MODE=true` is accidentally present, the hosted app reports production mode, requires verified auth context, and uses unconfigured or production adapters instead of serving sample author data.
If Vercel deployment protection is enabled on preview deployments, create a Protection Bypass for Automation secret and expose it only to the operator/CI environment as `AUTHOROS_VERCEL_PROTECTION_BYPASS` or `VERCEL_AUTOMATION_BYPASS_SECRET`; the live verifier and production-evidence collector redact this value from reports.

See [`docs/VERCEL_PRODUCTION_RUNBOOK.md`](docs/VERCEL_PRODUCTION_RUNBOOK.md) for the production data-plane contract.

Deployment automation:

- `vercel.json` builds `apps/cockpit` from the monorepo root and skips docs-only Vercel builds.
- `author-os-ci.yml` runs tests, dry-run cloud gates, build, and smoke.
- `vercel-preview.yml` is manual and gated by `AUTHOR_OS_USE_ACTIONS_VERCEL=true` for prebuilt previews and live URL verification.
- `vercel-promote.yml` promotes a validated preview only after env, migration, readiness, launch-plan, and live URL checks.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      AUTHOR OS                               │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Skills (portable markdown — works with any coding agent)    │
│  ├── story-architect    — Structure, arc, beats              │
│  ├── character-psych    — Diamond, voice, motivation         │
│  ├── line-editor        — Prose polish, anti-slop            │
│  ├── continuity         — Cross-book consistency             │
│  ├── memory-search      — Semantic vector search             │
│  ├── codex-link         — Auto-surface canon references      │
│  ├── describe           — Five sensory expansions            │
│  ├── draft-zero         — Full outline from concept          │
│  └── publish            — epub / pdf / kindle / web          │
│                                                              │
│  Agents (multi-model orchestration)                          │
│  ├── Calliope    — Story generation (Gemini / Opus)          │
│  ├── Mnemosyne   — Semantic memory (SQLite, any model)       │
│  ├── Orpheus     — Voice & dialogue (Sonnet / MiniMax)       │
│  ├── Aristotle   — Structural editing (Opus)                 │
│  └── Thoth       — Quick validation (Haiku)                  │
│                                                              │
│  Memory (SQLite + embeddings)                                │
│  ├── memsearch-sqlite.py — Vector search engine              │
│  ├── lorebook.json       — Standard character/world DB       │
│  └── canon.md            — Immutable truth source            │
│                                                              │
│  Publishing                                                  │
│  ├── epub, pdf, kindle, docx, web, blog                      │
│  └── Content cascade: post → thread → chapter → book         │
│                                                              │
│  Multi-Modal                                                 │
│  ├── Image — scene illustrations, character art, covers      │
│  ├── Audio — narration, soundtrack, audiobook                │
│  └── Video — trailers, social content, lore videos           │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## The Seven-Pass Revision Ritual

Every chapter passes through seven specialized lenses. Each pass has one job. No pass tries to do everything.

| Pass | Name | Focus | What It Catches |
|------|------|-------|-----------------|
| 1 | **Structural** | Arc, pacing, scene purpose | Dead scenes, pacing holes, missing beats |
| 2 | **Character** | Voice differentiation, motivation | Everyone sounds the same, unmotivated action |
| 3 | **Scene** | Does each scene earn its place? | Scenes that inform but don't transform |
| 4 | **Dialogue** | Subtext, character-specific speech | On-the-nose dialogue, talking heads |
| 5 | **Prose** | AI pattern elimination, rhythm | Slop words, passive voice, repetition |
| 6 | **Continuity** | Canon, timeline, facts | Timeline breaks, contradictions, forgotten details |
| 7 | **Polish** | Word-level musicality | Weak verbs, missed rhythm, final polish |

Use them in order. Use them individually. Use whichever your chapter needs. The skill files implement each pass as a standalone command.

---

## Multi-Agent, Multi-Model

Different writing tasks need different kinds of intelligence. AuthorOS routes to the right model:

| Agent | Classical Genius | Best Model | Specialty |
|-------|-----------------|------------|-----------|
| **Calliope** | Muse of Epic Poetry | Gemini 2.5 / Opus | Story generation, world-building |
| **Mnemosyne** | Titan of Memory | Any (SQLite-based) | Semantic search across manuscripts |
| **Orpheus** | Master of Music | Sonnet / MiniMax | Voice, dialogue, rhythm |
| **Aristotle** | Author of Poetics | Opus | Structure, revision, analysis |
| **Thoth** | God of Writing | Haiku / Flash | Quick validation, fact-checking |

You don't need all models. Start with whatever you have. The skills work with any single model — multi-model is an optimization, not a requirement.

---

## Multi-Coding-Agent Orchestration

Run multiple coding agents simultaneously, sharing the same memory:

```
Terminal 1: Claude Code   → Deep structure, revision, editing
Terminal 2: OpenCode      → Creative drafting (routes to Gemini)
Terminal 3: Codex         → Research, fact-checking, continuity
Shared:     memsearch-sqlite.py (SQLite = file-based, all agents read/write)
```

SQLite's WAL mode handles concurrent reads. One writer at a time, but reads are non-blocking. This means three agents can search your 200K-word manuscript simultaneously while one indexes new content.

---

## Content Cascade

One piece of writing becomes many formats:

```
Blog Post → Twitter Thread → Newsletter → Chapter → Book → Audiobook
     ↓           ↓              ↓           ↓         ↓         ↓
   Ghost      Twitter       Substack      epub      Amazon   ElevenLabs
```

The `publish` skill handles format conversion. Write once in markdown, publish everywhere.

---

## The Ecosystem

AuthorOS is the authoring core of a larger creative intelligence ecosystem. You can use AuthorOS standalone and never touch the rest — but if you want to go deeper, everything connects.

```
frankxai Ecosystem
├── AUTHORING
│   ├── author-os              ← YOU ARE HERE (universal core)
│   ├── author-os-skills       ← Skill marketplace for all agents
│   └── arcanea-author         ← Mythology-enhanced extension
│
├── INTELLIGENCE
│   ├── opencode-arcanea       ← Multi-model runtime (11 Greek god agents)
│   ├── claude-arcanea         ← Claude Code integration layer
│   └── Starlight Intelligence ← 5-layer cognitive architecture
│
├── PLATFORMS
│   ├── arcanea.ai             ← Creator platform (Next.js + Supabase)
│   ├── frankx.ai              ← Personal hub
│   └── Arcanea monorepo       ← 27 repos, 35 npm packages
│
├── TOOLS
│   ├── arcanea-mcp            ← MCP server (worldbuilding, canon)
│   ├── arcanea-memory         ← Memory MCP (vault, horizon)
│   ├── memsearch-sqlite       ← Vector search (included in this repo)
│   └── arcanea-infogenius     ← Visual intelligence
│
├── CONTENT
│   ├── Library of Arcanea     ← 200K+ words, 17 collections
│   ├── arcanea-lore           ← Canon, Guardians, Godbeasts
│   └── book/                  ← Published creative works
│
└── AUTOMATION
    ├── n8n workflows          ← Publishing automation
    ├── Claude Code hooks      ← Session capture, quality gates
    └── GitHub Actions         ← CI/CD across repos
```

### How AuthorOS Fits

AuthorOS is **the universal authoring layer**. It has zero dependencies on the rest of the ecosystem — any author can use it with any coding agent on any project. The Arcanea ecosystem extends it with mythology, gamification, memory systems, and publishing infrastructure, but AuthorOS stands alone.

Think of it like this:
- **AuthorOS** = the engine
- **author-os-skills** = the parts catalog
- **arcanea-author** = a fully-built vehicle using that engine
- **arcanea.ai** = the racetrack where vehicles compete

---

## The Creator Economy Pipeline

AuthorOS handles the writing. The broader ecosystem handles everything after.

```
Blog Post → Newsletter → Book Chapter → Published Book → Audiobook → Course → Community → Collectibles
    │            │             │              │              │           │          │            │
    ▼            ▼             ▼              ▼              ▼           ▼          ▼            ▼
  Ghost      Substack     AuthorOS        Amazon       ElevenLabs   Academy    Discord      Web3
  Medium    ConvertKit    + publish       Lulu         + AI voice   Courses    Forums     On-chain
  Blog        Email        skill         IngramSpark   Narration    Workshops  Co-creation  IP NFTs
```

Each stage has tooling in the ecosystem. AuthorOS owns the **writing and revision** stages. The `publish` skill bridges into distribution. The broader frankxai ecosystem provides platforms, automation, and monetization infrastructure for everything downstream.

**The key insight**: a single well-written chapter can become a blog post, a newsletter issue, a book section, a course module, and a collectible artifact. AuthorOS's content cascade makes this practical, not theoretical.

---

## For Authors Who Want More

AuthorOS is designed as a starting point. Here's the progression path for authors who want to go deeper:

| Level | What You Do | What You Gain | Tools |
|-------|------------|---------------|-------|
| **1. Write** | Install AuthorOS skills | Structured revision, anti-slop, multi-pass editing | `skills/`, any coding agent |
| **2. Remember** | Add semantic memory | Never lose track of your canon across 200K+ words | `memsearch-sqlite.py`, Gemini embeddings |
| **3. Mythologize** | Add Arcanean extension | Elemental writing modes, Gate progression, Guardian agents | [arcanea-author](https://github.com/frankxai/arcanea-author) |
| **4. Orchestrate** | Build your own agent team | Personalized AI collaborators tuned to your voice and genre | [opencode-arcanea](https://github.com/frankxai/opencode-arcanea), [claude-arcanea](https://github.com/frankxai/claude-arcanea) |
| **5. Build Worlds** | Create your own universe | Full world framework — lore, characters, magic systems, game dev | [arcanea.ai](https://arcanea.ai), [arcanea-mcp](https://github.com/frankxai/arcanea-mcp) |
| **6. Teach** | Share what you learned | Courses, academies, communities, the creator economy | [arcanea.ai/academy](https://arcanea.ai/academy) |

You can stop at any level. Each level is complete on its own. But if you keep going, everything compounds — your memory systems feed your world-building, your world-building feeds your courses, your courses feed your community.

---

## What Authors Learn

Using AuthorOS teaches skills that transfer far beyond writing:

- **Multi-agent orchestration** — Managing AI writing teams with specialized roles (not one chatbot doing everything)
- **Prompt engineering for fiction** — Real craft techniques: voice calibration, anti-slop detection, subtext generation. Not marketing copy — literature.
- **Semantic memory systems** — Vector search, canon management, lorebook architecture. The same tech powering RAG at scale, applied to your manuscripts.
- **Publishing automation** — Markdown to every format. One source, infinite outputs. The same CI/CD philosophy that transformed software engineering.
- **Creator economy** — Monetization beyond book sales: content cascades, community building, licensing, teaching.
- **World-building as a discipline** — Systematic universe construction with internal consistency, transmedia potential, and franchise architecture.

---

## Related Repositories

| Repository | Description | Link |
|-----------|-------------|------|
| **author-os-skills** | Skill marketplace — community-contributed skills for all agents | [frankxai/author-os-skills](https://github.com/frankxai/author-os-skills) |
| **arcanea-author** | Mythology-enhanced AuthorOS with Ten Gates, Five Elements, Guardian agents | [frankxai/arcanea-author](https://github.com/frankxai/arcanea-author) |
| **opencode-arcanea** | Multi-model runtime with 11 Greek god agents for creative intelligence | [frankxai/opencode-arcanea](https://github.com/frankxai/opencode-arcanea) |
| **claude-arcanea** | Claude Code overlays, hooks, and session management for Arcanea workflows | [frankxai/claude-arcanea](https://github.com/frankxai/claude-arcanea) |
| **arcanea-mcp** | MCP server for worldbuilding, canon validation, and creative intelligence | [frankxai/arcanea-mcp](https://github.com/frankxai/arcanea-mcp) |
| **arcanea-memory** | Memory MCP server — vault storage, horizon append, semantic recall | [frankxai/arcanea-memory](https://github.com/frankxai/arcanea-memory) |
| **arcanea-infogenius** | Visual intelligence — infographic generation, research, visual storytelling | [frankxai/arcanea-infogenius](https://github.com/frankxai/arcanea-infogenius) |
| **arcanea-lore** | Canonical lore — Guardians, Godbeasts, Gates, Elements, the Arcanean universe | [frankxai/arcanea-lore](https://github.com/frankxai/arcanea-lore) |
| **arcanea-skills-opensource** | 54 open-source skills for Claude Code and other coding agents | [frankxai/arcanea-skills-opensource](https://github.com/frankxai/arcanea-skills-opensource) |

---

## Why This Matters

Authors are the original world-builders. Long before software engineers, authors constructed universes with internal logic, character systems, plot architectures, and canon that spans thousands of pages.

Software engineering got CI/CD, version control, automated testing, deployment pipelines, code review, and collaboration tools. Authors got... Word and hope.

AuthorOS changes that.

**Structured pipelines** — Seven-Pass Revision isn't "AI rewrite my chapter." It's a disciplined editing methodology where each pass has one job, one focus, one set of things it catches. The same rigor as a test suite, applied to prose.

**Quality gates** — Anti-slop detection catches the patterns that make AI writing sound like AI writing. Canon verification catches contradictions before readers do. Continuity checks span your entire manuscript, not just the current context window.

**Memory systems** — Semantic vector search means your AI collaborators can find relevant passages across 200,000 words in under two seconds. Your characters stay consistent. Your world stays coherent. Your canon stays locked.

**Collaboration tools** — Multi-agent orchestration means different AI models handle different aspects of writing: one for structure, one for dialogue, one for prose rhythm, one for fact-checking. Not one generalist doing everything poorly — specialists doing their jobs well.

This is not about replacing authors. It never was. The best AI-assisted writing still requires an author with vision, taste, and craft. AuthorOS gives that author **superpowers** — the same kind of superpowers that IDEs, debuggers, and CI/CD gave software engineers.

The author remains the architect. AuthorOS is the construction crew.

---

## File Structure

```
author-os/
├── skills/                     # Portable markdown skills
│   ├── story-architect.md      # Structure and arc
│   ├── character-psychologist.md # Character development
│   ├── line-editor.md          # Prose editing
│   └── publish.md              # Publishing pipeline
├── memory/                     # Semantic search engine
│   └── memsearch-sqlite.py     # SQLite + Gemini embeddings
├── templates/                  # Starting templates
│   └── novel/
│       └── outline.md          # Novel outline template
├── docs/                       # Architecture documentation
│   ├── ARCHITECTURE.md         # System design
│   ├── COMMAND_CENTER.md       # Publishing house dashboard concept
│   ├── ULTIMATE_WRITING_COCKPIT.md
│   └── AGENTIC_INTEGRATION_BLUEPRINT.md
├── bin/
│   ├── author.js               # CLI, including `author-os cockpit`
│   └── quality-check.js        # Local quality gate
└── README.md
```

---

## Extends to Arcanean AuthorOS

AuthorOS is the universal foundation. For mythology-enhanced authoring with Ten Gates progression, Five Elements writing modes, Guardian agents, and Web3 publishing, see [arcanea-author](https://github.com/frankxai/arcanea-author).

The relationship:

```
AuthorOS (universal)
  └── Arcanean AuthorOS (mythology + gamification + Web3)
```

AuthorOS gives you the production pipeline. Arcanean AuthorOS adds a creative framework on top.

---

## Requirements

- **Minimum**: Any coding agent that reads markdown files (Claude Code, OpenCode, Codex, Cursor, etc.)
- **For semantic memory**: Python 3.10+, `google-genai`, `numpy`, a Gemini API key
- **For publishing**: Pandoc (epub/pdf/docx conversion)

---

## Contributing

AuthorOS is open source. Contributions welcome:

- New skills (follow the markdown skill format in `skills/`)
- Memory engine improvements
- Publishing format support
- Agent coordination patterns
- Templates for different genres

---

## License

MIT

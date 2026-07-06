# Ultimate Writing Cockpit

> The cockpit is not another blank page. It is the author's operating console: manuscript, canon, agents, quality, publishing, and business signal in one inspectable system.

## Executive Recommendation

Build AuthorOS as a two-layer product:

1. **Open core AuthorOS**
   - Local-first, genre-agnostic writing studio.
   - Plain files, Git, SQLite memory, markdown skills, CLI, MCP server.
   - Useful to any novelist, nonfiction author, screenwriter, serial writer, editor, or small press.

2. **Arcanea Author Cockpit**
   - Premium branded layer on top of AuthorOS.
   - Fiction workflows, romance/erotica packs where allowed, series strategy, cover and metadata systems, creator accounts, publishing pipelines, marketplace, courses, community, and agentic services.

The open core should win trust and portability. The Arcanea layer should win depth, taste, workflow polish, templates, and managed publishing outcomes.

## Market Scan

The current author-tool landscape splits into five buckets.

| Tool | What It Owns | What It Does Not Fully Own |
|---|---|---|
| Novelcrafter | AI-aware story bible, Codex mentions, progressions, BYOK/OpenRouter, prompt customization | Local-first repo ownership, multi-agent orchestration, open extensibility, full publishing/business cockpit |
| Sudowrite | Polished fiction assistant, Story Bible, draft generation from structured context | Sovereign local files, coding-agent interoperability, cost transparency, inspectable agent logs |
| Plottr | Visual outlining, templates, character sheets, series bible, no-AI positioning | Actual drafting workspace, agent workflows, memory, publishing automation |
| Campfire / World Anvil | Deep worldbuilding, modules, maps, lore, reading/community surfaces | Author-owned agent execution, local-first CLI/MCP substrate |
| Scrivener / Reedsy / Obsidian Longform | Manuscript organization, exports, low-friction writing, established author trust | AI-native continuity graph, multi-model agents, automated quality and publishing operations |

The gap is clear: existing tools are either strong writing apps, strong planning apps, or strong AI assistants. None are a transparent author operations layer where agents can read, act, validate, publish, and report across the whole book business.

## Positioning

**AuthorOS is the GitHub + IDE + CI/CD layer for books.**

Novelcrafter asks: "How can AI help you write inside a fiction app?"

AuthorOS asks: "How can an author run a whole publishing house with agents, files, memory, quality gates, and ownership?"

That is the distinction to protect.

## Product Layers

### Layer 1: AuthorOS Open Core

Open-source under MIT.

Core capabilities:

- Project structure: books, series, universes, chapters, scenes, notes, research, characters, worldbuilding, publishing.
- Story bible: characters, locations, lore, objects, organizations, timelines, subplots, style guides.
- Continuity graph: mentions, facts, progressions, appearances, relationships, unresolved promises.
- Memory: SQLite vector search plus exact JSON/YAML facts.
- Skills: portable markdown commands for any agent.
- CLI: init, status, search, quality, publish, cockpit.
- MCP: expose books, scenes, facts, quality checks, exports, and agent tasks to Claude, Codex, Cursor, ChatGPT, and other clients.
- Export: markdown, docx, epub, pdf, web, JSON, world bible bundles.
- Quality gates: anti-slop, style drift, canon contradiction, timeline breaks, missing sensory detail, duplicate scenes, unresolved setup/payoff.

### Layer 2: Arcanea Author Cockpit

Premium layer.

Capabilities:

- Arcanea-branded author dashboard.
- Genre packs: fantasy, sci-fi, romantasy, romance, thriller, LitRPG, memoir, business nonfiction, spiritual fiction.
- Premium romance/erotica workflows where platform and provider policy allow it, with age/safety boundaries and user-owned local content.
- Series factory: universe strategy, spin-off planning, character chemistry, reader promise, trope map, pen-name strategy.
- Cover, blurb, metadata, categories, keywords, launch calendar.
- Beta reader and community feedback loops.
- Marketplace for templates, story bibles, world kits, prompt packs, cover systems, and agent teams.
- Managed "agentic author as a service" packages for authors who want outcomes rather than infrastructure.

## Cockpit Surface

The first screen should be the working command deck, not a landing page.

### Primary Panels

| Panel | Purpose |
|---|---|
| Project Pulse | Books, series, word count, chapter status, deadline, daily velocity |
| Manuscript Map | Acts, chapters, scenes, POV, location, purpose, emotional in/out |
| Story Bible | Characters, world, lore, objects, factions, rules, timelines |
| Continuity Graph | Mentions, contradictions, progressions, unresolved setup/payoff |
| Agent Team | Active tasks, owner model, cost, confidence, outputs awaiting approval |
| Quality Gates | Prose score, AI tic count, style drift, canon compliance, research citations |
| Publishing Pipeline | Formats, metadata, cover assets, platform status, launch checklist |
| Reader/Business Signal | Reviews, beta feedback, newsletter, sales, reader magnets, series funnel |

### Author Modes

| Mode | What Changes |
|---|---|
| Draft | Fullscreen writing, minimal dashboards, memory suggestions only on request |
| Architect | Outlines, beats, character arcs, timeline, graph views |
| Revise | Seven-pass ritual, scene diagnostics, issue queues |
| Canon | Locked facts, progressions, mention maps, contradictions |
| Publish | Export, metadata, cover, compliance, launch assets |
| Studio | Covers, illustrations, trailers, audio, social assets |
| Business | Revenue, mailing list, reader magnets, reviews, experiments |

## Fiction Domain Model

Minimum viable schema:

```json
{
  "project": {
    "id": "book-or-series-slug",
    "type": "book|series|universe",
    "title": "Working Title",
    "genre": ["fantasy", "romance"],
    "stage": "ideation|outline|draft|revision|publish|launched"
  },
  "manuscript": {
    "chapters": [],
    "scenes": [],
    "versions": []
  },
  "bible": {
    "characters": [],
    "locations": [],
    "lore": [],
    "objects": [],
    "organizations": [],
    "rules": [],
    "timelines": [],
    "styleGuides": []
  },
  "continuity": {
    "mentions": [],
    "facts": [],
    "progressions": [],
    "contradictions": [],
    "openLoops": []
  },
  "agents": {
    "tasks": [],
    "runs": [],
    "qualityReports": []
  },
  "publishing": {
    "formats": [],
    "metadata": {},
    "assets": [],
    "platforms": []
  }
}
```

The open core can store this as JSON files plus markdown. The premium app can project it into Supabase/Postgres later without breaking local ownership.

## Agent Team

Core agents:

- Story Architect: premise, structure, beats, promises, escalation.
- Character Psychologist: desire, wound, mask, truth, relationships, voice.
- World Architect: rules, cultures, systems, timeline, implications.
- Continuity Guardian: contradictions, progressions, timeline, open loops.
- Line Editor: rhythm, clarity, voice, AI tic removal.
- Research Librarian: sources, factual claims, citations, plausibility.
- Publishing Strategist: positioning, metadata, categories, launch plan.
- Rights and Safety Reviewer: AI disclosure, copyright risk, platform compliance.

Arcanea agents:

- Series Oracle: franchise and universe strategy.
- Chemistry Architect: romance tension, POV arcs, relationship escalation.
- Trope Strategist: market-aware trope use without formulaic writing.
- Cover Director: cover system and visual consistency.
- Reader Magnet Agent: free novella, bonus scenes, newsletter hooks.
- Marketplace Curator: templates and world kits for other creators.

## MCP Strategy

The MCP server is the bridge that turns AuthorOS from a CLI into a universal cockpit.

Expose resources:

- `author://projects`
- `author://project/{id}/manifest`
- `author://project/{id}/manuscript`
- `author://project/{id}/story-bible`
- `author://project/{id}/continuity`
- `author://project/{id}/quality`
- `author://project/{id}/publishing`

Expose tools:

- `scan_project`
- `search_memory`
- `extract_mentions`
- `check_continuity`
- `run_quality_gate`
- `create_scene_card`
- `update_story_bible`
- `queue_agent_task`
- `export_book`
- `generate_launch_assets`

Expose prompts:

- `draft_scene_from_beats`
- `revise_scene_pass`
- `character_interview`
- `canon_contradiction_review`
- `book_positioning_review`

## Business Model

Recommended path: **open core + paid Arcanea cloud + managed services**.

| Tier | Offer | Price Logic |
|---|---|---|
| Free OSS | CLI, skills, local files, memory, basic quality, MCP server | Adoption and trust |
| Pro Local | Premium genre packs, advanced gates, exporters, visual templates | One-time or annual license |
| Arcanea Cloud | Hosted cockpit, sync, collaboration, marketplace, dashboards | SaaS subscription |
| Agentic Author Service | Done-with-you book cockpit setup, series strategy, publishing pipeline | High-ticket service |
| Marketplace | Templates, genre packs, agent packs, covers, story-bible kits | Revenue share |

Do not start as pure SaaS. Authors distrust lock-in and AI training ambiguity. Start local-first and open-core; earn SaaS by making hosted collaboration and publishing operations obviously worth it.

## Roadmap

### Phase 0: Now

- Add cockpit CLI and durable specs.
- Define manifest schema.
- Add import/export expectations for markdown, Novelcrafter-like Codex export, Scrivener/Word pathways.

### Phase 1: Open Core MVP

- `author-os cockpit --json`.
- `author-os init --template three-act-novel|romance-arc|mystery-thriller|nonfiction-guide|series-bible`, with `--blank` reserved for a bare graph.
- Story bible JSON/YAML templates.
- Continuity scanner: exact mention extraction and unresolved facts.
- MCP server with read-only resources plus safe tools.
- Obsidian/Longform compatibility pattern.

### Phase 2: Author Studio UI

- Local or web dashboard reading the same files.
- Manuscript map, story bible, task queue, quality report.
- Agent run logs and approval gates.

### Phase 3: Arcanea Product Layer

- Arcanea Author Cockpit route.
- Premium fiction packs.
- Publishing metadata and cover pipeline.
- Marketplace primitives.

### Phase 4: Managed Agentic Publishing

- Done-with-you onboarding.
- Import from Scrivener/Novelcrafter/Google Docs/Obsidian.
- Series strategy and launch automation.
- Human editorial partner network.

## Non-Negotiables

- Local-first manuscript ownership.
- No hidden training claims.
- Human approval before publication or canon mutation.
- Full export at every tier.
- Agent logs are inspectable.
- Quality gates help the author write better; they do not replace taste.
- Fiction support includes genre freedom, but distribution and provider policy boundaries must be explicit.

## Source Notes

- Novelcrafter Codex: https://www.novelcrafter.com/features/codex
- Novelcrafter OpenRouter docs: https://www.novelcrafter.com/help/docs/ai-connections/openrouter
- Sudowrite Story Bible: https://docs.sudowrite.com/using-sudowrite/1ow1qkGqof9rtcyGnrWUBS/what-is-story-bible/jmWepHcQdJetNrE991fjJC
- Plottr features: https://plottr.com/
- Campfire writing modules: https://www.campfirewriting.com/write
- Scrivener overview: https://www.literatureandlatte.com/scrivener/overview
- Reedsy Studio: https://reedsy.com/studio/write-a-book
- World Anvil novel writing: https://www.worldanvil.com/features/novel-writing-software
- Obsidian Longform: https://github.com/kevboh/longform
- MCP architecture: https://modelcontextprotocol.io/docs/concepts/architecture

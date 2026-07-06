# Agentic Integration Blueprint

> AuthorOS should feel like one cockpit even when the author uses many agents.

## Core Decision

AuthorOS should not choose one AI client as the winner. It should provide a shared local substrate that many clients can use:

- Files for source of truth.
- SQLite for memory and run logs.
- CLI for deterministic operations.
- MCP for assistant interoperability.
- ACOS for skill and plugin packaging.
- Arcanea for premium hosted workflows.

This keeps the author sovereign and lets each agent do the work it is best at.

## Roles By Agent Surface

| Surface | Best Role | Why |
|---|---|---|
| Codex | Research, repo work, scanners, implementation, continuity tools, MCP/server development | Strong at codebase edits, audits, CLI/MCP construction, structured reasoning |
| Claude App / Claude Desktop | Conversational book coaching, scene ideation, character interviews, high-context creative review through MCP resources | Strong as author-facing collaborator with MCP access to manuscript context |
| Claude Code | Deep revision, long-form restructuring, skill execution, local file operations, editorial passes | Strong at working inside a project with files, skills, hooks, and commands |
| ChatGPT / OpenAI clients | Brainstorming, broad ideation, user-facing assistant experiences, multimodal review where available | Useful as another MCP host/client once connected |
| Cursor / Windsurf / VS Code | Markdown-native authoring, UI development, project edits | Good for authors who already live in code editors |
| ACOS | Cross-agent packaging, skills, hooks, routing, safety, plugin marketplace | The distribution substrate for skills and workflows |
| Arcanea | Premium cockpit, branded workflows, hosted marketplace, author accounts, publishing ops | The commercial product layer |

## Shared Substrate

Every book project should be a folder like:

```text
book-project/
  authoros.json
  outline.md
  CANON_LOCKED.md
  chapters/
  scenes/
  characters/
  worldbuilding/
  research/
  notes/
  tasks/
    agents.json
    queue.json
  memory/
    authoros.sqlite
  reports/
    cockpit.json
    quality/
  output/
```

The key is that all clients read the same files. No tool owns the manuscript.

## MCP Server Shape

The first MCP server should be local and conservative. It can expose read-heavy resources immediately, then add write tools behind explicit approval.

### Resources

| Resource | Content |
|---|---|
| `author://projects` | Known projects and roots |
| `author://project/{id}/manifest` | `authoros.json` |
| `author://project/{id}/cockpit` | Latest scan from `author-os cockpit --json` |
| `author://project/{id}/chapters` | Chapter list and word counts |
| `author://project/{id}/story-bible` | Characters, world, canon, timelines |
| `author://project/{id}/memory/status` | Index freshness, chunks, embedding provider |
| `author://project/{id}/quality/latest` | Quality reports and open issues |

### Tools

| Tool | Approval |
|---|---|
| `scan_project` | No approval, read-only |
| `search_memory` | No approval, read-only |
| `run_quality_gate` | No approval if it writes only reports |
| `extract_mentions` | No approval if it writes only reports |
| `queue_agent_task` | Approval recommended |
| `create_scene_card` | Approval recommended |
| `update_story_bible` | Approval required |
| `lock_canon_fact` | Approval required |
| `export_book` | Approval required |
| `publish_or_upload` | Human-only, no autonomous execution in open core |

### Prompts

- `story_architect_review`
- `character_voice_review`
- `continuity_guardian_review`
- `line_edit_pass`
- `publishing_positioning_review`
- `reader_magnet_plan`

## How Codex Should Work With It

Codex is the builder and auditor.

Ideal Codex workflows:

- Implement AuthorOS CLI, MCP server, tests, importers, exporters, dashboard UI.
- Audit a manuscript repo for structure, missing canon, dead links, TODOs, and quality reports.
- Build deterministic tools agents can trust: mention extraction, word counts, scene maps, continuity reports.
- Compare generated output with locked canon.
- Maintain open-core package health, docs, release notes, and CI.

Codex should avoid being the primary "write me the chapter" surface unless the author explicitly wants that inside a repo. Its strongest role is making the cockpit powerful, inspectable, and trustworthy.

## How Claude App / Claude Desktop Should Work With It

Claude App should be the author-facing salon.

Ideal Claude workflows:

- Talk through a book idea while reading `author://project/{id}/cockpit`.
- Interview characters using story-bible context.
- Ask "what changed in this character after chapter 8?" and receive memory-backed answers.
- Review a chapter with a named pass: structure, character, scene, dialogue, prose, continuity, polish.
- Suggest next actions, then queue tasks instead of silently editing canon.

Claude App via MCP should be mostly read and queue. Writes should be explicit and reviewable.

## How Claude Code Should Work With It

Claude Code is the local editorial workshop.

Ideal Claude Code workflows:

- Execute skills directly against files.
- Run the Seven-Pass Revision Ritual.
- Apply controlled edits to chapters.
- Update task queues and reports.
- Use hooks to run quality checks after chapter edits.
- Invoke MCP tools for memory and quality where useful.

Claude Code can safely modify manuscripts because it operates inside a local repo with diffs and human review.

## How ACOS Should Package It

ACOS should be the installer and skill marketplace layer.

Recommended packaging:

- `author-os-core`: CLI, templates, basic skills, quality checks.
- `author-os-mcp`: local MCP server.
- `author-os-fiction-pack`: story bible, continuity, scene, character, worldbuilding.
- `author-os-nonfiction-pack`: research, citations, frameworks, claims, structure.
- `arcanea-author-pack`: premium Arcanea workflows and genre packs.
- `author-os-publishing-pack`: export, metadata, launch, beta reader, reader magnet.

The open core should install cleanly without ACOS. ACOS should make it easier, richer, and multi-client aware.

## How Arcanea Should Productize It

Arcanea should not hide AuthorOS. It should elevate it.

Arcanea products:

1. **Arcanea Author Cockpit**
   - Hosted or local dashboard.
   - Beautiful UI over the same AuthorOS files and MCP server.
   - Agent tasks, manuscript map, story bible, publishing pipeline.

2. **Arcanea Fiction Foundry**
   - Premium fiction workflows.
   - Genre packs and series bibles.
   - Character chemistry, trope map, serial strategy, cover systems.

3. **Arcanea Author Service**
   - Human-plus-agent done-with-you setup.
   - Import an author's existing manuscript/tool stack.
   - Build their cockpit, memory, quality gates, and publishing pipeline.

4. **Arcanea Marketplace**
   - Templates, prompt packs, genre systems, cover packs, agent teams.
   - Revenue share with authors/editors/designers.

## Open Core vs SaaS Verdict

Best path:

1. **Open-core first**
   - Authors need trust, ownership, export, and privacy.
   - Open source creates credibility against AI-writing skepticism.

2. **Installable plugin second**
   - ACOS, Claude Code, Codex, Cursor, Obsidian, and MCP packages.
   - Let authors bring their preferred environment.

3. **SaaS third**
   - Sell hosted sync, collaboration, marketplace, managed publishing, asset pipelines, analytics, and service.

Pure SaaS is too easy to dismiss as "another AI writing app." Pure open source leaves money on the table. Open core plus premium Arcanea cockpit is the highest-leverage pattern.

## First Build Milestones

### Milestone 1: Local Cockpit

- `author-os cockpit`
- `author-os cockpit --json`
- `authoros.json` template
- reports folder
- task queue format

### Milestone 2: Read-Only MCP

- List projects.
- Read cockpit.
- Read chapters and story bible.
- Search memory.
- Run scan without mutating files.

### Milestone 3: Quality Engine

- AI tic detection.
- Style drift checks.
- Character mention extraction.
- Canon contradiction candidates.
- Scene purpose map.

### Milestone 4: Arcanea UI

- Dashboard over generated cockpit JSON.
- Agent queue and report views.
- Manuscript map.
- Story-bible browser.

### Milestone 5: Publishing Pipeline

- EPUB/PDF/docx.
- Cover and metadata checklist.
- Launch asset generation.
- AI disclosure and platform compliance report.

## Safety And Trust Rules

- Never mutate `CANON_LOCKED.md` without human approval.
- Never publish/upload without human approval.
- Never obscure model cost, provider, or generated output provenance.
- Always preserve export.
- Always make agent work diffable.
- Treat NSFW and romance content as user-owned local work with explicit platform/provider boundaries.
- Keep copyrighted reference imports separate from generated output and cite sources in research notes.

## Author Promise

AuthorOS helps an author:

- Remember everything they have established.
- See their book as a system, not a pile of documents.
- Let specialized agents work without losing control.
- Produce cleaner drafts and stronger revisions.
- Export and publish from one source of truth.
- Build a durable creative business around their books.

The author remains the author. The cockpit makes the work visible enough to command.

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
│   └── ARCHITECTURE.md         # System design
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

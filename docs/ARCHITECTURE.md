# AuthorOS Architecture

> Two layers. Universal foundation. Optional mythology.

---

## Two-Layer Design

```
┌───────────────────────────────────────────────────┐
│  Layer 2: Arcanean AuthorOS (optional extension)  │
│  ├── Ten Gates progression system                 │
│  ├── Five Elements writing modes                  │
│  ├── Guardian agents (mythology-enhanced)         │
│  ├── Web3 publishing (NFT, on-chain)              │
│  └── Gamified author journey                      │
├───────────────────────────────────────────────────┤
│  Layer 1: AuthorOS (universal foundation)         │
│  ├── Skills (portable markdown)                   │
│  ├── Agents (multi-model orchestration)           │
│  ├── Memory (SQLite + embeddings)                 │
│  ├── Publishing (epub/pdf/kindle/docx/web)        │
│  └── Multi-modal (image/audio/video)              │
└───────────────────────────────────────────────────┘
```

**Layer 1 (AuthorOS)** works standalone. No mythology required. No Arcanea dependency. Universal tools for any author writing any book in any genre.

**Layer 2 (Arcanean AuthorOS)** extends Layer 1 with a creative framework — progression, gamification, mythology-enhanced agents, and Web3 distribution. It is a superset, not a replacement.

---

## Skills Architecture

Skills are plain markdown files. They contain structured prompts that any coding agent can execute. No runtime, no dependencies, no API keys required (memory search is the exception — it needs embeddings).

```
skills/
├── story-architect.md         # Structure, arc, beats
├── character-psychologist.md  # Diamond, voice, relationships
├── line-editor.md             # Prose editing, anti-slop, revision
└── publish.md                 # Format conversion, distribution
```

### Skill Design Principles

1. **Portable** — Plain markdown. Copy to any agent's command directory.
2. **Composable** — Skills call each other. `story-architect` feeds `character-psychologist` feeds `line-editor`.
3. **Stateless** — Skills don't maintain state. Memory handles persistence.
4. **Agent-agnostic** — Work with Claude Code, OpenCode, Codex, Cursor, Windsurf, or any agent that reads markdown.

### Adding New Skills

Create a markdown file in `skills/` with this structure:

```markdown
# Skill Name

> One-line philosophy

You are a [role] — a specialist in [domain].

## Commands

### `/skill-name command <args>`

[What it does]

**Process:**
1. Step one
2. Step two

**Output format:**
[Template]
```

---

## Agent Architecture

Agents are named personas with specialized capabilities. They map to different models based on the task:

```
                    ┌─────────────┐
                    │  Orchestrator │ (the human or a coordinator agent)
                    └──────┬──────┘
           ┌───────────────┼───────────────┐
           ▼               ▼               ▼
    ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
    │  Calliope   │ │  Aristotle  │ │  Orpheus    │
    │  (generate) │ │  (structure)│ │  (voice)    │
    │  Gemini/Opus│ │  Opus       │ │  Sonnet     │
    └──────┬──────┘ └──────┬──────┘ └──────┬──────┘
           │               │               │
           └───────────────┼───────────────┘
                           ▼
                    ┌─────────────┐
                    │  Mnemosyne  │ (shared memory — SQLite)
                    └──────┬──────┘
                           ▼
                    ┌─────────────┐
                    │  Thoth      │ (quality gate — fast validation)
                    │  Haiku/Flash│
                    └─────────────┘
```

### Agent Roles

| Agent | Purpose | Model Fit | When to Use |
|-------|---------|-----------|-------------|
| **Calliope** | Generation — drafting new content, world-building, creative expansion | Large creative models (Gemini 2.5 Pro, Opus) | Writing new chapters, generating worlds, brainstorming |
| **Mnemosyne** | Memory — semantic search, canon recall, continuity checking | Any model + SQLite embeddings | "What did we establish about X?", continuity verification |
| **Orpheus** | Voice — dialogue, rhythm, character voice, prose musicality | Mid-range models (Sonnet, GPT-4o) | Dialogue passes, voice differentiation, prose polish |
| **Aristotle** | Structure — plot analysis, arc verification, revision coordination | Large reasoning models (Opus, o1) | Structural revision, outline analysis, pacing diagnosis |
| **Thoth** | Validation — quick checks, fact verification, anti-slop scanning | Fast models (Haiku, Flash) | Pre-commit checks, fact queries, slop detection |

### Multi-Agent Coordination

Agents share state through the file system and SQLite memory:

1. **File system** — Manuscripts, outlines, and canon documents are plain files. All agents read/write the same directory.
2. **SQLite memory** — `memsearch-sqlite.py` uses SQLite with WAL mode. Multiple agents can read simultaneously. One writer at a time (SQLite handles locking).
3. **Canon as contract** — `CANON_LOCKED.md` (or equivalent) is the immutable source of truth. Agents check against it but never modify it.

### Multi-Terminal Pattern

```
Terminal 1 (Claude Code):
  - Deep structural work (Aristotle)
  - Revision passes (line-editor skill)
  - Publishing pipeline

Terminal 2 (OpenCode / Gemini):
  - Creative drafting (Calliope)
  - World-building generation
  - Scene expansion

Terminal 3 (Codex / any):
  - Research and fact-checking (Thoth)
  - Continuity scanning (Mnemosyne)
  - Anti-slop validation

All terminals share:
  - Same file system (manuscripts, outlines)
  - Same SQLite database (~/.memsearch/vectors.db)
  - Same canon document
```

---

## Memory Architecture

### memsearch-sqlite.py

The memory engine is deliberately simple — a single Python script with three dependencies:

```
Input (markdown files)
  → Chunking (split by ## headings, min 40 chars)
  → Embedding (Gemini embedding-001, 3072 dimensions)
  → Storage (SQLite with content-hash deduplication)
  → Search (cosine similarity, top-K results)
```

**Design decisions:**

- **SQLite, not Postgres/Milvus** — File-based. No server. Works in WSL2, Docker, any machine. Multiple agents can read the same DB file.
- **Gemini embeddings** — High quality, generous free tier. Swappable — the embedding function is isolated.
- **Content-hash dedup** — Re-indexing the same file skips already-indexed chunks. Safe to run repeatedly.
- **WAL mode** — Write-Ahead Logging allows concurrent reads while writing. Critical for multi-agent.
- **No vector extension required** — Pure numpy cosine similarity. Works on any Python install. For 10K+ chunks, consider `sqlite-vec` for speed.

### Lorebook Pattern

For structured character/world data, use a JSON lorebook alongside the vector search:

```json
{
  "characters": {
    "elena": {
      "full_name": "Elena Vasquez",
      "age": 34,
      "role": "protagonist",
      "traits": ["determined", "secretive", "compassionate"],
      "relationships": {
        "marcus": "mentor, increasingly strained",
        "kai": "rival turned ally"
      }
    }
  },
  "locations": {},
  "rules": {},
  "timeline": []
}
```

The lorebook is for exact lookups ("What color are Elena's eyes?"). Memory search is for fuzzy retrieval ("What happened in the market scene?"). Use both.

### Canon Document

`CANON_LOCKED.md` is the single source of truth for your world:

- Character names, descriptions, relationships
- World rules (what is and isn't possible)
- Timeline of events
- Established facts that cannot contradict

**Rule: Agents read canon. Agents never modify canon. Only the author modifies canon.**

---

## Publishing Pipeline

```
Markdown source (chapters/*.md)
  │
  ├─→ Pandoc → EPUB 3.0 (ebook stores)
  ├─→ Pandoc → PDF (print-on-demand)
  ├─→ Pandoc → DOCX (agent/editor submission)
  ├─→ Pandoc → HTML (web serialization)
  ├─→ KDP formatter → Kindle (Amazon)
  └─→ Content cascade → Blog / Social / Newsletter
```

The `publish` skill orchestrates these conversions. Write once in markdown, publish everywhere.

---

## Extension Points

AuthorOS is designed to be extended:

| Extension | What It Adds | Example |
|-----------|-------------|---------|
| **Genre skills** | Genre-specific structure templates | Romance beat sheet, mystery clue planting |
| **Language support** | Translation and localization | Multi-language publishing pipeline |
| **Audio pipeline** | Text-to-speech, audiobook | ElevenLabs integration, chapter-level narration |
| **Image generation** | Scene illustrations, covers | DALL-E / Midjourney prompts from scene descriptions |
| **Analytics** | Writing metrics, progress tracking | Words per day, revision pass completion |
| **Collaboration** | Multi-author coordination | Shared canon, chapter assignment, merge |

### The Arcanean Extension

The Arcanean AuthorOS (`arcanea-author`) extends every component:

| AuthorOS Component | Arcanean Extension |
|---|---|
| Skills (generic) | + Element-aligned writing modes (Fire for action, Water for emotion, etc.) |
| Agents (classical names) | + Guardian agents with mythological depth |
| Memory (SQLite) | + Gate-based progression tracking |
| Publishing (standard) | + Web3 (NFT chapters, on-chain rights) |
| Templates (generic) | + Ten Gates outline structure |

The extension is additive. Nothing in Layer 1 breaks without it.

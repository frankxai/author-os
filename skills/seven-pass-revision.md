---
name: seven-pass-revision
description: Run the Seven-Pass Revision Ritual on a chapter or scene with the 12-Desk Specialist Agent Swarm.
---

# Seven-Pass Revision Ritual

Every chapter passes through seven specialized lenses before publishing. No pass tries to do everything.

## The 7 Passes

| Pass | Name | Lead Agent | Focus & Catch |
|------|------|------------|---------------|
| **1** | **Structural** | Aristotle / Developmental Editor | Arc, pacing, turning points, stakes, scene necessity |
| **2** | **Character** | Elena / Character Psychologist | Voice differentiation, desire vs need, emotional delta |
| **3** | **Scene Function** | Calliope / Master Story Architect | Sensory anchors, conflict escalation, micro-tensions |
| **4** | **Dialogue & Subtext** | Rosalind / Dialogue Alchemist | Subtext, unspoken tension, dialogue tag cleanliness |
| **5** | **Prose & Anti-Slop** | Orpheus / Line Editor | AI clichés ("tapestry", "shiver down"), filter words ("he saw"), active verbs |
| **6** | **Continuity & Canon** | Mnemosyne / Continuity Guardian | Timeline consistency, physical attributes, magic/tech rules, open loops |
| **7** | **Musicality & Polish** | Apollo / Polish Master | Sentence rhythm, word-level cadence, breath control |

## Execution Protocol

1. **Target**: Pass a chapter file or scene ID:
   ```bash
   author-os mcp --tool run_seven_pass_revision --input '{"sceneId": "sc_01"}'
   ```
2. **Review Diffs**: Diffs and suggestions are queued for author approval. No prose is modified without author consent.
3. **Notion / IDE Sync**: Output can be directly exported to Notion blocks or Markdown files.

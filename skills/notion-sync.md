---
name: notion-sync
description: Bi-directional synchronization between Notion workspaces and AuthorOS Living Graph.
---

# Notion Bi-Directional Bridge

Empowers authors to plan, outline, draft, and organize books inside Notion while accessing AuthorOS agentic intelligence, Living Codex, and the Seven-Pass Revision Ritual.

## Notion Database Architecture

AuthorOS maps project graphs to 4 Notion databases:
1. **📚 Manuscript Hub**: Books $\to$ Chapters $\to$ Scenes with properties for POV, Status, Word Count, and AuthorOS Quality Score.
2. **🧬 Living Codex**: Characters, Locations, Factions, Rules, and Lore with auto-linking to scenes where they appear.
3. **🎯 Beat Matrix**: Act turns, scene goals, conflicts, disasters, and emotional deltas.
4. **🔍 Editorial & Revision Queue**: Direct agent feedback, anti-slop suggestions, and continuity alerts with one-click review statuses.

## Workflow

1. **Write or Outline in Notion**: Author works in their preferred Notion template.
2. **MCP Tool Integration**: Agents run `format_notion_blocks` to render suggestions, diffs, and quality scores as native Notion callouts and toggle lists.
3. **Zero Lock-In**: Everything syncs to `.authoros/project.graph.json` and sovereign local Markdown files.

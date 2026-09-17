---
name: codex-engine
description: Manage the Living Story Bible, character psychological diamonds, and entity relationships.
---

# Living Codex Engine

The Story Bible is not a static encyclopedia; it is a living graph that tracks entity appearances, relationship dynamics, and psychological depth across chapters.

## Entity Tagging Syntax

Authors and agents can tag entities in prose:
* `@[Character Name]` or `@CharacterName`: Tracks character appearances and emotional state transitions.
* `#[Location Name]` or `#LocationName`: Tracks setting descriptions and sensory anchors.
* `![Rule / Lore / Object]`: Enforces magic, technology, and canon constraints.

## Character Psychological Diamond

Every major character is modeled through 5 dimensions:
1. **Desire**: What they consciously pursue.
2. **Need**: What their soul needs for growth.
3. **Lie**: The core misconception they believe about reality.
4. **Wound / Ghost**: The origin trauma creating the lie.
5. **Mask**: The persona presented to the world.

## MCP Tools
* `extract_codex_entities`: Auto-detects and resolves inline mentions in text.
* `create_character_diamond`: Builds or refines a character's psychological diamond.
* `generate_character_board`: Compiles visual, textual, and relationship boards for an entity.

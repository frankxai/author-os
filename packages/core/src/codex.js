/**
 * AuthorOS Living Codex Engine
 * Inspired by Novelcrafter's Codex, World Anvil, and Campfire.
 * Provides entity extraction, mention resolution, psychological character diamonds,
 * and dynamic relationship graph modeling.
 */

export const CODEX_ENTITY_KINDS = [
  'Character',
  'Location',
  'Faction',
  'Object',
  'Rule',
  'Concept',
  'Lore',
];

/**
 * Parses markdown or prose text to extract tagged mentions:
 * - `@CharacterName` or `@[Character Name]`
 * - `#LocationName` or `#[Location Name]`
 * - `!LoreOrRule` or `![Lore / Rule]`
 */
export function extractInlineTags(text = '') {
  const mentions = [];
  if (!text || typeof text !== 'string') return mentions;

  // Bracketed tags e.g. @[Mira Vale], #[The Archive], ![Gold Ink]
  const bracketRegex = /([@#!])\[([^\]]+)\]/g;
  let match;
  while ((match = bracketRegex.exec(text)) !== null) {
    const symbol = match[1];
    const rawName = match[2].trim();
    const kind = symbol === '@' ? 'Character' : symbol === '#' ? 'Location' : 'Rule';
    mentions.push({
      symbol,
      kind,
      name: rawName,
      startIndex: match.index,
      endIndex: match.index + match[0].length,
      rawTag: match[0],
    });
  }

  // Word tags e.g. @Mira, #Archive, !GoldContract
  const wordRegex = /([@#!])([a-zA-Z0-9_-]+)/g;
  while ((match = wordRegex.exec(text)) !== null) {
    // Avoid double matching bracketed ones
    if (match.index > 0 && text[match.index - 1] === '[') continue;
    const symbol = match[1];
    const rawName = match[2].trim();
    const kind = symbol === '@' ? 'Character' : symbol === '#' ? 'Location' : 'Rule';
    mentions.push({
      symbol,
      kind,
      name: rawName,
      startIndex: match.index,
      endIndex: match.index + match[0].length,
      rawTag: match[0],
    });
  }

  return mentions;
}

/**
 * Matches extracted mentions against existing project entities and suggests new entities for unknown mentions.
 */
export function resolveMentionsAgainstEntities(mentions, existingEntities = []) {
  const resolved = [];
  const unmapped = [];

  const entityLookup = new Map();
  for (const ent of existingEntities) {
    entityLookup.set(ent.name.toLowerCase(), ent);
    if (Array.isArray(ent.aliases)) {
      for (const alias of ent.aliases) {
        entityLookup.set(alias.toLowerCase(), ent);
      }
    }
  }

  for (const mention of mentions) {
    const target = entityLookup.get(mention.name.toLowerCase());
    if (target) {
      resolved.push({
        ...mention,
        entityId: target.id,
        matchedEntity: target,
      });
    } else {
      unmapped.push({
        ...mention,
        suggestedKind: mention.kind,
      });
    }
  }

  return { resolved, unmapped };
}

/**
 * Creates a standard Character Psychological Diamond model.
 * The 5-point diamond:
 * 1. Desire (What they consciously want)
 * 2. Need (What their soul actually needs to heal/grow)
 * 3. Lie / Flaw (The mistaken belief they hold about reality)
 * 4. Wound / Ghost (The origin trauma creating the lie)
 * 5. Mask (The persona presented to the outer world)
 */
export function createCharacterDiamond({
  characterId,
  name,
  desire = '',
  need = '',
  lie = '',
  wound = '',
  mask = '',
  voiceTone = '',
  distinctTics = [],
}) {
  return {
    id: `dia_${characterId || (name ? name.toLowerCase().replace(/\s+/g, '_') : 'char')}`,
    characterId: characterId || null,
    name: name || 'Unnamed Character',
    points: {
      desire: desire.trim(),
      need: need.trim(),
      lie: lie.trim(),
      wound: wound.trim(),
      mask: mask.trim(),
    },
    voice: {
      tone: voiceTone.trim(),
      distinctTics: Array.isArray(distinctTics) ? distinctTics : [],
    },
    internalConflictIndex: desire && need && desire !== need ? 0.85 : 0.4,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Analyzes scenes across a project to build an entity frequency and appearance timeline.
 */
export function buildEntityAppearanceMatrix(project) {
  const entities = project.entities || [];
  const scenes = project.scenes || [];
  const matrix = {};

  for (const ent of entities) {
    matrix[ent.id] = {
      entity: ent,
      appearances: [],
      totalSceneCount: 0,
      firstSceneId: null,
      lastSceneId: null,
    };
  }

  for (const scene of scenes) {
    const text = (scene.text || '') + ' ' + (scene.synopsis || '');
    const explicitlyLinked = scene.entityIds || [];

    for (const ent of entities) {
      let isPresent = explicitlyLinked.includes(ent.id);

      // Check text mentions if not explicitly linked
      if (!isPresent && text) {
        const namesToCheck = [ent.name, ...(ent.aliases || [])];
        for (const name of namesToCheck) {
          if (name && text.toLowerCase().includes(name.toLowerCase())) {
            isPresent = true;
            break;
          }
        }
      }

      if (isPresent) {
        const record = matrix[ent.id];
        record.totalSceneCount += 1;
        record.appearances.push({
          sceneId: scene.id,
          chapterId: scene.chapterId,
          order: scene.order,
          title: scene.title,
          pov: scene.pov,
        });
        if (!record.firstSceneId) record.firstSceneId = scene.id;
        record.lastSceneId = scene.id;
      }
    }
  }

  return matrix;
}

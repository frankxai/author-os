const stringSchema = { type: 'string' };
const booleanSchema = { type: 'boolean' };

export const authorOsToolDefinitions = [
  {
    name: 'list_projects',
    description: 'List local AuthorOS projects visible from the configured root.',
    inputSchema: {
      type: 'object',
      properties: {
        root: { ...stringSchema, description: 'Workspace root. Defaults to the current working directory.' },
      },
    },
  },
  {
    name: 'read_project_context',
    description: 'Read compact project, manuscript, canon, publishing, and agent context for a project.',
    inputSchema: {
      type: 'object',
      properties: {
        root: { ...stringSchema, description: 'Project root. Defaults to the current working directory.' },
        sceneLimit: { type: 'number' },
        entityLimit: { type: 'number' },
      },
    },
  },
  {
    name: 'read_canon',
    description: 'Read human-approved canon files such as CANON_LOCKED.md.',
    inputSchema: {
      type: 'object',
      properties: {
        root: { ...stringSchema, description: 'Project root. Defaults to the current working directory.' },
      },
    },
  },
  {
    name: 'search_manuscript',
    description: 'Search scenes and story entities for a query.',
    inputSchema: {
      type: 'object',
      properties: {
        root: { ...stringSchema },
        query: { ...stringSchema, description: 'Search query.' },
        limit: { type: 'number' },
      },
      required: ['query'],
    },
  },
  {
    name: 'create_scene',
    description: 'Create a local scene file and sync it into the AuthorOS graph.',
    inputSchema: {
      type: 'object',
      properties: {
        root: { ...stringSchema },
        title: { ...stringSchema },
        synopsis: { ...stringSchema },
        pov: { ...stringSchema },
        text: { ...stringSchema },
        status: { ...stringSchema },
      },
      required: ['title'],
    },
  },
  {
    name: 'revise_scene',
    description: 'Create a human-reviewable revision suggestion for a scene. This does not apply changes automatically.',
    inputSchema: {
      type: 'object',
      properties: {
        root: { ...stringSchema },
        sceneId: { ...stringSchema },
        instruction: { ...stringSchema },
        apply: { ...booleanSchema, description: 'Reserved for future approval-gated apply flow. Currently must be false.' },
        estimatedCostUsd: { type: 'number', description: 'Optional estimated managed AI cost to persist in the credit ledger.' },
        includedCreditUsd: { type: 'number', description: 'Optional included credit amount applied to this run.' },
      },
      required: ['sceneId', 'instruction'],
    },
  },
  {
    name: 'run_continuity_check',
    description: 'Run a local continuity audit over scenes, entities, relationships, and timeline events.',
    inputSchema: {
      type: 'object',
      properties: {
        root: { ...stringSchema },
        save: { ...booleanSchema, description: 'Save reports/continuity.json. Defaults to true.' },
      },
    },
  },
  {
    name: 'generate_character_board',
    description: 'Generate a character picture/story board model from codex, relationship, scene, and asset data.',
    inputSchema: {
      type: 'object',
      properties: {
        root: { ...stringSchema },
        character: { ...stringSchema, description: 'Character id, name, or alias.' },
      },
      required: ['character'],
    },
  },
  {
    name: 'export_book',
    description: 'Export the manuscript to Markdown locally. Hosted/cloud export workers can extend this for DOCX/EPUB/PDF.',
    inputSchema: {
      type: 'object',
      properties: {
        root: { ...stringSchema },
        format: { ...stringSchema, enum: ['markdown', 'md'] },
      },
    },
  },
  {
    name: 'get_run_status',
    description: 'Return the current local run status model for a task/run id.',
    inputSchema: {
      type: 'object',
      properties: {
        root: { ...stringSchema },
        runId: { ...stringSchema },
      },
      required: ['runId'],
    },
  },
  {
    name: 'read_publishing_readiness',
    description: 'Read graph, continuity, approvals, asset rights, export, entitlement, and credit readiness before export or launch.',
    inputSchema: {
      type: 'object',
      properties: {
        root: { ...stringSchema },
      },
    },
  },
  {
    name: 'list_packs',
    description: 'List AuthorOS marketplace/open-core packs available for local or hosted installation.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'install_pack',
    description: 'Install an AuthorOS pack or the full Foundry Pack bundle into a local project graph without generating or modifying manuscript prose.',
    inputSchema: {
      type: 'object',
      properties: {
        root: { ...stringSchema },
        packId: { ...stringSchema, description: 'Pack id or bundle id. Defaults to authoros-foundry-pack.' },
      },
    },
  },
  {
    name: 'extract_codex_entities',
    description: 'Extract @Character, #Location, and !Rule/Lore inline tags from prose and resolve against project entities.',
    inputSchema: {
      type: 'object',
      properties: {
        root: { ...stringSchema },
        text: { ...stringSchema, description: 'Prose or markdown text to parse for entity mentions.' },
      },
      required: ['text'],
    },
  },
  {
    name: 'create_character_diamond',
    description: 'Generate a 5-point psychological character diamond (Desire, Need, Lie, Wound, Mask) with voice tone and tics.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { ...stringSchema, description: 'Character name.' },
        desire: { ...stringSchema, description: 'Conscious external goal.' },
        need: { ...stringSchema, description: 'Internal spiritual or psychological need.' },
        lie: { ...stringSchema, description: 'Core misconception about the world.' },
        wound: { ...stringSchema, description: 'Origin trauma or ghost event.' },
        mask: { ...stringSchema, description: 'Public persona presented to the world.' },
        voiceTone: { ...stringSchema, description: 'Voice and cadence guidelines.' },
        distinctTics: { type: 'array', items: { type: 'string' }, description: 'Speech habits or verbal tics.' },
      },
      required: ['name'],
    },
  },
  {
    name: 'run_seven_pass_revision',
    description: 'Run the Seven-Pass Revision Ritual on scene prose (Structural, Character, Scene, Dialogue, Prose, Continuity, Polish).',
    inputSchema: {
      type: 'object',
      properties: {
        root: { ...stringSchema },
        sceneId: { ...stringSchema, description: 'Optional scene id to fetch from local project.' },
        text: { ...stringSchema, description: 'Optional raw scene prose to evaluate directly.' },
        pov: { ...stringSchema, description: 'POV character name.' },
      },
    },
  },
  {
    name: 'anti_slop_lint',
    description: 'Run deterministic anti-slop, AI-cliché, filter word, and cadence monotony linting on prose.',
    inputSchema: {
      type: 'object',
      properties: {
        text: { ...stringSchema, description: 'Text to lint for AI slop and stylistic weaknesses.' },
      },
      required: ['text'],
    },
  },
  {
    name: 'format_notion_blocks',
    description: 'Format an AuthorOS scene and its Seven-Pass audit report into Notion-ready block children for bi-directional sync.',
    inputSchema: {
      type: 'object',
      properties: {
        root: { ...stringSchema },
        sceneId: { ...stringSchema, description: 'Scene id to format.' },
      },
      required: ['sceneId'],
    },
  },
  {
    name: 'export_epub_manifest',
    description: 'Build complete ePub 3.0 virtual file structure and navigation manifest for publication.',
    inputSchema: {
      type: 'object',
      properties: {
        root: { ...stringSchema },
      },
    },
  },
  {
    name: 'describe_sensory_expansion',
    description: 'Generate deep 5-sense sensory grounding (Sight, Sound, Scent, Touch, Taste, Atmosphere) and visceral texture for a scene element.',
    inputSchema: {
      type: 'object',
      properties: {
        focus: { ...stringSchema, description: 'The character, room, object, or moment to expand.' },
        genre: { ...stringSchema, description: 'Texture palette: mythic-fantasy, romantasy, sci-fi-speculative, gothic-thriller, nonfiction-authority.' },
        senses: { type: 'array', items: { type: 'string' }, description: 'Array of senses: sight, sound, scent, touch, taste, atmosphere.' },
      },
      required: ['focus'],
    },
  },
];

export function buildMcpToolManifest() {
  return {
    name: 'author-os',
    version: '0.2.0',
    description: 'Agentic Author OS project, canon, manuscript, canvas, and publishing tools.',
    tools: authorOsToolDefinitions,
  };
}

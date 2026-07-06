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
];

export function buildMcpToolManifest() {
  return {
    name: 'author-os',
    version: '0.2.0',
    description: 'Agentic Author OS project, canon, manuscript, canvas, and publishing tools.',
    tools: authorOsToolDefinitions,
  };
}

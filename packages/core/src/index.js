export const AUTHOR_OS_GRAPH_VERSION = '2026.07.v1';

export const storyEntityKinds = [
  'Character',
  'Location',
  'Organization',
  'Object',
  'Concept',
  'Rule',
  'Faction',
];

export const boardNodeKinds = [
  'scene',
  'character',
  'location',
  'clue',
  'question',
  'asset',
  'task',
  'mood',
];

export const taskKinds = [
  'brainstorm',
  'continuity_check',
  'rewrite_pass',
  'research',
  'asset_generation',
  'publish_prep',
  'export',
];

export const modelRoutingPolicy = {
  version: AUTHOR_OS_GRAPH_VERSION,
  defaultGateway: 'vercel-ai-gateway',
  principle: 'Use dynamic model discovery/configuration; policy names are stable, model slugs are deployment config.',
  routes: {
    extractor: {
      tier: 'cheap',
      purpose: 'Entity extraction, tagging, import cleanup, chapter classification.',
      preferredCapabilities: ['structured-output', 'fast-context'],
      gatewayTags: ['feature:extraction', 'tier:cheap'],
    },
    continuity: {
      tier: 'reasoning',
      purpose: 'Canon checks, timeline contradictions, relationship consistency.',
      preferredCapabilities: ['long-context', 'reasoning', 'citations'],
      gatewayTags: ['feature:continuity', 'tier:reasoning'],
    },
    prose: {
      tier: 'creative',
      purpose: 'Scene drafting, line editing, voice-preserving rewrite.',
      preferredCapabilities: ['creative-writing', 'style-control'],
      gatewayTags: ['feature:prose', 'tier:creative'],
    },
    visual: {
      tier: 'multimodal',
      purpose: 'Portrait briefs, mood boards, covers, launch visuals.',
      preferredCapabilities: ['image-generation', 'vision'],
      gatewayTags: ['feature:visuals', 'tier:multimodal'],
    },
    operations: {
      tier: 'low-cost',
      purpose: 'Status, packaging, metadata, publishing checklist, support workflows.',
      preferredCapabilities: ['tool-calling', 'fast-output'],
      gatewayTags: ['feature:ops', 'tier:low-cost'],
    },
  },
  taskToRoute: {
    import: 'extractor',
    search: 'extractor',
    create_scene: 'prose',
    revise_scene: 'prose',
    run_continuity_check: 'continuity',
    generate_character_board: 'visual',
    export_book: 'operations',
    publish_prep: 'operations',
  },
};

export const offerCatalog = [
  {
    id: 'open-core',
    layer: 'Agentic Author OS',
    price: 'Free',
    buyer: 'Developers and AI-native authors',
    promise: 'Local files, CLI, basic MCP, story graph, basic exports, BYOK-friendly architecture.',
    cloudIncluded: false,
    aiCreditsIncludedUsd: 0,
  },
  {
    id: 'foundry-pack',
    layer: 'AuthorOS Foundry Pack',
    price: '$149-$199',
    buyer: 'Early serious authors',
    promise: 'Fiction, nonfiction, seven-pass revision, launch checklist, and installable cockpit starter packs.',
    cloudIncluded: false,
    aiCreditsIncludedUsd: 0,
  },
  {
    id: 'pro-local',
    layer: 'Pro Local',
    price: '$19/mo or $149/yr',
    buyer: 'Solo serious authors',
    promise: 'Premium local cockpit, advanced quality gates, local MCP, BYOK, paid packs.',
    cloudIncluded: false,
    aiCreditsIncludedUsd: 0,
  },
  {
    id: 'founder-lifetime-local',
    layer: 'Founder Lifetime Local',
    price: '$299 launch, then $499',
    buyer: 'Early believers',
    promise: 'Lifetime local app access only; no cloud, support-heavy services, or managed credits.',
    cloudIncluded: false,
    aiCreditsIncludedUsd: 0,
  },
  {
    id: 'cloud-creator',
    layer: 'Cloud Creator',
    price: '$29/mo or $290/yr',
    buyer: 'Indie authors publishing regularly',
    promise: 'Hosted cockpit, backups, sync, marketplace purchases, and $10 managed AI credits/month.',
    cloudIncluded: true,
    aiCreditsIncludedUsd: 10,
  },
  {
    id: 'cloud-studio',
    layer: 'Cloud Studio',
    price: '$79/mo or $790/yr',
    buyer: 'Serial authors and pro creators',
    promise: 'Multi-project workflows, collaboration, launch assets, analytics, and $40 managed AI credits/month.',
    cloudIncluded: true,
    aiCreditsIncludedUsd: 40,
  },
  {
    id: 'agency-small-press',
    layer: 'Agency / Small Press',
    price: '$249-$599/mo base',
    buyer: 'Ghostwriters, editors, imprints, small presses',
    promise: 'Seats, roles, shared bibles, editorial queues, client workspaces, and $150+ credits/month.',
    cloudIncluded: true,
    aiCreditsIncludedUsd: 150,
  },
  {
    id: 'concierge-setup',
    layer: 'Concierge Setup',
    price: '$499-$1.5k',
    buyer: 'Nontechnical authors',
    promise: 'Manuscript import, memory setup, BYOK, first cockpit, first quality report.',
    cloudIncluded: false,
    aiCreditsIncludedUsd: 0,
  },
  {
    id: 'agentic-service-sprint',
    layer: 'Agentic Service Sprint',
    price: '$3k-$15k',
    buyer: 'Authors and small presses buying outcomes',
    promise: 'Done-with-you book/series cockpit, publishing pipeline, launch automation.',
    cloudIncluded: true,
    aiCreditsIncludedUsd: 0,
  },
];

export const foundryPackManifest = {
  id: 'authoros-foundry-pack',
  version: AUTHOR_OS_GRAPH_VERSION,
  name: 'AuthorOS Foundry Pack',
  offerId: 'foundry-pack',
  license: 'commercial-pack',
  compatibility: {
    authorOsGraph: AUTHOR_OS_GRAPH_VERSION,
    cli: '>=0.2.0',
    cockpit: '>=0.2.0',
  },
  packs: [
    'fiction-studio',
    'nonfiction-authority',
    'seven-pass-revision',
    'publishing-ops',
    'romance-erotica-premium',
    'launch-assets',
  ],
  qaGate: {
    requiresHumanReview: true,
    requiresAssetProvenance: true,
    requiresExportTest: true,
  },
  marketplace: {
    foundingCreatorSplit: '90/10',
    standardSplit: '80/20',
    platformPromotedSplit: '70/30',
  },
};

export const packCatalog = [
  {
    id: 'fiction-studio',
    name: 'Fiction Studio',
    layer: 'open-core-plus',
    offerId: 'foundry-pack',
    category: 'story-development',
    promise: 'Turn a blank or imported book into a living fiction cockpit with structure, canon, and review tasks.',
    tasks: [
      ['brainstorm', 'Define the book promise and reader contract', 'Project'],
      ['continuity_check', 'Audit protagonist desire, opposition, and stakes', 'Project'],
      ['rewrite_pass', 'Prepare scene-level revision map for human approval', 'Scene'],
    ],
    boardNodes: ['premise', 'protagonist', 'opposition', 'stakes', 'act-turns'],
  },
  {
    id: 'nonfiction-authority',
    name: 'Nonfiction Authority',
    layer: 'open-core-plus',
    offerId: 'foundry-pack',
    category: 'nonfiction',
    promise: 'Package reader problem, method, proof, and authority assets for practical nonfiction.',
    tasks: [
      ['research', 'Map reader pains, promises, and proof assets', 'Project'],
      ['brainstorm', 'Draft chapter outcome ladder without writing prose', 'Project'],
      ['publish_prep', 'Check claims, sources, and legal/compliance notes', 'Project'],
    ],
    boardNodes: ['reader-problem', 'method', 'proof', 'case-studies', 'claims'],
  },
  {
    id: 'seven-pass-revision',
    name: 'Seven-Pass Revision',
    layer: 'pro-local',
    offerId: 'foundry-pack',
    category: 'revision',
    promise: 'Run structured passes for structure, continuity, character, voice, line, proof, and export readiness.',
    tasks: [
      ['continuity_check', 'Pass 1: structure and promise audit', 'Project'],
      ['continuity_check', 'Pass 2: canon, timeline, and relationship audit', 'Project'],
      ['rewrite_pass', 'Pass 3: character arc and voice map', 'Scene'],
      ['rewrite_pass', 'Pass 4: scene function and pacing review', 'Scene'],
      ['rewrite_pass', 'Pass 5: line edit queue for human approval', 'Scene'],
      ['publish_prep', 'Pass 6: proof, claims, and rights review', 'Project'],
      ['export', 'Pass 7: export readiness and artifact test', 'Project'],
    ],
    boardNodes: ['structure', 'continuity', 'character', 'voice', 'line', 'proof', 'export'],
  },
  {
    id: 'publishing-ops',
    name: 'Publishing Ops',
    layer: 'cloud-creator',
    offerId: 'foundry-pack',
    category: 'publishing',
    promise: 'Prepare metadata, front/back matter, export gates, pricing notes, and launch checklist.',
    tasks: [
      ['publish_prep', 'Draft metadata and BISAC/category candidates', 'Project'],
      ['publish_prep', 'Create front matter and back matter checklist', 'Project'],
      ['export', 'Run markdown export smoke before advanced formats', 'Project'],
    ],
    boardNodes: ['metadata', 'front-matter', 'back-matter', 'formats', 'kdp'],
  },
  {
    id: 'romance-erotica-premium',
    name: 'Romance / Erotica Premium',
    layer: 'arcanea-premium',
    offerId: 'foundry-pack',
    category: 'genre',
    promise: 'Premium trope, heat, consent, promise, and series-positioning workflows for romance-forward publishing.',
    tasks: [
      ['brainstorm', 'Map trope promise, emotional fantasy, and reader expectations', 'Project'],
      ['continuity_check', 'Audit consent, heat progression, and relationship stakes', 'Project'],
      ['publish_prep', 'Prepare genre-sensitive metadata and pen-name checklist', 'Project'],
    ],
    boardNodes: ['trope', 'fantasy', 'chemistry', 'heat-ladder', 'series-hook'],
  },
  {
    id: 'launch-assets',
    name: 'Launch Assets',
    layer: 'cloud-studio',
    offerId: 'foundry-pack',
    category: 'assets',
    promise: 'Track cover, portrait, moodboard, metadata, ads, and launch provenance assets.',
    tasks: [
      ['asset_generation', 'Create cover and portrait brief queue with rights notes', 'Project'],
      ['publish_prep', 'Prepare store copy, launch email, and social asset checklist', 'Project'],
      ['export', 'Attach launch assets to export readiness evidence', 'Project'],
    ],
    boardNodes: ['cover', 'portraits', 'moodboard', 'store-copy', 'ads'],
    assetPlaceholders: ['cover-brief', 'moodboard-brief'],
  },
];

export function getOfferById(offerId = 'open-core') {
  return offerCatalog.find(item => item.id === offerId) || offerCatalog[0];
}

export function buildPackRegistry() {
  return {
    version: AUTHOR_OS_GRAPH_VERSION,
    generatedAt: nowIso(),
    manifest: foundryPackManifest,
    packs: packCatalog,
    offers: offerCatalog.map(offer => ({
      id: offer.id,
      layer: offer.layer,
      price: offer.price,
      cloudIncluded: offer.cloudIncluded,
    })),
  };
}

export function resolvePackSelection(selection = 'authoros-foundry-pack') {
  const requested = selection || 'authoros-foundry-pack';
  if (requested === foundryPackManifest.id || requested === 'foundry-pack' || requested === 'all') {
    return foundryPackManifest.packs.map(packId => packCatalog.find(pack => pack.id === packId)).filter(Boolean);
  }
  const pack = packCatalog.find(item => item.id === requested);
  if (!pack) {
    const error = new Error(`Unknown AuthorOS pack: ${requested}`);
    error.code = 'AUTHOROS_PACK_NOT_FOUND';
    error.availablePacks = packCatalog.map(item => item.id);
    throw error;
  }
  return [pack];
}

function createPackTask(pack, task, index, projectId, installedAt) {
  const [kind, title, targetType] = task;
  return {
    id: `task_pack_${pack.id}_${index + 1}`,
    kind,
    title,
    status: 'queued',
    sourcePackId: pack.id,
    targetType,
    targetId: projectId,
    createdAt: installedAt,
    updatedAt: installedAt,
    evidence: [`pack:${pack.id}`],
  };
}

function createPackBoard(pack, projectId, installedAt) {
  return {
    id: `board_pack_${pack.id}`,
    projectId,
    title: `${pack.name} Board`,
    kind: 'pack-workflow',
    createdAt: installedAt,
    updatedAt: installedAt,
    nodes: pack.boardNodes.map((node, index) => ({
      id: `node_pack_${pack.id}_${node}`,
      kind: index === 0 ? 'mood' : 'task',
      title: node.replace(/-/g, ' '),
      x: 120 + (index % 3) * 260,
      y: 120 + Math.floor(index / 3) * 160,
      refId: `task_pack_${pack.id}_${Math.min(index + 1, pack.tasks.length)}`,
    })),
    edges: pack.boardNodes.slice(1).map((node, index) => ({
      id: `edge_pack_${pack.id}_${index + 1}`,
      from: `node_pack_${pack.id}_${pack.boardNodes[index]}`,
      to: `node_pack_${pack.id}_${node}`,
      label: 'workflow',
    })),
  };
}

function createPackAssetPlaceholders(pack, projectId, installedAt) {
  return (pack.assetPlaceholders || []).map(asset => ({
    id: `asset_pack_${pack.id}_${asset}`,
    type: 'brief',
    title: `${pack.name}: ${asset.replace(/-/g, ' ')}`,
    source: 'authoros-pack',
    rights: 'brief-only',
    path: null,
    usedIn: [projectId],
    tags: ['pack', pack.id, asset],
    provenance: {
      sourceTool: 'author-os-pack-installer',
      packId: pack.id,
      generatedAt: installedAt,
      note: 'Placeholder brief only; no generated or licensed media is bundled.',
    },
  }));
}

export function installPackIntoProject(project, selection = 'authoros-foundry-pack', options = {}) {
  const graph = normalizeProject(project);
  const selectedPacks = resolvePackSelection(selection);
  const installedAt = options.installedAt || nowIso();
  const installedBy = options.installedBy || 'author-os-pack-installer';
  const existingPackIds = new Set((graph.installedPacks || []).map(pack => pack.packId || pack.id));
  const installed = [];
  const skipped = [];

  for (const pack of selectedPacks) {
    if (existingPackIds.has(pack.id)) {
      skipped.push(pack.id);
      continue;
    }
    installed.push(pack.id);
    existingPackIds.add(pack.id);
    graph.installedPacks.push({
      id: `installed_${pack.id}`,
      packId: pack.id,
      manifestId: foundryPackManifest.id,
      version: foundryPackManifest.version,
      name: pack.name,
      offerId: pack.offerId,
      category: pack.category,
      status: 'installed',
      installedAt,
      installedBy,
      trust: {
        noProseGenerated: true,
        humanReviewRequired: true,
        assetProvenanceRequired: foundryPackManifest.qaGate.requiresAssetProvenance,
      },
    });
    graph.tasks.push(...pack.tasks.map((task, index) => createPackTask(pack, task, index, graph.project.id, installedAt)));
    graph.boards.push(createPackBoard(pack, graph.project.id, installedAt));
    graph.assets.push(...createPackAssetPlaceholders(pack, graph.project.id, installedAt));
  }

  if (installed.includes('publishing-ops') && !graph.publishingPlans.some(plan => plan.id === 'pub_pack_publishing_ops')) {
    graph.publishingPlans.push({
      id: 'pub_pack_publishing_ops',
      projectId: graph.project.id,
      status: 'planning',
      sourcePackId: 'publishing-ops',
      metadata: {
        title: graph.project.title,
        subtitle: '',
        author: '',
        categories: [],
        keywords: [],
      },
      readinessGates: ['metadata', 'front-matter', 'back-matter', 'rights', 'export-smoke'],
      createdAt: installedAt,
      updatedAt: installedAt,
    });
  }

  if (installed.length) {
    graph.decisions.push({
      id: `decision_pack_install_${installedAt.replace(/[^0-9a-z]/gi, '').slice(0, 18)}`,
      kind: 'pack-install',
      title: `Installed ${installed.length} AuthorOS pack${installed.length === 1 ? '' : 's'}`,
      summary: `Installed ${installed.join(', ')} from ${foundryPackManifest.name}. Packs add cockpit workflows, tasks, boards, and provenance placeholders only; manuscript prose is unchanged.`,
      createdAt: installedAt,
      evidence: installed.map(packId => `pack:${packId}`),
    });
  }

  graph.project.updatedAt = installedAt;
  return {
    project: normalizeProject(graph),
    installed,
    skipped,
    registryVersion: foundryPackManifest.version,
    manifestId: foundryPackManifest.id,
    noProseGenerated: true,
  };
}

export function createEntitlementSnapshot(offerId = 'open-core', overrides = {}) {
  const offer = getOfferById(offerId);
  const cloudIncluded = overrides.cloudIncluded ?? offer.cloudIncluded;
  const managedCredits = Number(overrides.aiCreditsIncludedUsd ?? offer.aiCreditsIncludedUsd ?? 0);
  const premiumLocalIncluded = ['foundry-pack', 'pro-local', 'founder-lifetime-local'].includes(offer.id);

  return {
    offerId: offer.id,
    planName: offer.layer,
    cloudIncluded,
    aiCreditsIncludedUsd: managedCredits,
    lifetimeLocal: offer.id === 'founder-lifetime-local',
    features: [
      'local-files',
      'export-anytime',
      'basic-mcp',
      ...(premiumLocalIncluded ? ['premium-packs', 'local-premium'] : []),
      ...(offer.id === 'foundry-pack' ? ['foundry-pack', 'pack:authoros-foundry-pack'] : []),
      ...(cloudIncluded ? ['hosted-cockpit', 'cloud-sync', 'marketplace', 'audit-logs'] : []),
      ...(offer.id === 'agency-small-press' ? ['seats-and-roles', 'client-workspaces', 'editorial-queues'] : []),
    ],
    limits: {
      workspaces: cloudIncluded ? 3 : 1,
      projects: offer.id === 'open-core' ? 3 : 100,
      seats: offer.id === 'agency-small-press' ? 10 : cloudIncluded ? 3 : 1,
      marketplacePurchases: cloudIncluded,
      managedCredits,
      ...overrides.limits,
    },
    trust: {
      exportAnytime: true,
      noTrainingByDefault: true,
      humanApprovalBeforeApply: true,
      auditLogs: cloudIncluded,
      deletionPolicyRequired: cloudIncluded,
      byokAllowed: true,
      ...overrides.trust,
    },
  };
}

export function canUseFeature(entitlements, feature) {
  return Boolean(entitlements?.features?.includes(feature) || entitlements?.limits?.[feature] || entitlements?.trust?.[feature]);
}

export function createCreditLedgerEntry(input = {}) {
  const estimatedCostUsd = Number(Number(input.estimatedCostUsd || 0).toFixed(4));
  const includedCreditUsd = Number(Number(input.includedCreditUsd || 0).toFixed(4));
  return {
    id: input.id || createId('credit'),
    workspaceId: input.workspaceId || 'local',
    projectId: input.projectId || null,
    runId: input.runId || null,
    source: input.source || 'managed-gateway',
    provider: input.provider || 'vercel-ai-gateway',
    model: input.model || 'gateway:dynamic',
    taskType: input.taskType || 'operations',
    inputTokens: Number(input.inputTokens || 0),
    outputTokens: Number(input.outputTokens || 0),
    estimatedCostUsd,
    includedCreditUsd,
    billableUsd: Number(Math.max(0, estimatedCostUsd - includedCreditUsd).toFixed(4)),
    marginPolicy: input.marginPolicy || 'provider-cost-plus-20-35-percent-on-managed-credits',
    createdAt: input.createdAt || nowIso(),
  };
}

export function summarizeCreditLedger(project, entitlements = null) {
  const graph = normalizeProject(project);
  const entitlementSnapshot = entitlements || createEntitlementSnapshot(graph.workspace.plan);
  const entries = graph.creditLedger || [];
  const totals = entries.reduce((summary, entry) => {
    summary.estimatedCostUsd += Number(entry.estimatedCostUsd || 0);
    summary.includedCreditUsd += Number(entry.includedCreditUsd || 0);
    summary.billableUsd += Number(entry.billableUsd || 0);
    summary.inputTokens += Number(entry.inputTokens || 0);
    summary.outputTokens += Number(entry.outputTokens || 0);
    return summary;
  }, {
    estimatedCostUsd: 0,
    includedCreditUsd: 0,
    billableUsd: 0,
    inputTokens: 0,
    outputTokens: 0,
  });
  const includedMonthlyUsd = Number(entitlementSnapshot.aiCreditsIncludedUsd || 0);
  return {
    entryCount: entries.length,
    includedMonthlyUsd,
    spentEstimatedUsd: Number(totals.estimatedCostUsd.toFixed(4)),
    spentIncludedUsd: Number(totals.includedCreditUsd.toFixed(4)),
    billableUsd: Number(totals.billableUsd.toFixed(4)),
    remainingIncludedUsd: Number(Math.max(0, includedMonthlyUsd - totals.includedCreditUsd).toFixed(4)),
    inputTokens: totals.inputTokens,
    outputTokens: totals.outputTokens,
  };
}

export function createSuggestion(input = {}) {
  const targetId = input.targetId || input.sceneId || input.projectId || null;
  return {
    id: input.id || createId('sug'),
    kind: input.kind || 'revision',
    targetType: input.targetType || (input.sceneId ? 'Scene' : 'Project'),
    targetId,
    sceneId: input.sceneId || (input.targetType === 'Scene' ? targetId : null),
    title: input.title || 'Human-reviewable suggestion',
    instruction: input.instruction || '',
    diffMode: input.diffMode || 'human-review-required',
    proposal: input.proposal || '',
    evidence: input.evidence || input.evidenceIds || [],
    runId: input.runId || null,
    routeId: input.routeId || null,
    approvalState: input.approvalState || 'requested',
    createdAt: input.createdAt || nowIso(),
    updatedAt: input.updatedAt || nowIso(),
  };
}

export function createApproval(input = {}) {
  return {
    id: input.id || createId('apr'),
    targetType: input.targetType || 'Suggestion',
    targetId: input.targetId || input.suggestionId || null,
    decision: input.decision || 'pending',
    approverId: input.approverId || 'local-human',
    notes: input.notes || '',
    conditions: input.conditions || [],
    createdAt: input.createdAt || nowIso(),
  };
}

export function nowIso() {
  return new Date().toISOString();
}

export function slugify(value) {
  return String(value || 'untitled')
    .toLowerCase()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 72) || 'untitled';
}

export function createId(prefix = 'aos') {
  const random = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now().toString(36)}_${random}`;
}

export function countWords(text) {
  return String(text || '').split(/\s+/).filter(Boolean).length;
}

function splitWords(text) {
  return String(text || '').split(/\s+/).filter(Boolean);
}

function excerpt(text, maxWords = 34) {
  const words = splitWords(text).slice(0, maxWords);
  return words.join(' ').trim();
}

function splitManuscriptByHeadings(text) {
  const lines = String(text || '').replace(/\r\n/g, '\n').split('\n');
  const sections = [];
  let current = null;
  let titleCandidate = null;
  const hasContent = section => Boolean(section?.text?.some(item => String(item || '').trim()));

  for (const line of lines) {
    const match = line.match(/^(#{1,3})\s+(.+?)\s*$/);
    if (match) {
      const level = match[1].length;
      const heading = match[2].trim();
      if (!titleCandidate && level === 1) {
        titleCandidate = heading;
        if (!current || current.text.every(item => !String(item || '').trim())) {
          current = null;
          continue;
        }
      }
      if (level <= 2) {
        if (hasContent(current)) sections.push(current);
        current = { title: heading, text: [] };
        continue;
      }
    }
    if (!current) current = { title: 'Opening', text: [] };
    current.text.push(line);
  }

  if (hasContent(current)) sections.push(current);
  return {
    titleCandidate,
    sections: sections
      .map((section, index) => ({
        title: section.title || `Chapter ${index + 1}`,
        text: section.text.join('\n').trim(),
      }))
      .filter(section => section.title || section.text),
  };
}

function chunkPlainManuscript(text, wordsPerChapter = 1800) {
  const paragraphs = String(text || '').replace(/\r\n/g, '\n').split(/\n{2,}/).map(item => item.trim()).filter(Boolean);
  const sections = [];
  let current = [];
  let currentWords = 0;

  for (const paragraph of paragraphs.length ? paragraphs : [String(text || '').trim()].filter(Boolean)) {
    const wordCount = countWords(paragraph);
    if (current.length && currentWords + wordCount > wordsPerChapter) {
      sections.push({
        title: `Chapter ${sections.length + 1}`,
        text: current.join('\n\n'),
      });
      current = [];
      currentWords = 0;
    }
    current.push(paragraph);
    currentWords += wordCount;
  }

  if (current.length) {
    sections.push({
      title: `Chapter ${sections.length + 1}`,
      text: current.join('\n\n'),
    });
  }

  return sections;
}

export function createProjectFromManuscript(input = {}) {
  const manuscriptText = String(input.manuscriptText || input.text || '').trim();
  if (!manuscriptText) {
    const error = new Error('Manuscript import requires manuscriptText.');
    error.code = 'MANUSCRIPT_TEXT_REQUIRED';
    throw error;
  }

  const parsed = splitManuscriptByHeadings(manuscriptText);
  const hasHeadedSections = parsed.sections.some(section => /^chapter\s+\d+|^part\s+\d+|^act\s+\d+|^prologue|^epilogue/i.test(section.title)) ||
    parsed.sections.length > 1;
  const sections = hasHeadedSections
    ? parsed.sections
    : chunkPlainManuscript(manuscriptText, Number(input.wordsPerChapter || 1800));
  const title = input.title || parsed.titleCandidate || input.sourceName || 'Imported Manuscript';
  const project = createEmptyProject({
    ...input,
    title,
    stage: input.stage || 'imported',
  });
  const bookId = project.books[0]?.id || createId('book');

  project.chapters = sections.map((section, index) => ({
    id: input.chapterIds?.[index] || `ch_${String(index + 1).padStart(3, '0')}`,
    bookId,
    title: section.title || `Chapter ${index + 1}`,
    order: index + 1,
    status: 'imported',
    summary: excerpt(section.text),
    wordCount: countWords(section.text),
    text: section.text,
  }));

  project.scenes = project.chapters.map((chapter, index) => createSceneRecord({
    id: input.sceneIds?.[index] || `sc_${String(index + 1).padStart(3, '0')}`,
    chapterId: chapter.id,
    title: chapter.title,
    synopsis: chapter.summary || excerpt(chapter.text),
    status: 'imported',
    order: index + 1,
    text: chapter.text,
    tags: ['imported-manuscript'],
  }));

  project.assets = [
    {
      id: input.sourceAssetId || `asset_${slugify(input.sourceName || title || 'imported-manuscript')}`,
      type: 'manuscript',
      title: input.sourceName || `${title} manuscript import`,
      source: input.source || 'hosted-import',
      rights: input.rights || 'user-provided',
      path: input.sourcePath || null,
      usedIn: project.scenes.map(scene => scene.id),
      tags: ['manuscript', 'imported'],
      provenance: {
        sourceTool: input.sourceTool || 'author-os-import',
        importMode: input.importMode || 'text',
        importedAt: nowIso(),
        chapterCount: project.chapters.length,
        sceneCount: project.scenes.length,
        wordCount: project.scenes.reduce((sum, scene) => sum + Number(scene.wordCount || 0), 0),
      },
    },
  ];

  project.tasks = [
    {
      id: 'task_import_review',
      kind: 'continuity_check',
      title: 'Review imported manuscript structure',
      status: 'queued',
      targetType: 'Project',
      targetId: project.project.id,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      evidence: project.scenes.map(scene => scene.id),
    },
    {
      id: 'task_import_canon',
      kind: 'brainstorm',
      title: 'Extract initial codex and continuity facts',
      status: 'queued',
      targetType: 'Project',
      targetId: project.project.id,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      evidence: project.scenes.map(scene => scene.id).slice(0, 12),
    },
  ];

  project.decisions = [
    {
      id: 'decision_import_contract',
      kind: 'import',
      title: 'Manuscript imported as reviewable scenes',
      summary: 'The manuscript was normalized into chapters, scenes, a provenance asset, and queued review tasks. No prose changes were applied.',
      createdAt: nowIso(),
      evidence: project.scenes.map(scene => scene.id),
    },
  ];

  return normalizeProject(project);
}

export function createEmptyProject(input = {}) {
  const workspaceId = input.workspaceId || createId('wrk');
  const projectId = input.id || createId('prj');
  const bookId = input.bookId || createId('bok');
  const createdAt = input.createdAt || nowIso();

  return normalizeProject({
    graphVersion: AUTHOR_OS_GRAPH_VERSION,
    workspace: {
      id: workspaceId,
      name: input.workspaceName || 'Local Author Workspace',
      plan: input.plan || 'open-core',
    },
    project: {
      id: projectId,
      title: input.title || 'Untitled Book',
      type: input.type || 'book',
      genre: Array.isArray(input.genre) ? input.genre : [],
      stage: input.stage || 'ideation',
      targetWords: input.targetWords || 80000,
      createdAt,
      updatedAt: createdAt,
    },
    series: input.series || [],
    books: [
      {
        id: bookId,
        projectId,
        title: input.title || 'Untitled Book',
        status: input.stage || 'ideation',
        targetWords: input.targetWords || 80000,
      },
    ],
    chapters: [],
    scenes: [],
    beats: [],
    entities: [],
    relationships: [],
    arcs: [],
    themes: [],
    clues: [],
    timelineEvents: [],
    continuityRules: [],
    boards: [],
    assets: [],
    tasks: [],
    agentRuns: [],
    suggestions: [],
    approvals: [],
    exports: [],
    publishingPlans: [],
    creditLedger: [],
    installedPacks: [],
    decisions: [],
  });
}

const starterTemplateCatalog = {
  'three-act-novel': {
    label: 'Three-act novel',
    stageTitles: ['Opening Image', 'Pressure Point', 'Decision Gate'],
    sceneTitles: ['Ordinary World Fracture', 'First Irreversible Choice', 'Door Into Act II'],
    beatTitles: ['Hook the promise', 'Expose the pressure', 'Commit the protagonist'],
    entitySet: 'fiction',
    timelineLabels: ['Setup pressure revealed', 'First choice changes the terms', 'Act II doorway opens'],
  },
  'romance-arc': {
    label: 'Romance arc',
    stageTitles: ['Meet The Want', 'Collision Chemistry', 'Stakes Of Choice'],
    sceneTitles: ['The Want Before Contact', 'The Spark And The Problem', 'The Choice That Costs'],
    beatTitles: ['Establish longing', 'Create charged opposition', 'Make desire risky'],
    entitySet: 'romance',
    timelineLabels: ['Want established', 'Primary bond complicates the plot', 'Choice raises emotional stakes'],
  },
  'mystery-thriller': {
    label: 'Mystery / thriller',
    stageTitles: ['Inciting Disturbance', 'False Pattern', 'Point Of No Return'],
    sceneTitles: ['The Wrong Detail', 'Pressure From The Lie', 'The Case Turns Personal'],
    beatTitles: ['Plant the anomaly', 'Escalate the false lead', 'Bind the hero to the case'],
    entitySet: 'mystery',
    timelineLabels: ['Disturbance enters the world', 'False pattern redirects suspicion', 'Investigation becomes personal'],
  },
  'nonfiction-guide': {
    label: 'Nonfiction guide',
    stageTitles: ['Reader Problem', 'Core Method', 'Proof Path'],
    sceneTitles: ['Name The Pain', 'Teach The Operating Frame', 'Show The First Useful Result'],
    beatTitles: ['Define the reader tension', 'Introduce the method', 'Create proof of usefulness'],
    entitySet: 'nonfiction',
    timelineLabels: ['Reader problem named', 'Method introduced', 'First proof artifact defined'],
  },
  'series-bible': {
    label: 'Series bible',
    stageTitles: ['World Promise', 'Series Engine', 'Book One Launch'],
    sceneTitles: ['The World Signal', 'Recurring Engine Pressure', 'First Book Doorway'],
    beatTitles: ['Define the world promise', 'Name repeatable conflict', 'Launch the first arc'],
    entitySet: 'series',
    timelineLabels: ['World promise appears', 'Series engine starts', 'Book one doorway opens'],
  },
};

function normalizeStarterTemplate(value) {
  const key = slugify(value || 'three-act-novel');
  return starterTemplateCatalog[key] ? key : 'three-act-novel';
}

function formatList(items = [], fallback = 'book') {
  const list = Array.isArray(items) ? items.filter(Boolean) : [];
  return list.length ? list.slice(0, 3).join(', ') : fallback;
}

function createStarterEntities(entitySet, input = {}) {
  if (entitySet === 'nonfiction') {
    return [
      {
        id: 'ent_starter_reader',
        kind: 'Concept',
        name: input.readerName || 'Reader Transformation',
        aliases: ['Audience promise'],
        summary: 'The before-to-after change the book must make practical for the reader.',
        assetIds: [],
        tags: ['audience', 'promise'],
      },
      {
        id: 'ent_starter_method',
        kind: 'Concept',
        name: input.methodName || 'Core Method',
        aliases: ['Operating frame'],
        summary: 'The repeatable framework, model, or argument the book will teach.',
        assetIds: [],
        tags: ['method', 'structure'],
      },
      {
        id: 'ent_starter_boundary',
        kind: 'Rule',
        name: 'Evidence Boundary',
        aliases: ['Trust rule'],
        summary: 'Claims stay provisional until supported by examples, citations, or author-approved experience.',
        assetIds: [],
        tags: ['trust', 'continuity'],
      },
    ];
  }

  const foilName = entitySet === 'romance'
    ? 'Love Interest / Foil'
    : entitySet === 'mystery'
      ? 'Suspect / Antagonistic Force'
      : 'Primary Foil';
  const settingName = entitySet === 'series' ? 'Series World' : 'Anchor Setting';
  const ruleName = entitySet === 'mystery'
    ? 'Clue Logic'
    : entitySet === 'romance'
      ? 'Emotional Contract'
      : 'Story Promise';

  return [
    {
      id: 'ent_starter_protagonist',
      kind: 'Character',
      name: input.protagonistName || 'Protagonist',
      aliases: ['Lead'],
      summary: 'The central viewpoint or force whose choices organize the book.',
      assetIds: [],
      tags: ['lead', 'needs-author-review'],
    },
    {
      id: 'ent_starter_foil',
      kind: 'Character',
      name: input.foilName || foilName,
      aliases: [],
      summary: 'The person or pressure that reveals the lead through opposition, desire, or danger.',
      assetIds: [],
      tags: ['foil', 'needs-author-review'],
    },
    {
      id: 'ent_starter_setting',
      kind: 'Location',
      name: input.settingName || settingName,
      aliases: [],
      summary: 'The primary world, arena, or institution that gives the story texture and constraint.',
      assetIds: [],
      tags: ['world', 'needs-author-review'],
    },
    {
      id: 'ent_starter_rule',
      kind: 'Rule',
      name: input.ruleName || ruleName,
      aliases: [],
      summary: 'A provisional canon rule that agents must preserve once the author approves it.',
      assetIds: [],
      tags: ['canon', 'needs-author-review'],
    },
  ];
}

export function createStarterProject(input = {}) {
  const templateKey = normalizeStarterTemplate(input.template || input.storyTemplate);
  const template = starterTemplateCatalog[templateKey];
  const premise = String(input.premise || '').trim();
  const audience = String(input.audience || '').trim() || (template.entitySet === 'nonfiction' ? 'practical readers' : 'fiction readers');
  const tone = String(input.tone || '').trim();
  const genreLabel = formatList(input.genre, template.label.toLowerCase());
  const project = createEmptyProject({
    ...input,
    stage: input.stage || 'ideation',
  });
  const createdAt = project.project.createdAt || nowIso();
  const bookId = project.books[0]?.id || input.bookId || createId('bok');
  const premiseLine = premise || `A ${genreLabel} project for ${audience}.`;

  project.project = {
    ...project.project,
    template: templateKey,
    templateLabel: template.label,
    premise: premise || null,
    audience,
    tone: tone || null,
    seriesIntent: input.seriesIntent || null,
    activationMode: 'starter',
  };

  project.chapters = template.stageTitles.map((title, index) => ({
    id: `ch_starter_${String(index + 1).padStart(2, '0')}`,
    bookId,
    title,
    order: index + 1,
    status: 'planned',
    summary: `${template.beatTitles[index]} for ${premiseLine}`,
    wordCount: 0,
  }));

  project.scenes = template.sceneTitles.map((title, index) => createSceneRecord({
    id: `sc_starter_${String(index + 1).padStart(2, '0')}`,
    chapterId: project.chapters[index]?.id,
    title,
    synopsis: `${template.beatTitles[index]}. Working premise: ${premiseLine}`,
    status: 'planned',
    order: index + 1,
    entityIds: template.entitySet === 'nonfiction'
      ? ['ent_starter_reader', 'ent_starter_method']
      : ['ent_starter_protagonist', index === 0 ? 'ent_starter_setting' : 'ent_starter_foil'],
    tags: ['starter-outline', templateKey],
  }));

  project.beats = template.beatTitles.map((title, index) => ({
    id: `beat_starter_${String(index + 1).padStart(2, '0')}`,
    sceneId: project.scenes[index]?.id,
    chapterId: project.chapters[index]?.id,
    order: index + 1,
    title,
    kind: 'starter-beat',
    summary: `${title}: ${template.timelineLabels[index]}.`,
    status: 'provisional',
    evidenceSceneIds: [project.scenes[index]?.id].filter(Boolean),
    createdAt,
  }));

  project.entities = createStarterEntities(template.entitySet, input);
  project.relationships = template.entitySet === 'nonfiction'
    ? [
        {
          id: 'rel_starter_reader_method',
          fromEntityId: 'ent_starter_reader',
          toEntityId: 'ent_starter_method',
          type: 'transformation-path',
          label: 'Method must serve reader transformation',
          polarity: 'constructive',
          intensity: 0.7,
          evidenceSceneIds: ['sc_starter_01', 'sc_starter_02'],
        },
        {
          id: 'rel_starter_method_boundary',
          fromEntityId: 'ent_starter_method',
          toEntityId: 'ent_starter_boundary',
          type: 'trust-boundary',
          label: 'Claims need proof before publication',
          polarity: 'guardrail',
          intensity: 0.88,
          evidenceSceneIds: ['sc_starter_03'],
        },
      ]
    : [
        {
          id: 'rel_starter_protagonist_foil',
          fromEntityId: 'ent_starter_protagonist',
          toEntityId: 'ent_starter_foil',
          type: 'story-pressure',
          label: 'Opposition reveals choice',
          polarity: 'mixed',
          intensity: 0.72,
          evidenceSceneIds: ['sc_starter_02', 'sc_starter_03'],
        },
        {
          id: 'rel_starter_setting_rule',
          fromEntityId: 'ent_starter_setting',
          toEntityId: 'ent_starter_rule',
          type: 'world-constraint',
          label: 'World pressure shapes the promise',
          polarity: 'structural',
          intensity: 0.8,
          evidenceSceneIds: ['sc_starter_01'],
        },
      ];

  project.timelineEvents = template.timelineLabels.map((title, index) => ({
    id: `tl_starter_${String(index + 1).padStart(2, '0')}`,
    title,
    plotOrder: index + 1,
    storyDate: index === 0 ? 'Opening state' : index === 1 ? 'Escalation' : 'Commitment point',
    entityIds: project.scenes[index]?.entityIds || [],
    evidenceSceneIds: [project.scenes[index]?.id].filter(Boolean),
  }));

  project.continuityRules = [
    {
      id: 'rule_starter_provisional',
      title: 'Starter outline remains provisional',
      description: 'Seed chapters, scenes, beats, and entities are planning scaffolds until the author approves or revises them.',
      severity: 'review',
      sourceIds: project.scenes.map(scene => scene.id),
    },
  ];

  project.assets = [
    {
      id: 'asset_starter_brief',
      type: 'brief',
      title: 'Starter project brief',
      source: 'author-os-starter',
      rights: 'owned-brief',
      usedIn: [project.project.id, ...project.scenes.map(scene => scene.id)],
      tags: ['starter', 'brief', templateKey],
      provenance: {
        sourceTool: input.sourceTool || 'author-os-starter',
        mode: 'starter-outline',
        template: templateKey,
        generatedAt: createdAt,
        authorProvidedFields: Object.fromEntries(
          Object.entries({
            title: project.project.title,
            premise: premise || null,
            audience,
            genre: project.project.genre,
            tone: tone || null,
          }).filter(([, value]) => value !== null && value !== undefined && value !== ''),
        ),
      },
    },
  ];

  project.tasks = [
    {
      id: 'task_seed_premise',
      kind: 'brainstorm',
      title: 'Review starter premise and promise',
      status: 'needs_review',
      targetType: 'Project',
      targetId: project.project.id,
      sourceIds: ['asset_starter_brief'],
      createdAt,
      updatedAt: createdAt,
      evidence: project.scenes.map(scene => scene.id),
    },
    {
      id: 'task_seed_canon',
      kind: 'brainstorm',
      title: 'Name first canon facts and aliases',
      status: 'queued',
      targetType: 'Project',
      targetId: project.project.id,
      sourceIds: project.entities.map(entity => entity.id),
      createdAt,
      updatedAt: createdAt,
      evidence: project.entities.map(entity => entity.id),
    },
    {
      id: 'task_seed_continuity',
      kind: 'continuity_check',
      title: 'Check starter outline for contradictions',
      status: 'queued',
      targetType: 'Project',
      targetId: project.project.id,
      sourceIds: project.scenes.map(scene => scene.id),
      createdAt,
      updatedAt: createdAt,
      evidence: project.scenes.map(scene => scene.id),
    },
    {
      id: 'task_seed_visual_board',
      kind: 'asset_generation',
      title: 'Create first character or mood board brief',
      status: 'queued',
      targetType: 'Asset',
      targetId: 'asset_starter_brief',
      sourceIds: ['asset_starter_brief'],
      createdAt,
      updatedAt: createdAt,
      evidence: ['asset_starter_brief'],
    },
    {
      id: 'task_seed_publish_path',
      kind: 'publish_prep',
      title: 'Draft metadata and export path',
      status: 'queued',
      targetType: 'Project',
      targetId: project.project.id,
      sourceIds: [project.project.id],
      createdAt,
      updatedAt: createdAt,
      evidence: [project.project.id],
    },
  ];

  const board = createDefaultBoard(project);
  project.boards = [{
    ...board,
    title: 'Starter Story Canvas',
    nodes: [
      ...board.nodes,
      {
        id: 'node_task_seed_continuity',
        kind: 'task',
        x: 520,
        y: 78,
        title: 'Continuity audit',
        summary: 'Queued before prose or export',
        sourceId: 'task_seed_continuity',
      },
      {
        id: 'node_asset_starter_brief',
        kind: 'asset',
        x: 520,
        y: 250,
        title: 'Starter brief',
        summary: template.label,
        sourceId: 'asset_starter_brief',
      },
    ],
    edges: [
      ...board.edges,
      { id: 'edge_starter_scene_task', from: 'sc_starter_02_canvas', to: 'node_task_seed_continuity', label: 'audit' },
      { id: 'edge_starter_brief_scene', from: 'node_asset_starter_brief', to: 'sc_starter_01_canvas', label: 'informs' },
    ],
  }];

  project.publishingPlans = [{
    ...createDefaultPublishingPlan(project),
    id: 'pub_starter_path',
    title: `${project.project.title} Starter Launch Path`,
  }];

  project.decisions = [
    {
      id: 'decision_seed_contract',
      kind: 'starter-outline',
      title: 'Starter cockpit created as editable structure',
      summary: 'The starter generated chapters, scene cards, beats, provisional codex entries, a canvas, review tasks, and a provenance brief. It did not write or revise manuscript prose, and all starter facts remain provisional until author approval.',
      createdAt,
      evidence: ['asset_starter_brief', ...project.scenes.map(scene => scene.id)],
    },
  ];

  return normalizeProject(project);
}

export function normalizeProject(project = {}) {
  const empty = {
    graphVersion: AUTHOR_OS_GRAPH_VERSION,
    workspace: { id: createId('wrk'), name: 'Local Author Workspace', plan: 'open-core' },
    project: { id: createId('prj'), title: 'Untitled Book', type: 'book', genre: [], stage: 'ideation', targetWords: 80000 },
    series: [],
    books: [],
    chapters: [],
    scenes: [],
    beats: [],
    entities: [],
    relationships: [],
    arcs: [],
    themes: [],
    clues: [],
    timelineEvents: [],
    continuityRules: [],
    boards: [],
    assets: [],
    tasks: [],
    agentRuns: [],
    suggestions: [],
    approvals: [],
    exports: [],
    publishingPlans: [],
    creditLedger: [],
    installedPacks: [],
    decisions: [],
  };

  const merged = { ...empty, ...project };
  for (const key of Object.keys(empty)) {
    if (Array.isArray(empty[key]) && !Array.isArray(merged[key])) merged[key] = [];
  }
  merged.workspace = { ...empty.workspace, ...(project.workspace || {}) };
  merged.project = { ...empty.project, ...(project.project || {}) };
  return merged;
}

export function validateProjectGraph(project) {
  const graph = normalizeProject(project);
  const errors = [];
  const warnings = [];

  if (!graph.project.title) errors.push('project.title is required.');
  if (!graph.books.length) warnings.push('No books defined. Add at least one book for export and publishing ops.');

  for (const entity of graph.entities) {
    if (!storyEntityKinds.includes(entity.kind)) warnings.push(`Unknown entity kind "${entity.kind}" for ${entity.name || entity.id}.`);
  }

  const chapterIds = new Set(graph.chapters.map(chapter => chapter.id));
  for (const scene of graph.scenes) {
    if (scene.chapterId && !chapterIds.has(scene.chapterId)) warnings.push(`Scene "${scene.title || scene.id}" points to missing chapterId ${scene.chapterId}.`);
  }

  const assetIds = new Set(graph.assets.map(asset => asset.id));
  for (const entity of graph.entities) {
    for (const assetId of entity.assetIds || []) {
      if (!assetIds.has(assetId)) warnings.push(`Entity "${entity.name}" references missing asset ${assetId}.`);
    }
  }

  const runIds = new Set(graph.agentRuns.map(run => run.id));
  for (const suggestion of graph.suggestions) {
    if (!suggestion.targetId && !suggestion.sceneId) warnings.push(`Suggestion ${suggestion.id} has no target.`);
    if (suggestion.runId && !runIds.has(suggestion.runId)) warnings.push(`Suggestion ${suggestion.id} references missing run ${suggestion.runId}.`);
    if (suggestion.approvalState === 'applied') {
      const approval = graph.approvals.find(item => item.targetId === suggestion.id && item.decision === 'approved');
      if (!approval) warnings.push(`Suggestion ${suggestion.id} is applied without an approval record.`);
    }
  }

  for (const entry of graph.creditLedger) {
    if (entry.runId && !runIds.has(entry.runId)) warnings.push(`Credit ledger entry ${entry.id} references missing run ${entry.runId}.`);
    if (Number(entry.billableUsd || 0) < 0) errors.push(`Credit ledger entry ${entry.id} has negative billableUsd.`);
  }

  return { ok: errors.length === 0, errors, warnings };
}

export function selectModelRoute(taskType, deploymentConfig = {}) {
  const routeId = modelRoutingPolicy.taskToRoute[taskType] || 'operations';
  const policy = modelRoutingPolicy.routes[routeId];
  const configuredModel = deploymentConfig.models?.[routeId] || deploymentConfig.models?.[policy.tier] || null;
  return {
    routeId,
    configuredModel,
    policy,
    gatewayTags: [...policy.gatewayTags, `task:${taskType}`],
  };
}

export function createSceneRecord(input = {}) {
  return {
    id: input.id || createId('scn'),
    chapterId: input.chapterId || null,
    title: input.title || 'Untitled Scene',
    synopsis: input.synopsis || '',
    pov: input.pov || null,
    status: input.status || 'planned',
    order: Number.isFinite(input.order) ? input.order : 0,
    wordCount: countWords(input.text || input.draft || ''),
    text: input.text || input.draft || '',
    entityIds: input.entityIds || [],
    beatIds: input.beatIds || [],
    timelineEventIds: input.timelineEventIds || [],
    tags: input.tags || [],
    updatedAt: input.updatedAt || nowIso(),
  };
}

export function createAgentRun(input = {}) {
  const route = selectModelRoute(input.taskType || 'operations', input.deploymentConfig || {});
  return {
    id: input.id || createId('run'),
    taskId: input.taskId || null,
    taskType: input.taskType || 'operations',
    status: input.status || 'queued',
    routeId: route.routeId,
    model: route.configuredModel || 'gateway:dynamic',
    gatewayTags: route.gatewayTags,
    promptScope: input.promptScope || [],
    costEstimateUsd: input.costEstimateUsd || null,
    tokenEstimate: input.tokenEstimate || null,
    approvalState: input.approvalState || 'not_required',
    output: input.output || null,
    createdAt: input.createdAt || nowIso(),
    updatedAt: input.updatedAt || nowIso(),
  };
}

export function createRevisionSuggestion(project, sceneId, instruction, options = {}) {
  const graph = normalizeProject(project);
  const scene = graph.scenes.find(item => item.id === sceneId);
  if (!scene) {
    const error = new Error(`Scene not found: ${sceneId}`);
    error.code = 'SCENE_NOT_FOUND';
    throw error;
  }

  const run = createAgentRun({
    taskType: 'revise_scene',
    status: options.status || 'completed',
    deploymentConfig: options.deploymentConfig,
    promptScope: options.promptScope || [`scene:${scene.id}`, 'instruction'],
    costEstimateUsd: options.estimatedCostUsd ?? null,
    tokenEstimate: options.tokenEstimate ?? null,
    approvalState: 'requested',
    output: { suggestionPending: true, sceneId: scene.id },
  });

  const suggestion = createSuggestion({
    sceneId: scene.id,
    title: `Revision suggestion for ${scene.title}`,
    instruction,
    proposal: options.proposal || `Revise "${scene.title}" with this intent: ${instruction}`,
    evidence: [scene.id, ...(options.evidence || [])],
    runId: run.id,
    routeId: run.routeId,
    approvalState: 'requested',
  });

  const creditLedgerEntry = createCreditLedgerEntry({
    workspaceId: graph.workspace.id,
    projectId: graph.project.id,
    runId: run.id,
    taskType: 'revise_scene',
    provider: options.provider || 'vercel-ai-gateway',
    model: run.model,
    estimatedCostUsd: options.estimatedCostUsd || 0,
    includedCreditUsd: options.includedCreditUsd || 0,
    inputTokens: options.inputTokens || 0,
    outputTokens: options.outputTokens || 0,
  });

  return {
    scene,
    run,
    suggestion,
    creditLedgerEntry,
    route: selectModelRoute('revise_scene', options.deploymentConfig || {}),
  };
}

export function appendAuditArtifacts(project, artifacts = {}) {
  const graph = normalizeProject(project);
  return normalizeProject({
    ...graph,
    agentRuns: [...graph.agentRuns, ...(artifacts.agentRuns || artifacts.runs || [])],
    suggestions: [...graph.suggestions, ...(artifacts.suggestions || [])],
    approvals: [...graph.approvals, ...(artifacts.approvals || [])],
    creditLedger: [...graph.creditLedger, ...(artifacts.creditLedger || artifacts.creditLedgerEntries || [])],
    exports: [...graph.exports, ...(artifacts.exports || [])],
    project: {
      ...graph.project,
      updatedAt: nowIso(),
    },
  });
}

export function decideSuggestion(project, suggestionId, decision, options = {}) {
  const graph = normalizeProject(project);
  const suggestion = graph.suggestions.find(item => item.id === suggestionId);
  if (!suggestion) {
    const error = new Error(`Suggestion not found: ${suggestionId}`);
    error.code = 'SUGGESTION_NOT_FOUND';
    throw error;
  }

  const normalizedDecision = decision || options.decision || 'pending';
  if (!['pending', 'approved', 'rejected', 'conditioned'].includes(normalizedDecision)) {
    const error = new Error(`Unsupported approval decision: ${normalizedDecision}`);
    error.code = 'UNSUPPORTED_APPROVAL_DECISION';
    throw error;
  }

  const approval = createApproval({
    targetType: 'Suggestion',
    targetId: suggestion.id,
    decision: normalizedDecision,
    approverId: options.approverId || 'local-human',
    notes: options.notes || '',
    conditions: options.conditions || [],
  });
  const approvalState = normalizedDecision === 'approved'
    ? 'approved'
    : normalizedDecision === 'rejected'
      ? 'rejected'
      : normalizedDecision === 'conditioned'
        ? 'conditioned'
        : 'requested';

  const updatedSuggestion = {
    ...suggestion,
    approvalState,
    updatedAt: nowIso(),
  };
  const updated = normalizeProject({
    ...graph,
    suggestions: graph.suggestions.map(item => item.id === suggestion.id ? updatedSuggestion : item),
    approvals: [...graph.approvals, approval],
    project: {
      ...graph.project,
      updatedAt: nowIso(),
    },
  });

  return {
    project: updated,
    suggestion: updatedSuggestion,
    approval,
  };
}

export function buildProjectContext(project, options = {}) {
  const graph = normalizeProject(project);
  const sceneLimit = options.sceneLimit || 8;
  const entityLimit = options.entityLimit || 16;
  const scenes = [...graph.scenes].sort((a, b) => (a.order || 0) - (b.order || 0)).slice(0, sceneLimit);
  const entities = graph.entities.slice(0, entityLimit);
  const wordCount = graph.scenes.reduce((sum, scene) => sum + (scene.wordCount || countWords(scene.text)), 0);
  const entitlements = createEntitlementSnapshot(graph.workspace.plan);
  const installedPacks = graph.installedPacks.map(pack => ({
    id: pack.id,
    packId: pack.packId || pack.id,
    manifestId: pack.manifestId,
    version: pack.version,
    name: pack.name || pack.packId || pack.id,
    offerId: pack.offerId,
    category: pack.category,
    status: pack.status || 'installed',
    installedAt: pack.installedAt,
    trust: pack.trust || {},
  }));

  return {
    project: graph.project,
    workspace: graph.workspace,
    entitlements,
    creditSummary: summarizeCreditLedger(graph, entitlements),
    installedPacks,
    approvals: {
      pendingSuggestions: graph.suggestions.filter(suggestion => suggestion.approvalState === 'requested').length,
      appliedSuggestions: graph.suggestions.filter(suggestion => suggestion.approvalState === 'applied').length,
      approvalRecords: graph.approvals.length,
    },
    stats: {
      books: graph.books.length,
      chapters: graph.chapters.length,
      scenes: graph.scenes.length,
      entities: graph.entities.length,
      relationships: graph.relationships.length,
      timelineEvents: graph.timelineEvents.length,
      assets: graph.assets.length,
      openTasks: graph.tasks.filter(task => !['done', 'cancelled'].includes(task.status)).length,
      installedPacks: installedPacks.length,
      wordCount,
      targetProgress: graph.project.targetWords ? Number(((wordCount / graph.project.targetWords) * 100).toFixed(1)) : null,
    },
    scenes: scenes.map(scene => ({
      id: scene.id,
      title: scene.title,
      synopsis: scene.synopsis,
      status: scene.status,
      pov: scene.pov,
      wordCount: scene.wordCount || countWords(scene.text),
      tags: scene.tags || [],
    })),
    entities: entities.map(entity => ({
      id: entity.id,
      kind: entity.kind,
      name: entity.name,
      aliases: entity.aliases || [],
      summary: entity.summary || '',
      assetIds: entity.assetIds || [],
    })),
    continuityRules: graph.continuityRules.slice(0, 12),
    publishingPlans: graph.publishingPlans.slice(0, 3),
  };
}

export function searchManuscript(project, query, options = {}) {
  const graph = normalizeProject(project);
  const needle = String(query || '').trim().toLowerCase();
  if (!needle) return [];
  const limit = options.limit || 12;
  const results = [];

  for (const scene of graph.scenes) {
    const haystack = [scene.title, scene.synopsis, scene.text, ...(scene.tags || [])].join('\n').toLowerCase();
    const index = haystack.indexOf(needle);
    if (index >= 0) {
      const text = scene.text || scene.synopsis || scene.title || '';
      const plainIndex = text.toLowerCase().indexOf(needle);
      const start = Math.max(0, plainIndex - 80);
      const end = Math.min(text.length, (plainIndex >= 0 ? plainIndex : 0) + needle.length + 120);
      results.push({
        type: 'scene',
        id: scene.id,
        title: scene.title,
        score: 1,
        excerpt: text.slice(start, end).trim(),
      });
    }
  }

  for (const entity of graph.entities) {
    const haystack = [entity.name, entity.summary, ...(entity.aliases || []), ...(entity.tags || [])].join('\n').toLowerCase();
    if (haystack.includes(needle)) {
      results.push({
        type: 'entity',
        id: entity.id,
        title: entity.name,
        score: 0.85,
        excerpt: entity.summary || `${entity.kind}: ${entity.name}`,
      });
    }
  }

  return results.slice(0, limit);
}

export function runContinuityCheck(project) {
  const graph = normalizeProject(project);
  const issues = [];
  const entityIds = new Set(graph.entities.map(entity => entity.id));

  for (const scene of graph.scenes) {
    if (!scene.synopsis && !scene.text) {
      issues.push({
        id: createId('cnt'),
        severity: 'medium',
        type: 'empty-scene',
        title: `Scene "${scene.title || scene.id}" has no synopsis or draft text.`,
        evidence: [scene.id],
        suggestedAction: 'Add a synopsis or draft before continuity review.',
      });
    }
    for (const entityId of scene.entityIds || []) {
      if (!entityIds.has(entityId)) {
        issues.push({
          id: createId('cnt'),
          severity: 'high',
          type: 'missing-entity',
          title: `Scene "${scene.title || scene.id}" references missing entity ${entityId}.`,
          evidence: [scene.id],
          suggestedAction: 'Create the entity or remove the scene reference.',
        });
      }
    }
  }

  for (const rel of graph.relationships) {
    if (!entityIds.has(rel.fromEntityId) || !entityIds.has(rel.toEntityId)) {
      issues.push({
        id: createId('cnt'),
        severity: 'high',
        type: 'broken-relationship',
        title: `Relationship "${rel.label || rel.id}" points to missing entities.`,
        evidence: [rel.id],
        suggestedAction: 'Repair relationship endpoints before export.',
      });
    }
  }

  const timelineByDate = new Map();
  for (const event of graph.timelineEvents) {
    if (!event.storyDate) continue;
    const key = `${event.storyDate}:${event.entityIds?.sort().join(',') || ''}`;
    const bucket = timelineByDate.get(key) || [];
    bucket.push(event);
    timelineByDate.set(key, bucket);
  }
  for (const bucket of timelineByDate.values()) {
    if (bucket.length > 1) {
      issues.push({
        id: createId('cnt'),
        severity: 'low',
        type: 'timeline-collision',
        title: `${bucket.length} timeline events share the same story date/entity slot.`,
        evidence: bucket.map(event => event.id),
        suggestedAction: 'Confirm whether these events are simultaneous or need chronology edits.',
      });
    }
  }

  return {
    id: createId('report'),
    status: issues.length ? 'needs_review' : 'clear',
    generatedAt: nowIso(),
    issueCount: issues.length,
    issues,
    run: createAgentRun({
      taskType: 'run_continuity_check',
      status: 'completed',
      promptScope: ['chapters', 'scenes', 'entities', 'relationships', 'timelineEvents'],
      output: { issueCount: issues.length },
    }),
  };
}

export function createExportRecord(project, input = {}) {
  const graph = normalizeProject(project);
  const format = input.format || 'markdown';
  const approvalState = input.approvalState || (['markdown', 'md'].includes(format) ? 'not_required' : 'requested');
  return {
    id: input.id || createId('exp'),
    projectId: graph.project.id,
    format,
    status: input.status || 'queued',
    path: input.path || null,
    approvalState,
    sourceRunId: input.sourceRunId || input.runId || null,
    checksum: input.checksum || null,
    createdAt: input.createdAt || nowIso(),
    updatedAt: input.updatedAt || nowIso(),
  };
}

export function createPublishingReadinessReport(project, options = {}) {
  const graph = normalizeProject(project);
  const validation = validateProjectGraph(graph);
  const continuity = options.continuityReport || runContinuityCheck(graph);
  const entitlements = options.entitlements || createEntitlementSnapshot(graph.workspace.plan);
  const wordCount = graph.scenes.reduce((sum, scene) => sum + (scene.wordCount || countWords(scene.text)), 0);
  const pendingSuggestions = graph.suggestions.filter(suggestion => suggestion.approvalState === 'requested');
  const unresolvedAssets = graph.assets.filter(asset => /needs|unknown|unlicensed/i.test(asset.rights || ''));
  const hasExport = graph.exports.some(item => ['completed', 'ready'].includes(item.status));
  const highContinuityIssues = continuity.issues.filter(issue => issue.severity === 'high');

  const checks = [
    {
      id: 'graph-valid',
      label: 'Story graph is structurally valid',
      status: validation.ok ? 'pass' : 'fail',
      evidence: validation.errors,
    },
    {
      id: 'manuscript-present',
      label: 'Manuscript has draft words',
      status: wordCount > 0 ? 'pass' : 'fail',
      evidence: { wordCount },
    },
    {
      id: 'continuity-clear',
      label: 'No high-severity continuity issues',
      status: highContinuityIssues.length === 0 ? 'pass' : 'needs_review',
      evidence: highContinuityIssues.map(issue => issue.id),
    },
    {
      id: 'suggestions-approved',
      label: 'No pending revision suggestions before export',
      status: pendingSuggestions.length === 0 ? 'pass' : 'needs_review',
      evidence: pendingSuggestions.map(suggestion => suggestion.id),
    },
    {
      id: 'asset-rights-known',
      label: 'Public-facing asset rights are known',
      status: unresolvedAssets.length === 0 ? 'pass' : 'needs_review',
      evidence: unresolvedAssets.map(asset => asset.id),
    },
    {
      id: 'export-record',
      label: 'At least one export artifact is recorded',
      status: hasExport ? 'pass' : 'needs_export',
      evidence: graph.exports.map(item => item.id),
    },
  ];

  const status = checks.some(check => check.status === 'fail')
    ? 'blocked'
    : checks.some(check => ['needs_review', 'needs_export'].includes(check.status))
      ? 'needs_review'
      : 'ready';

  return {
    id: options.id || createId('ready'),
    projectId: graph.project.id,
    status,
    generatedAt: nowIso(),
    checks,
    validation,
    continuity: {
      status: continuity.status,
      issueCount: continuity.issueCount,
      highIssueCount: highContinuityIssues.length,
    },
    trust: entitlements.trust,
    creditSummary: summarizeCreditLedger(graph, entitlements),
  };
}

export function generateCharacterBoard(project, characterIdOrName) {
  const graph = normalizeProject(project);
  const key = String(characterIdOrName || '').toLowerCase();
  const character = graph.entities.find(entity =>
    entity.kind === 'Character' &&
    (entity.id === characterIdOrName || entity.name?.toLowerCase() === key || (entity.aliases || []).map(alias => alias.toLowerCase()).includes(key))
  );

  if (!character) {
    return {
      found: false,
      message: `Character not found: ${characterIdOrName}`,
      board: null,
    };
  }

  const relationshipNodes = graph.relationships
    .filter(rel => rel.fromEntityId === character.id || rel.toEntityId === character.id)
    .map((rel, index) => ({
      id: `${rel.id}_node`,
      kind: 'character',
      x: 420 + (index % 3) * 220,
      y: 120 + Math.floor(index / 3) * 160,
      title: rel.label || 'Relationship',
      summary: rel.summary || `${rel.fromEntityId} -> ${rel.toEntityId}`,
      sourceId: rel.id,
    }));

  const sceneNodes = graph.scenes
    .filter(scene => (scene.entityIds || []).includes(character.id))
    .slice(0, 8)
    .map((scene, index) => ({
      id: `${scene.id}_node`,
      kind: 'scene',
      x: 80 + (index % 2) * 240,
      y: 360 + Math.floor(index / 2) * 140,
      title: scene.title,
      summary: scene.synopsis,
      sourceId: scene.id,
    }));

  return {
    found: true,
    character,
    board: {
      id: createId('brd'),
      title: `${character.name} Character Board`,
      type: 'character-picture-board',
      nodes: [
        {
          id: `${character.id}_hero`,
          kind: 'character',
          x: 80,
          y: 80,
          title: character.name,
          summary: character.summary || 'Character profile',
          sourceId: character.id,
          assetIds: character.assetIds || [],
        },
        ...relationshipNodes,
        ...sceneNodes,
      ],
      edges: graph.relationships
        .filter(rel => rel.fromEntityId === character.id || rel.toEntityId === character.id)
        .map(rel => ({
          id: `${rel.id}_edge`,
          from: `${character.id}_hero`,
          to: `${rel.id}_node`,
          label: rel.label || rel.type || 'related',
        })),
    },
  };
}

export function exportBookMarkdown(project, options = {}) {
  const graph = normalizeProject(project);
  const title = options.title || graph.project.title;
  const scenesByChapter = new Map();
  for (const scene of graph.scenes) {
    const key = scene.chapterId || 'unassigned';
    const list = scenesByChapter.get(key) || [];
    list.push(scene);
    scenesByChapter.set(key, list);
  }

  const parts = [`# ${title}`, '', `> Exported by Agentic Author OS on ${nowIso()}`, ''];

  const orderedChapters = [...graph.chapters].sort((a, b) => (a.order || 0) - (b.order || 0));
  for (const chapter of orderedChapters) {
    parts.push(`## ${chapter.title || 'Untitled Chapter'}`, '');
    const scenes = (scenesByChapter.get(chapter.id) || []).sort((a, b) => (a.order || 0) - (b.order || 0));
    if (chapter.summary) parts.push(`_${chapter.summary}_`, '');
    if (!scenes.length && chapter.text) {
      parts.push(chapter.text, '');
    }
    for (const scene of scenes) {
      if (scene.title) parts.push(`### ${scene.title}`, '');
      if (scene.text) {
        parts.push(scene.text.trim(), '');
      } else if (scene.synopsis) {
        parts.push(`_${scene.synopsis}_`, '');
      }
    }
  }

  const orphanScenes = (scenesByChapter.get('unassigned') || []).sort((a, b) => (a.order || 0) - (b.order || 0));
  if (orphanScenes.length) {
    parts.push('## Unassigned Scenes', '');
    for (const scene of orphanScenes) {
      parts.push(`### ${scene.title}`, '', scene.text || `_${scene.synopsis || 'No draft text yet.'}_`, '');
    }
  }

  return parts.join('\n').replace(/\n{4,}/g, '\n\n\n');
}

export function buildCockpitViewModel(project) {
  const graph = normalizeProject(project);
  const context = buildProjectContext(graph);
  const continuity = runContinuityCheck(graph);
  const openTasks = graph.tasks.filter(task => !['done', 'cancelled'].includes(task.status));
  const activeBoard = graph.boards[0] || createDefaultBoard(graph);
  const readiness = createPublishingReadinessReport(graph, { continuityReport: continuity });

  return {
    generatedAt: nowIso(),
    brand: {
      core: 'Agentic Author OS',
      premium: 'Arcanea Author Cockpit',
      positioning: 'Figma/Linear for books: manuscript, canon graph, visual story canvas, agent runs, and publishing ops.',
    },
    context,
    manuscriptSpine: graph.chapters.map(chapter => ({
      id: chapter.id,
      title: chapter.title,
      status: chapter.status || 'drafting',
      wordCount: chapter.wordCount || graph.scenes.filter(scene => scene.chapterId === chapter.id).reduce((sum, scene) => sum + (scene.wordCount || countWords(scene.text)), 0),
      sceneCount: graph.scenes.filter(scene => scene.chapterId === chapter.id).length,
    })),
    corkboard: graph.scenes.map(scene => ({
      id: scene.id,
      title: scene.title,
      status: scene.status,
      pov: scene.pov,
      synopsis: scene.synopsis,
      wordCount: scene.wordCount || countWords(scene.text),
      tags: scene.tags || [],
    })),
    canvas: activeBoard,
    codex: graph.entities,
    relationshipGraph: {
      nodes: graph.entities.map(entity => ({ id: entity.id, label: entity.name, kind: entity.kind })),
      edges: graph.relationships.map(rel => ({ id: rel.id, from: rel.fromEntityId, to: rel.toEntityId, label: rel.label || rel.type })),
    },
    timeline: graph.timelineEvents,
    dam: graph.assets,
    agentTaskBoard: {
      queued: openTasks.filter(task => task.status === 'queued'),
      running: openTasks.filter(task => task.status === 'running'),
      review: openTasks.filter(task => task.status === 'needs_review'),
      done: graph.tasks.filter(task => task.status === 'done').slice(-6),
    },
    publishingOps: graph.publishingPlans[0] || createDefaultPublishingPlan(graph),
    continuity,
    readiness,
    offers: offerCatalog,
    modelRoutingPolicy,
  };
}

export function createDefaultBoard(project) {
  const graph = normalizeProject(project);
  const nodes = [
    ...graph.scenes.slice(0, 6).map((scene, index) => ({
      id: `${scene.id}_canvas`,
      kind: 'scene',
      x: 70 + (index % 3) * 210,
      y: 80 + Math.floor(index / 3) * 180,
      title: scene.title,
      summary: scene.synopsis,
      sourceId: scene.id,
    })),
    ...graph.entities.slice(0, 5).map((entity, index) => ({
      id: `${entity.id}_canvas`,
      kind: entity.kind === 'Character' ? 'character' : 'location',
      x: 70 + (index % 3) * 210,
      y: 430 + Math.floor(index / 3) * 150,
      title: entity.name,
      summary: entity.summary,
      sourceId: entity.id,
    })),
  ];

  return {
    id: 'board_story_canvas',
    title: 'Story Canvas',
    type: 'story-canvas',
    nodes,
    edges: graph.relationships.slice(0, 12).map(rel => ({
      id: `${rel.id}_canvas_edge`,
      from: `${rel.fromEntityId}_canvas`,
      to: `${rel.toEntityId}_canvas`,
      label: rel.label || rel.type || 'linked',
    })),
  };
}

export function createDefaultPublishingPlan(project) {
  const graph = normalizeProject(project);
  return {
    id: 'pub_default',
    projectId: graph.project.id,
    title: `${graph.project.title} Launch Plan`,
    metadata: {
      title: graph.project.title,
      subtitle: '',
      author: '',
      categories: graph.project.genre || [],
      keywords: [],
    },
    checklist: [
      { id: 'front-matter', label: 'Front matter drafted', status: 'todo' },
      { id: 'back-matter', label: 'Back matter and reader CTA drafted', status: 'todo' },
      { id: 'cover', label: 'Cover and source rights attached', status: 'todo' },
      { id: 'continuity', label: 'Continuity report clear or approved', status: 'todo' },
      { id: 'export', label: 'Markdown/DOCX export generated', status: 'todo' },
    ],
    deliverables: ['markdown', 'docx', 'epub', 'pdf', 'kdp-package'],
    launchMilestones: [],
  };
}

export const sampleProject = normalizeProject({
  graphVersion: AUTHOR_OS_GRAPH_VERSION,
  workspace: {
    id: 'wrk_arcanea_demo',
    name: 'Arcanea Foundry',
    plan: 'cloud-studio',
  },
  project: {
    id: 'prj_luminous_archive',
    title: 'The Luminous Archive',
    type: 'novel',
    genre: ['mythic fantasy', 'romantasy', 'AI-native fiction'],
    stage: 'drafting',
    targetWords: 92000,
    createdAt: '2026-07-04T00:00:00.000Z',
    updatedAt: nowIso(),
  },
  books: [
    { id: 'book_01', projectId: 'prj_luminous_archive', title: 'The Luminous Archive', status: 'drafting', targetWords: 92000 },
  ],
  chapters: [
    { id: 'ch_01', bookId: 'book_01', title: 'The Door That Remembered Her', order: 1, status: 'drafting', summary: 'Mira discovers a living archive under the city.' },
    { id: 'ch_02', bookId: 'book_01', title: 'Ink With A Pulse', order: 2, status: 'planned', summary: 'The archive marks her hand with a forbidden map.' },
    { id: 'ch_03', bookId: 'book_01', title: 'The Cartographer Prince', order: 3, status: 'planned', summary: 'A rival heir offers protection at a dangerous price.' },
  ],
  scenes: [
    createSceneRecord({
      id: 'sc_01',
      chapterId: 'ch_01',
      title: 'Midnight Intake',
      synopsis: 'Mira follows a missing page into the sealed archive.',
      pov: 'Mira',
      status: 'drafting',
      order: 1,
      text: 'Mira found the stairwell by listening for the page that breathed.',
      entityIds: ['ent_mira', 'ent_archive'],
      tags: ['hook', 'mystery'],
    }),
    createSceneRecord({
      id: 'sc_02',
      chapterId: 'ch_01',
      title: 'The Contract Page',
      synopsis: 'The archive offers answers if Mira gives it one memory.',
      pov: 'Mira',
      status: 'needs_review',
      order: 2,
      text: 'The page did not ask for blood. It asked for the summer she had hidden from herself.',
      entityIds: ['ent_mira', 'ent_archive'],
      tags: ['bargain', 'canon-risk'],
    }),
    createSceneRecord({
      id: 'sc_03',
      chapterId: 'ch_02',
      title: 'A Map Beneath Skin',
      synopsis: 'Gold ink appears on Mira after the bargain.',
      pov: 'Mira',
      status: 'planned',
      order: 3,
      entityIds: ['ent_mira', 'ent_gold_ink'],
      tags: ['body-magic', 'visual'],
    }),
    createSceneRecord({
      id: 'sc_04',
      chapterId: 'ch_03',
      title: 'Kael Makes A False Promise',
      synopsis: 'Kael claims he can remove the map, but his family made it.',
      pov: 'Kael',
      status: 'planned',
      order: 4,
      entityIds: ['ent_mira', 'ent_kael', 'ent_gold_ink'],
      tags: ['romance', 'betrayal'],
    }),
  ],
  entities: [
    { id: 'ent_mira', kind: 'Character', name: 'Mira Vale', aliases: ['The Index-Bearer'], summary: 'A restoration scribe who can hear damaged books remember their missing pages.', assetIds: ['asset_mira_portrait'], tags: ['protagonist'] },
    { id: 'ent_kael', kind: 'Character', name: 'Kael Orison', aliases: ['The Cartographer Prince'], summary: 'A prince trained to draw borders that become law.', assetIds: ['asset_kael_portrait'], tags: ['love-interest', 'rival'] },
    { id: 'ent_archive', kind: 'Location', name: 'The Luminous Archive', aliases: ['The Living Stacks'], summary: 'A buried library that stores memories as moving ink.', assetIds: ['asset_archive_mood'], tags: ['setting'] },
    { id: 'ent_gold_ink', kind: 'Rule', name: 'Gold Ink Contract', aliases: ['Living Map'], summary: 'A contract cannot be erased until the memory it guards is witnessed.', tags: ['magic-system'] },
  ],
  relationships: [
    { id: 'rel_mira_kael', fromEntityId: 'ent_mira', toEntityId: 'ent_kael', type: 'romantic-rivalry', label: 'Distrust with magnetic pull', polarity: 'mixed', intensity: 0.72, evidenceSceneIds: ['sc_04'] },
    { id: 'rel_mira_archive', fromEntityId: 'ent_mira', toEntityId: 'ent_archive', type: 'contract', label: 'Memory bargain', polarity: 'dangerous', intensity: 0.91, evidenceSceneIds: ['sc_01', 'sc_02'] },
    { id: 'rel_archive_ink', fromEntityId: 'ent_archive', toEntityId: 'ent_gold_ink', type: 'source', label: 'Creates contracts', polarity: 'structural', intensity: 1, evidenceSceneIds: ['sc_02'] },
  ],
  timelineEvents: [
    { id: 'tl_01', title: 'Mira enters the Archive', plotOrder: 1, storyDate: 'Day 1 / Midnight', entityIds: ['ent_mira', 'ent_archive'], evidenceSceneIds: ['sc_01'] },
    { id: 'tl_02', title: 'The gold map appears', plotOrder: 2, storyDate: 'Day 2 / Dawn', entityIds: ['ent_mira', 'ent_gold_ink'], evidenceSceneIds: ['sc_03'] },
  ],
  assets: [
    { id: 'asset_mira_portrait', type: 'portrait', title: 'Mira portrait reference', source: 'generated-placeholder-brief', rights: 'needs-generation', usedIn: ['ent_mira'], tags: ['character', 'portrait'] },
    { id: 'asset_kael_portrait', type: 'portrait', title: 'Kael portrait reference', source: 'generated-placeholder-brief', rights: 'needs-generation', usedIn: ['ent_kael'], tags: ['character', 'portrait'] },
    { id: 'asset_archive_mood', type: 'moodboard', title: 'Living archive atmosphere', source: 'internal-brief', rights: 'owned-brief', usedIn: ['ent_archive'], tags: ['location', 'mood'] },
  ],
  tasks: [
    { id: 'task_continuity_01', kind: 'continuity_check', title: 'Check contract magic consistency', status: 'needs_review', sourceIds: ['ent_gold_ink', 'sc_02', 'sc_03'] },
    { id: 'task_visual_01', kind: 'asset_generation', title: 'Generate Mira portrait board', status: 'queued', sourceIds: ['ent_mira'] },
    { id: 'task_publish_01', kind: 'publish_prep', title: 'Draft back matter reader magnet CTA', status: 'queued', sourceIds: ['prj_luminous_archive'] },
  ],
  boards: [
    {
      id: 'board_demo',
      title: 'Act I Story Canvas',
      type: 'story-canvas',
      nodes: [
        { id: 'node_sc_01', kind: 'scene', x: 70, y: 80, title: 'Midnight Intake', summary: 'Opening hook', sourceId: 'sc_01' },
        { id: 'node_sc_02', kind: 'scene', x: 300, y: 140, title: 'The Contract Page', summary: 'Memory bargain', sourceId: 'sc_02' },
        { id: 'node_task', kind: 'task', x: 500, y: 78, title: 'Continuity audit', summary: 'Contract magic rules', sourceId: 'task_continuity_01' },
        { id: 'node_mira', kind: 'character', x: 190, y: 390, title: 'Mira Vale', summary: 'Index-Bearer', sourceId: 'ent_mira', assetIds: ['asset_mira_portrait'] },
        { id: 'node_archive', kind: 'location', x: 485, y: 360, title: 'The Luminous Archive', summary: 'Living stacks', sourceId: 'ent_archive' },
      ],
      edges: [
        { id: 'edge_01', from: 'node_sc_01', to: 'node_sc_02', label: 'escalates' },
        { id: 'edge_02', from: 'node_mira', to: 'node_archive', label: 'bargain' },
        { id: 'edge_03', from: 'node_sc_02', to: 'node_task', label: 'check' },
      ],
    },
  ],
});

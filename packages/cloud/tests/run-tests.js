import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {
  createBillingLedgerEntryFromGrant,
  createBillingAccountSnapshot,
  createDemoBillingPortalClient,
  createDemoCheckoutClient,
  createDemoAssetAdapter,
  createEntitlementMutationFromBillingEvent,
  createAccessDecision,
  createCloudReadinessChecklist,
  createDemoBillingAdapter,
  createDemoProjectAdapter,
  createProductionEnvContract,
  createProductionSetupContract,
  createPostgresBillingAdapter,
  createPostgresProjectAdapter,
  createHostedAssetService,
  createProductionEvidenceReport,
  createHostedWorkflowService,
  createHostedProjectService,
  createHostedRequestContext,
  createPackInstallAccessDecision,
  createLaunchOperationsPlan,
  createMcpProtectedResourceMetadata,
  createMcpWwwAuthenticateHeader,
  createProductionLaunchChecklist,
  createStripeBillingPortalClient,
  createStripeBillingPortalSessionPlan,
  createStripeCheckoutClient,
  createStripeCheckoutSessionPlan,
  createStripeFormParams,
  createServiceIntake,
  createUnconfiguredAssetAdapter,
  createUnconfiguredBillingAdapter,
  createUnconfiguredBillingPortalClient,
  createUnconfiguredCheckoutClient,
  createVercelEnvApplyPlan,
  createVercelEnvBaselinePlan,
  createVercelEnvCommandPlan,
  createVercelRemoteEnvAudit,
  isAuthorOsDemoMode,
  isHostedProductionTarget,
  normalizeBillingEvent,
  parseVercelEnvListOutput,
  renderProductionEnvExample,
  resolveBillingModeForOffer,
  sanitizeStripeBillingPortalSessionPlan,
  sanitizeStripeCheckoutSessionPlan,
  verifyStripeWebhookSignature,
} from '../src/index.js';
import {
  AUTHOR_OS_CLOUD_MIGRATION_VERSION,
  createCloudMigrationPlan,
  createCloudMigrationRunner,
  loadCloudMigrations,
} from '../src/migrations.js';
import { sampleProject } from '../../core/src/index.js';

const demoContext = createHostedRequestContext({
  projectId: 'prj_luminous_archive',
  env: { AUTHOROS_DEMO_MODE: 'true' },
});
assert.equal(demoContext.mode, 'demo');
assert.equal(demoContext.workspaceId, 'wrk_arcanea_demo');
assert.equal(isAuthorOsDemoMode({}), true);
assert.equal(isAuthorOsDemoMode({ AUTHOROS_DEMO_MODE: 'true', VERCEL_ENV: 'production' }), false);
assert.equal(isHostedProductionTarget({ VERCEL_TARGET_ENV: 'production' }), true);

assert.throws(() => createHostedRequestContext({
  env: {
    AUTHOROS_DEMO_MODE: 'true',
    VERCEL_ENV: 'production',
  },
}), /verified authentication/);

const headerContext = createHostedRequestContext({
  headers: {
    'x-author-os-user-id': 'user_header',
    'x-author-os-workspace-id': 'wrk_header',
    'x-author-os-plan': 'cloud-creator',
    'x-author-os-role': 'editor',
  },
  env: { AUTHOROS_DEMO_MODE: 'false' },
});
assert.equal(headerContext.userId, 'user_header');
assert.equal(headerContext.workspaceId, 'wrk_header');
assert.deepEqual(headerContext.roles, ['editor']);
assert.equal(headerContext.authVerified, false);
assert.equal(headerContext.authSource, 'header');

assert.throws(() => createHostedRequestContext({
  env: { AUTHOROS_REQUIRE_AUTH: 'true' },
}), /verified authentication/);

assert.throws(() => createHostedRequestContext({
  headers: {
    'x-author-os-user-id': 'user_spoof',
    'x-author-os-workspace-id': 'wrk_spoof',
    'x-author-os-role': 'owner',
  },
  env: {
    AUTHOROS_DEMO_MODE: 'false',
    AUTHOROS_REQUIRE_AUTH: 'true',
  },
}), /verified authentication/);

const trustedHeaderContext = createHostedRequestContext({
  headers: {
    'x-author-os-user-id': 'user_gateway',
    'x-author-os-workspace-id': 'wrk_gateway',
    'x-author-os-plan': 'cloud-creator',
    'x-author-os-role': 'editor',
  },
  env: {
    AUTHOROS_DEMO_MODE: 'false',
    AUTHOROS_REQUIRE_AUTH: 'true',
    AUTHOROS_ALLOW_TRUSTED_AUTH_HEADERS: 'true',
  },
});
assert.equal(trustedHeaderContext.authVerified, true);
assert.equal(trustedHeaderContext.authSource, 'trusted-header');
assert.equal(trustedHeaderContext.workspaceId, 'wrk_gateway');

const verifiedAuthContext = createHostedRequestContext({
  auth: {
    verified: true,
    source: 'clerk',
    authProvider: 'clerk',
    userId: 'user_clerk',
    workspaceId: 'wrk_clerk',
    plan: 'cloud-studio',
    roles: ['owner'],
  },
  env: {
    AUTHOROS_DEMO_MODE: 'false',
    AUTHOROS_REQUIRE_AUTH: 'true',
    AUTHOROS_AUTH_PROVIDER: 'clerk',
  },
});
assert.equal(verifiedAuthContext.mode, 'production');
assert.equal(verifiedAuthContext.authProvider, 'clerk');
assert.equal(verifiedAuthContext.authSource, 'clerk');
assert.equal(verifiedAuthContext.authVerified, true);
assert.equal(verifiedAuthContext.workspaceId, 'wrk_clerk');

const mcpMetadata = createMcpProtectedResourceMetadata({
  env: {
    NEXT_PUBLIC_APP_URL: 'https://author.arcanea.ai',
    AUTHOROS_MCP_AUTHORIZATION_SERVER_URL: 'https://accounts.author.arcanea.ai',
  },
  requestUrl: 'https://ignored-preview.vercel.app/api/mcp',
});
assert.equal(mcpMetadata.resource, 'https://author.arcanea.ai/api/mcp');
assert.equal(mcpMetadata.protected_resource, 'https://author.arcanea.ai/api/mcp');
assert.deepEqual(mcpMetadata.authorization_servers, ['https://accounts.author.arcanea.ai']);
assert.ok(mcpMetadata.scopes_supported.includes('authoros:agents'));
assert.equal(mcpMetadata.authorization_server_status, 'configured');

const localMcpMetadata = createMcpProtectedResourceMetadata({
  requestUrl: 'http://127.0.0.1:3220/api/mcp',
});
assert.equal(localMcpMetadata.resource, 'http://127.0.0.1:3220/api/mcp');
assert.equal(localMcpMetadata.authorization_server_status, 'fallback_origin');

const mcpWwwAuthenticate = createMcpWwwAuthenticateHeader({
  env: {
    NEXT_PUBLIC_APP_URL: 'https://author.arcanea.ai',
    AUTHOROS_MCP_AUTHORIZATION_SERVER_URL: 'https://accounts.author.arcanea.ai',
  },
  scopes: ['authoros:read'],
});
assert.ok(mcpWwwAuthenticate.includes('Bearer realm="AuthorOS MCP"'));
assert.ok(mcpWwwAuthenticate.includes('resource_metadata="https://author.arcanea.ai/.well-known/oauth-protected-resource"'));
assert.ok(mcpWwwAuthenticate.includes('scope="authoros:read"'));

const adapter = createDemoProjectAdapter();
const service = createHostedProjectService({ projectAdapter: adapter });
const listedProjects = await service.listProjects(demoContext);
assert.equal(listedProjects.projects.length, 1);
assert.equal(listedProjects.projects[0].id, 'prj_luminous_archive');

const cockpit = await service.readCockpit('prj_luminous_archive', demoContext);
assert.equal(cockpit.projectId, 'prj_luminous_archive');
assert.equal(cockpit.cockpit.context.entitlements.offerId, 'cloud-studio');
assert.equal(cockpit.access.allowed, true);

const canon = await service.readCanon('prj_luminous_archive', demoContext);
assert.ok(canon.canon.entities.some(entity => entity.id === 'ent_mira'));
assert.ok(canon.canon.relationships.some(relationship => relationship.id === 'rel_mira_archive'));

const search = await service.searchManuscript('prj_luminous_archive', demoContext, { query: 'stairwell' });
assert.ok(search.results.some(result => result.id === 'sc_01'));

const readiness = await service.readPublishingReadiness('prj_luminous_archive', demoContext);
assert.ok(['ready', 'needs_review', 'blocked'].includes(readiness.readiness.status));
assert.equal(readiness.tenant.userId, 'present');

let createdProject = null;
const createAdapter = {
  async loadProject(projectId) {
    return createdProject?.project.id === projectId ? createdProject : null;
  },
  async saveProject(next) {
    createdProject = next;
    return next.project.id;
  },
};
const createService = createHostedProjectService({ projectAdapter: createAdapter });
const created = await createService.createProject(demoContext, {
  title: 'Hosted Test Novel',
  genre: ['mystery'],
  targetWords: 70000,
  template: 'mystery-thriller',
  premise: 'A sleep-deprived archivist finds a clue inside a book that has not been written yet.',
  audience: 'mystery readers who like literary puzzles',
});
assert.equal(created.project.title, 'Hosted Test Novel');
assert.equal(created.project.workspaceId, demoContext.workspaceId);
assert.equal(created.activationSummary.mode, 'starter');
assert.equal(created.activationSummary.template, 'mystery-thriller');
assert.equal(created.activationSummary.chapterCount, 3);
assert.equal(created.activationSummary.sceneCount, 3);
assert.ok(created.activationSummary.taskCount >= 4);
assert.equal(createdProject.workspace.id, demoContext.workspaceId);
assert.equal(createdProject.workspace.plan, demoContext.plan);
assert.equal(createdProject.project.template, 'mystery-thriller');
assert.ok(createdProject.scenes.length >= 3);
assert.ok(createdProject.tasks.some(task => task.id === 'task_seed_continuity'));
assert.ok(createdProject.assets.some(asset => asset.id === 'asset_starter_brief'));
assert.ok(createdProject.decisions.some(decision => decision.id === 'decision_seed_contract'));

const packRegistry = await createService.listPacks(demoContext);
assert.equal(packRegistry.registry.manifest.id, 'authoros-foundry-pack');
assert.equal(packRegistry.registry.packs.length, 6);
assert.equal(packRegistry.packAccess.allowed, true);
assert.ok(packRegistry.packAccess.matchedFeatures.includes('marketplace'));
const hostedPackInstall = await createService.installPack(created.project.id, demoContext, {
  packId: 'publishing-ops',
});
assert.deepEqual(hostedPackInstall.installed, ['publishing-ops']);
assert.equal(hostedPackInstall.noProseGenerated, true);
assert.equal(hostedPackInstall.packAccess.allowed, true);
assert.ok(hostedPackInstall.packAccess.matchedFeatures.includes('marketplace'));
assert.ok(createdProject.installedPacks.some(pack => pack.packId === 'publishing-ops'));
assert.ok(createdProject.tasks.some(task => task.sourcePackId === 'publishing-ops'));
assert.ok(createdProject.publishingPlans.some(plan => plan.id === 'pub_pack_publishing_ops'));
assert.equal(createPackInstallAccessDecision({ plan: 'open-core' }).allowed, false);
assert.equal(createPackInstallAccessDecision({ plan: 'foundry-pack' }).allowed, true);
assert.ok(createPackInstallAccessDecision({ plan: 'foundry-pack' }).matchedFeatures.includes('foundry-pack'));

const blank = await createService.createProject(demoContext, {
  title: 'Blank Hosted Book',
  blank: true,
});
assert.equal(blank.activationSummary.mode, 'blank');
assert.equal(blank.activationSummary.sceneCount, 0);
assert.equal(createdProject.project.title, 'Blank Hosted Book');
assert.equal(createdProject.workspace.id, demoContext.workspaceId);

const imported = await createService.createProject(demoContext, {
  graph: {
    ...sampleProject,
    workspace: { id: 'wrk_wrong', plan: 'open-core' },
    project: { ...sampleProject.project, id: 'prj_imported', title: 'Imported Graph' },
  },
});
assert.equal(imported.project.workspaceId, demoContext.workspaceId);
assert.equal(createdProject.workspace.id, demoContext.workspaceId);
assert.equal(createdProject.project.title, 'Imported Graph');
assert.equal(imported.importSummary.mode, 'graph');

const importedManuscriptProject = await createService.createProject(demoContext, {
  title: 'Hosted Manuscript Import',
  sourceName: 'hosted-import.md',
  manuscriptText: [
    '# Hosted Manuscript Import',
    '',
    '## Chapter One',
    '',
    'The hosted import turns manuscript text into a project graph.',
    '',
    '## Chapter Two',
    '',
    'The second chapter becomes a second imported scene.',
  ].join('\n'),
});
assert.equal(importedManuscriptProject.project.title, 'Hosted Manuscript Import');
assert.equal(importedManuscriptProject.project.workspaceId, demoContext.workspaceId);
assert.equal(importedManuscriptProject.importSummary.mode, 'manuscript-text');
assert.equal(importedManuscriptProject.importSummary.chapterCount, 2);
assert.equal(importedManuscriptProject.importSummary.sceneCount, 2);
assert.equal(createdProject.workspace.id, demoContext.workspaceId);
assert.equal(createdProject.assets[0].type, 'manuscript');
assert.ok(createdProject.tasks.some(task => task.id === 'task_import_review'));

let memoryProject = structuredClone(sampleProject);
const memoryAdapter = {
  async loadProject() {
    return memoryProject;
  },
  async saveProject(next) {
    memoryProject = next;
    return next.project.id;
  },
};
const workflowService = createHostedWorkflowService({ projectAdapter: memoryAdapter });
const sceneRun = await workflowService.startAgentRun('prj_luminous_archive', demoContext, {
  taskType: 'create_scene',
  title: 'Hosted Scene',
  synopsis: 'A hosted scene written through MCP.',
  text: 'A hosted scene leaves an auditable trail.',
});
assert.equal(sceneRun.scene.title, 'Hosted Scene');
assert.equal(memoryProject.scenes.at(-1).id, sceneRun.scene.id);
assert.equal(memoryProject.agentRuns.at(-1).output.sceneId, sceneRun.scene.id);

const revisionRun = await workflowService.startAgentRun('prj_luminous_archive', demoContext, {
  taskType: 'revise_scene',
  sceneId: 'sc_01',
  instruction: 'Make the first image stranger.',
  estimatedCostUsd: 0.12,
  includedCreditUsd: 0.05,
});
assert.equal(revisionRun.suggestion.approvalState, 'requested');
assert.equal(memoryProject.suggestions.length, 1);
assert.equal(memoryProject.creditLedger[0].billableUsd, 0.07);

let managedAiProject = structuredClone(sampleProject);
const managedAiWorkflowService = createHostedWorkflowService({
  projectAdapter: {
    async loadProject() {
      return managedAiProject;
    },
    async saveProject(next) {
      managedAiProject = next;
      return next.project.id;
    },
  },
  aiAdapter: {
    async runTask(taskType, input) {
      return {
        mode: 'dry-run',
        status: 'completed',
        text: taskType === 'create_scene'
          ? 'The archive answered with a chorus of numbered doors.'
          : 'Managed AI proposal: make the page breath feel stranger while preserving Mira voice.',
        finishReason: 'stop',
        provider: 'vercel-ai-gateway',
        model: 'anthropic/test-prose',
        routeId: 'prose',
        gatewayTags: ['feature:prose', `task:${taskType}`, `workspace:${input.workspaceId}`],
        promptScope: input.promptScope,
        usage: { inputTokens: 80, outputTokens: 24, totalTokens: 104 },
        estimatedCostUsd: 0.42,
      };
    },
  },
});
const managedScene = await managedAiWorkflowService.startAgentRun('prj_luminous_archive', demoContext, {
  taskType: 'create_scene',
  title: 'Managed Draft Scene',
  synopsis: 'Created through the managed AI adapter.',
  useManagedAi: true,
});
assert.equal(managedScene.scene.text, 'The archive answered with a chorus of numbered doors.');
assert.equal(managedScene.managedAi.model, 'anthropic/test-prose');
assert.equal(managedAiProject.creditLedger.at(-1).source, 'managed-gateway-dry-run');
const managedRevision = await managedAiWorkflowService.startAgentRun('prj_luminous_archive', demoContext, {
  taskType: 'revise_scene',
  sceneId: 'sc_01',
  instruction: 'Use managed AI for a reviewable proposal.',
  useManagedAi: true,
});
assert.equal(managedRevision.suggestion.proposal, 'Managed AI proposal: make the page breath feel stranger while preserving Mira voice.');
assert.equal(managedRevision.run.model, 'anthropic/test-prose');
assert.equal(managedRevision.creditLedgerEntry.inputTokens, 80);
assert.equal(managedAiProject.suggestions.at(-1).runId, managedRevision.run.id);

const approval = await workflowService.decideSuggestion('prj_luminous_archive', demoContext, revisionRun.suggestion.id, {
  decision: 'approved',
  notes: 'Approved for next revision pass.',
});
assert.equal(approval.suggestion.approvalState, 'approved');
assert.equal(memoryProject.approvals.length, 1);

const exportRun = await workflowService.startAgentRun('prj_luminous_archive', demoContext, {
  taskType: 'export_book',
  format: 'markdown',
});
assert.equal(exportRun.export.status, 'ready');
assert.equal(memoryProject.exports.length, 1);
assert.ok(exportRun.sandbox);

const assetAdapter = createDemoAssetAdapter();
const assetService = createHostedAssetService({ projectAdapter: memoryAdapter, assetAdapter });
const listedAssets = await assetService.listAssets('prj_luminous_archive', demoContext);
assert.ok(listedAssets.assets.some(asset => asset.id === 'asset_mira_portrait'));
const assetRun = await assetService.createAsset('prj_luminous_archive', demoContext, {
  title: 'Mira visual reference',
  type: 'portrait',
  filename: 'mira-reference.png',
  contentType: 'image/png',
  contentBase64: Buffer.from('fake image bytes').toString('base64'),
  rights: 'licensed-reference',
  usedIn: ['ent_mira'],
  tags: ['portrait', 'character'],
  provenance: {
    license: 'operator-verified',
  },
});
assert.equal(assetRun.asset.rights, 'licensed-reference');
assert.equal(assetRun.asset.provenance.storage, 'demo-blob');
assert.ok(assetRun.asset.blobUrl.startsWith('demo-blob://'));
assert.ok(memoryProject.assets.some(asset => asset.id === assetRun.asset.id));
assert.ok(memoryProject.entities.find(entity => entity.id === 'ent_mira').assetIds.includes(assetRun.asset.id));
assert.equal(memoryProject.agentRuns.at(-1).output.assetId, assetRun.asset.id);

const metadataOnlyAsset = await createHostedAssetService({
  projectAdapter: memoryAdapter,
  assetAdapter: createUnconfiguredAssetAdapter({ reason: 'Blob unavailable.' }),
}).createAsset('prj_luminous_archive', demoContext, {
  title: 'External cover comp',
  type: 'cover',
  source: 'https://example.com/cover-comp.jpg',
  rights: 'licensed-reference',
  usedIn: ['book_01'],
  tags: ['cover'],
});
assert.equal(metadataOnlyAsset.asset.source, 'https://example.com/cover-comp.jpg');
assert.equal(metadataOnlyAsset.asset.provenance.storage, 'metadata-only');
await assert.rejects(
  () => createHostedAssetService({
    projectAdapter: memoryAdapter,
    assetAdapter: createUnconfiguredAssetAdapter({ reason: 'Blob unavailable.' }),
  }).createAsset('prj_luminous_archive', demoContext, {
    title: 'Binary upload without Blob',
    contentBase64: Buffer.from('bytes').toString('base64'),
  }),
  /Blob unavailable/,
);

const wrongTenant = createHostedRequestContext({
  headers: {
    'x-authoros-user-id': 'user_wrong',
    'x-authoros-workspace-id': 'wrk_wrong',
    'x-authoros-plan': 'cloud-studio',
    'x-authoros-roles': 'owner',
  },
  env: { AUTHOROS_DEMO_MODE: 'false' },
});
const denied = createAccessDecision(wrongTenant, sampleProject);
assert.equal(denied.allowed, false);
assert.equal(denied.reason, 'workspace_mismatch');

function readEnvExample(file) {
  return Object.fromEntries(
    fs.readFileSync(file, 'utf-8')
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#') && line.includes('='))
      .map(line => {
        const index = line.indexOf('=');
        return [line.slice(0, index), line.slice(index + 1)];
      }),
  );
}

const readyLaunchEnv = {
  AUTHOROS_DEMO_MODE: 'false',
  AUTHOROS_REQUIRE_AUTH: 'true',
  AUTHOROS_AUTH_PROVIDER: 'clerk',
  AUTHOROS_ALLOW_TRUSTED_AUTH_HEADERS: 'false',
  AUTHOROS_DEFAULT_PLAN: 'cloud-creator',
  AUTHOROS_DEFAULT_AUTH_ROLE: 'editor',
  AUTHOROS_PROJECT_ADAPTER: 'postgres',
  AUTHOROS_DB_MIGRATION_VERSION: '001_author_os_cloud',
  AUTHOROS_MIGRATION_APPLIED_BY: 'author-os-cli',
  AUTHOROS_PG_POOL_MAX: '5',
  AUTHOROS_PG_IDLE_TIMEOUT_MS: '5000',
  NEXT_PUBLIC_APP_URL: 'https://author.arcanea.ai',
  CLERK_SECRET_KEY: 'sk_test_clerk_authoros123',
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_test_clerk_authoros123',
  NEXT_PUBLIC_CLERK_SIGN_IN_URL: '/sign-in',
  NEXT_PUBLIC_CLERK_SIGN_UP_URL: '/sign-up',
  AUTHOROS_MCP_AUTHORIZATION_SERVER_URL: 'https://accounts.author.arcanea.ai',
  POSTGRES_URL: 'postgres://author:password@db.neon.tech/authoros?sslmode=require',
  BLOB_READ_WRITE_TOKEN: 'vercel_blob_rw_test_authoros123',
  STRIPE_SECRET_KEY: 'sk_test_stripe_authoros123',
  STRIPE_WEBHOOK_SECRET: 'whsec_authoros123',
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: 'pk_test_stripe_authoros123',
  STRIPE_BILLING_PORTAL_CONFIGURATION: 'bpc_authoros',
  STRIPE_PRICE_PRO_LOCAL: 'price_pro_authoros',
  STRIPE_PRICE_CLOUD_CREATOR: 'price_creator_authoros',
  STRIPE_PRICE_CLOUD_STUDIO: 'price_studio_authoros',
  STRIPE_PRICE_AGENCY_SMALL_PRESS: 'price_agency_authoros',
  STRIPE_PRICE_FOUNDER_LIFETIME_LOCAL: 'price_founder_authoros',
  STRIPE_PRICE_FOUNDRY_PACK: 'price_foundry_authoros',
  STRIPE_PRICE_CONCIERGE_SETUP: 'price_setup_authoros',
  STRIPE_PRICE_AGENTIC_SERVICE_SPRINT: 'price_sprint_authoros',
  AI_GATEWAY_API_KEY: 'vck_authoros123',
  AUTHOROS_MODEL_EXTRACTOR: 'anthropic/test-extractor',
  AUTHOROS_MODEL_CONTINUITY: 'anthropic/test-continuity',
  AUTHOROS_MODEL_PROSE: 'anthropic/test-prose',
  AUTHOROS_MODEL_VISUAL: 'google/test-visual',
  AUTHOROS_MODEL_OPERATIONS: 'openai/test-operations',
  AUTHOROS_AI_PROVIDER_ORDER: 'anthropic,bedrock',
  AUTHOROS_AI_FALLBACK_MODELS: 'openai/test-fallback',
  AUTHOROS_AI_MAX_INPUT_TOKENS: '24000',
  AUTHOROS_AI_MAX_OUTPUT_TOKENS: '1200',
  SENTRY_DSN: 'https://abc123@o1.ingest.sentry.io/2',
  NEXT_PUBLIC_POSTHOG_KEY: 'phc_authoros123',
  NEXT_PUBLIC_POSTHOG_HOST: 'https://us.i.posthog.com',
  AUTHOROS_VERCEL_PROTECTION_BYPASS: 'vercel_bypass_authoros123',
};

const checklist = createCloudReadinessChecklist(readyLaunchEnv);
assert.equal(checklist.status, 'ready');

const productionTargetDemoSeal = createCloudReadinessChecklist({
  AUTHOROS_DEMO_MODE: 'true',
  VERCEL_ENV: 'production',
});
assert.equal(productionTargetDemoSeal.demoMode, false);

const exampleEnv = readEnvExample(path.resolve('apps/cockpit/.env.example'));
const exampleEnvContract = createProductionEnvContract(exampleEnv);
assert.equal(exampleEnvContract.status, 'blocked');
assert.ok(exampleEnvContract.placeholderRequired.includes('CLERK_SECRET_KEY'));
assert.ok(exampleEnvContract.placeholderRequired.includes('POSTGRES_URL'));
assert.ok(exampleEnvContract.placeholderRequired.includes('AI_GATEWAY_API_KEY'));
assert.ok(exampleEnvContract.placeholderRequired.includes('AUTHOROS_MCP_AUTHORIZATION_SERVER_URL'));
assert.ok(exampleEnvContract.placeholderRecommended.includes('AUTHOROS_VERCEL_PROTECTION_BYPASS'));
assert.equal(exampleEnvContract.specs.find(spec => spec.name === 'CLERK_SECRET_KEY').valueState, 'placeholder');
const exampleCloudReadiness = createCloudReadinessChecklist(exampleEnv);
assert.equal(exampleCloudReadiness.status, 'needs_config');
const exampleLaunch = createProductionLaunchChecklist(exampleEnv);
assert.equal(exampleLaunch.status, 'blocked');
assert.ok(exampleLaunch.blockers.includes('clerk-provider'));
assert.ok(exampleLaunch.blockers.includes('mcp-oauth-discovery'));
assert.ok(exampleLaunch.blockers.includes('postgres-url'));

const blockedLaunch = createProductionLaunchChecklist({
  AUTHOROS_DEMO_MODE: 'true',
});
assert.equal(blockedLaunch.status, 'blocked');
assert.ok(blockedLaunch.blockers.includes('demo-mode-disabled'));
assert.ok(blockedLaunch.blockers.includes('postgres-adapter'));

const productionTargetLaunch = createProductionLaunchChecklist({
  AUTHOROS_DEMO_MODE: 'true',
  VERCEL_TARGET_ENV: 'production',
});
assert.equal(productionTargetLaunch.demoMode, false);
assert.ok(productionTargetLaunch.blockers.includes('demo-mode-disabled'));

const readyLaunch = createProductionLaunchChecklist(readyLaunchEnv);
assert.equal(readyLaunch.status, 'ready');
assert.equal(readyLaunch.demoMode, false);

const launchWithoutPreviewBypass = createProductionLaunchChecklist({
  ...readyLaunchEnv,
  AUTHOROS_VERCEL_PROTECTION_BYPASS: '',
});
assert.equal(launchWithoutPreviewBypass.status, 'needs_review');
assert.ok(launchWithoutPreviewBypass.warnings.includes('protected-preview-bypass'));

const blockedEnvContract = createProductionEnvContract({});
assert.equal(blockedEnvContract.status, 'blocked');
assert.ok(blockedEnvContract.missingRequired.includes('AUTHOROS_DEMO_MODE'));
assert.ok(blockedEnvContract.missingRequired.includes('POSTGRES_URL'));

const readyEnvContract = createProductionEnvContract(readyLaunchEnv);
assert.equal(readyEnvContract.status, 'ready');
assert.equal(readyEnvContract.requiredReadyCount, readyEnvContract.requiredCount);
assert.equal(readyEnvContract.specs.find(spec => spec.name === 'CLERK_SECRET_KEY').current, 'redacted');
assert.equal(readyEnvContract.specs.find(spec => spec.name === 'AUTHOROS_VERCEL_PROTECTION_BYPASS').current, 'redacted');

const badBypassEnvContract = createProductionEnvContract({ AUTHOROS_VERCEL_PROTECTION_BYPASS: 'short' });
assert.equal(badBypassEnvContract.status, 'blocked');
assert.ok(badBypassEnvContract.invalidRecommended.includes('AUTHOROS_VERCEL_PROTECTION_BYPASS'));

const envExample = renderProductionEnvExample();
assert.ok(envExample.includes('AUTHOROS_DEMO_MODE=false'));
assert.ok(envExample.includes('POSTGRES_URL=postgres://user:password@host.neon.tech/db?sslmode=require'));
assert.ok(envExample.includes('AUTHOROS_VERCEL_PROTECTION_BYPASS=vercel_protection_bypass_replace_me'));
assert.ok(!envExample.includes('present'));

const vercelEnvPlan = createVercelEnvCommandPlan({ project: 'author-os', environments: ['production'] });
assert.ok(vercelEnvPlan.commands.some(item => item.command === 'vercel env add AUTHOROS_PROJECT_ADAPTER production'));
assert.ok(vercelEnvPlan.commands.some(item => item.name === 'CLERK_SECRET_KEY' && item.sensitive));
assert.ok(vercelEnvPlan.commands.every(item => !item.command.includes('sk_live_replace_me')));
const previewVercelEnvPlan = createVercelEnvCommandPlan({
  project: 'author-os',
  environments: ['preview'],
  previewBranch: 'authoros-preview',
});
assert.equal(previewVercelEnvPlan.previewBranch, 'authoros-preview');
assert.equal(previewVercelEnvPlan.previewBranchRequired, false);
assert.ok(previewVercelEnvPlan.commands.some(item => item.command === 'vercel env add AUTHOROS_PROJECT_ADAPTER preview authoros-preview'));
const productionBranchPreviewPlan = createVercelEnvCommandPlan({
  project: 'author-os',
  environments: ['preview'],
  previewBranch: 'main',
  productionBranch: 'main',
});
assert.equal(productionBranchPreviewPlan.previewBranch, null);
assert.equal(productionBranchPreviewPlan.requestedPreviewBranch, 'main');
assert.equal(productionBranchPreviewPlan.previewBranchProductionConflict, true);
assert.equal(productionBranchPreviewPlan.previewBranchRequired, true);
assert.ok(productionBranchPreviewPlan.note.includes('matches the production branch'));
assert.ok(productionBranchPreviewPlan.commands.every(item => item.previewBranchProductionConflict));
assert.ok(productionBranchPreviewPlan.commands.every(item => item.command.includes('preview <non-production-branch>')));

const providerFixtureClerkSecret = ['sk', 'test', 'clerksecret123'].join('_');
const providerFixtureClerkPublishable = ['pk', 'test', 'clerkpublic123'].join('_');
const providerFixtureStripeSecret = ['sk', 'test', 'stripesecret123'].join('_');
const providerFixtureStripePublishable = ['pk', 'test', 'stripepublic123'].join('_');
const providerFixtureStripeWebhook = ['whsec', 'stripewebhook123'].join('_');
const providerFixturePlaceholderSecret = ['sk', 'live', 'replace_me'].join('_');

const providerApplyEnv = {
  CLERK_SECRET_KEY: providerFixtureClerkSecret,
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: providerFixtureClerkPublishable,
  AUTHOROS_MCP_AUTHORIZATION_SERVER_URL: 'https://auth.author.example',
  DATABASE_URL: 'postgres://author:password@db.author.example/app?sslmode=require',
  BLOB_READ_WRITE_TOKEN: 'blob_rw_token_123456789',
  STRIPE_SECRET_KEY: providerFixtureStripeSecret,
  STRIPE_WEBHOOK_SECRET: providerFixtureStripeWebhook,
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: providerFixtureStripePublishable,
  STRIPE_PRICE_PRO_LOCAL: 'price_prolocal123',
  STRIPE_PRICE_CLOUD_CREATOR: 'price_cloudcreator123',
  STRIPE_PRICE_CLOUD_STUDIO: 'price_cloudstudio123',
  STRIPE_PRICE_AGENCY_SMALL_PRESS: 'price_agency123',
  AI_GATEWAY_API_KEY: 'vck_ai_gateway_123456',
};
const providerApplyPlan = createVercelEnvApplyPlan({
  project: 'author-os',
  environments: ['production', 'preview'],
  previewBranch: 'codex/author-os-preview',
  names: Object.keys(providerApplyEnv),
  env: providerApplyEnv,
});
assert.equal(providerApplyPlan.status, 'ready');
assert.equal(providerApplyPlan.readyCount, 13);
assert.equal(providerApplyPlan.commandCount, 26);
assert.ok(providerApplyPlan.commands.some(item => item.name === 'POSTGRES_URL' && item.configuredName === 'DATABASE_URL'));
assert.ok(providerApplyPlan.commands.every(item => item.command.includes('--value <redacted>')));
assert.ok(providerApplyPlan.commands.every(item => !item.command.includes(providerFixtureClerkSecret)));
assert.ok(!JSON.stringify(providerApplyPlan).includes(providerFixtureClerkSecret));
assert.ok(!JSON.stringify(providerApplyPlan).includes('postgres://author:password'));
assert.ok(providerApplyPlan.commands.some(item => item.name === 'CLERK_SECRET_KEY' && item.sensitive && item.command.includes('--sensitive')));
assert.ok(providerApplyPlan.commands.some(item => item.name === 'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY' && !item.sensitive && item.command.includes('--no-sensitive')));
const defaultProviderApplyPlan = createVercelEnvApplyPlan({
  project: 'author-os',
  environments: ['production'],
  env: {
    CLERK_SECRET_KEY: providerFixtureClerkSecret,
    STRIPE_PRICE_PRO_LOCAL: 'price_prolocal123',
  },
});
assert.deepEqual(defaultProviderApplyPlan.ready.sort(), ['CLERK_SECRET_KEY', 'STRIPE_PRICE_PRO_LOCAL'].sort());
assert.equal(defaultProviderApplyPlan.commandCount, 2);
const invalidProviderApplyPlan = createVercelEnvApplyPlan({
  project: 'author-os',
  environments: ['preview'],
  previewBranch: 'main',
  productionBranch: 'main',
  names: ['CLERK_SECRET_KEY', 'UNKNOWN_AUTHOROS_KEY'],
  env: {
    CLERK_SECRET_KEY: providerFixturePlaceholderSecret,
  },
});
assert.equal(invalidProviderApplyPlan.status, 'blocked');
assert.ok(invalidProviderApplyPlan.invalid.includes('CLERK_SECRET_KEY'));
assert.ok(invalidProviderApplyPlan.unknownNames.includes('UNKNOWN_AUTHOROS_KEY'));
assert.equal(invalidProviderApplyPlan.previewBranchProductionConflict, true);
assert.ok(!JSON.stringify(invalidProviderApplyPlan).includes(providerFixturePlaceholderSecret));

const baselinePlan = createVercelEnvBaselinePlan({
  project: 'author-os',
  environments: ['production'],
  appUrl: 'https://author.arcanea.ai',
});
assert.equal(baselinePlan.previewBranchRequired, false);
assert.ok(baselinePlan.commands.some(item => item.name === 'AUTHOROS_DEMO_MODE' && item.value === 'false'));
assert.ok(baselinePlan.commands.some(item => item.name === 'NEXT_PUBLIC_APP_URL' && item.value === 'https://author.arcanea.ai'));
assert.ok(baselinePlan.commands.some(item => item.name === 'AUTHOROS_PROJECT_ADAPTER' && item.powershellCommand.includes('postgres')));
assert.ok(baselinePlan.commands.every(item => item.command.includes('--value')));
assert.ok(baselinePlan.commands.every(item => item.command.includes('--no-sensitive')));
assert.ok(!baselinePlan.commands.some(item => item.sensitive));
assert.ok(baselinePlan.manualCommands.some(item => item.name === 'CLERK_SECRET_KEY' && item.sensitive));
assert.ok(baselinePlan.manualCommands.some(item => item.name === 'POSTGRES_URL' && item.reason === 'secret_or_token'));
assert.ok(!JSON.stringify(baselinePlan.commands).includes('sk_live_replace_me'));

const previewBaselineWithoutBranch = createVercelEnvBaselinePlan({
  project: 'author-os',
  environments: ['preview'],
  appUrl: 'https://author.arcanea.ai',
});
assert.equal(previewBaselineWithoutBranch.previewBranchRequired, true);
assert.ok(previewBaselineWithoutBranch.commands.every(item => item.requiresPreviewBranch));
assert.ok(previewBaselineWithoutBranch.commands.every(item => item.previewBranchCommand.includes('preview <non-production-branch> --value')));

const previewBaselinePlan = createVercelEnvBaselinePlan({
  project: 'author-os',
  environments: ['preview'],
  previewBranch: 'authoros-preview',
  appUrl: 'https://author.arcanea.ai',
});
assert.equal(previewBaselinePlan.previewBranch, 'authoros-preview');
assert.equal(previewBaselinePlan.previewBranchRequired, false);
assert.ok(previewBaselinePlan.commands.some(item => item.command === 'vercel env add AUTHOROS_DEMO_MODE preview authoros-preview --value false --yes --no-sensitive --force'));
assert.ok(previewBaselinePlan.manualCommands.some(item => item.name === 'CLERK_SECRET_KEY' && item.command === 'vercel env add CLERK_SECRET_KEY preview authoros-preview'));
const productionBranchBaselinePlan = createVercelEnvBaselinePlan({
  project: 'author-os',
  environments: ['preview'],
  previewBranch: 'main',
  productionBranch: 'main',
  appUrl: 'https://author.arcanea.ai',
});
assert.equal(productionBranchBaselinePlan.previewBranch, null);
assert.equal(productionBranchBaselinePlan.requestedPreviewBranch, 'main');
assert.equal(productionBranchBaselinePlan.previewBranchProductionConflict, true);
assert.equal(productionBranchBaselinePlan.previewBranchRequired, true);
assert.ok(productionBranchBaselinePlan.note.includes('safe Preview baseline'));
assert.ok(productionBranchBaselinePlan.commands.every(item => item.requiresPreviewBranch));
assert.ok(productionBranchBaselinePlan.commands.every(item => item.command.includes('preview <non-production-branch>')));
assert.ok(productionBranchBaselinePlan.manualCommands.every(item => item.command.includes('preview <non-production-branch>')));

const vercelEnvListOutput = `
 name                                       value               environments        created
 AUTHOROS_DEMO_MODE                         Encrypted           Production          17m ago
 AUTHOROS_REQUIRE_AUTH                      Encrypted           Production          17m ago
 AUTHOROS_AUTH_PROVIDER                     Encrypted           Production          17m ago
 AUTHOROS_ALLOW_TRUSTED_AUTH_HEADERS        Encrypted           Production          17m ago
 AUTHOROS_DEFAULT_PLAN                      Encrypted           Production          17m ago
 AUTHOROS_DEFAULT_AUTH_ROLE                 Encrypted           Production          17m ago
 AUTHOROS_PROJECT_ADAPTER                   Encrypted           Production          17m ago
 AUTHOROS_DB_MIGRATION_VERSION              Encrypted           Production          17m ago
 AUTHOROS_MIGRATION_APPLIED_BY              Encrypted           Production          17m ago
 AUTHOROS_PG_POOL_MAX                       Encrypted           Production          17m ago
 AUTHOROS_PG_IDLE_TIMEOUT_MS                Encrypted           Production          17m ago
 NEXT_PUBLIC_CLERK_SIGN_IN_URL              Encrypted           Production          17m ago
 NEXT_PUBLIC_CLERK_SIGN_UP_URL              Encrypted           Production          17m ago
 AUTHOROS_AI_MAX_INPUT_TOKENS               Encrypted           Production          17m ago
 AUTHOROS_AI_MAX_OUTPUT_TOKENS              Encrypted           Production          17m ago
 NEXT_PUBLIC_POSTHOG_HOST                   Encrypted           Production          17m ago
 NEXT_PUBLIC_APP_URL                        Encrypted           Production          17m ago
`;
const parsedRemoteEnv = parseVercelEnvListOutput(vercelEnvListOutput);
assert.equal(parsedRemoteEnv.length, 17);
assert.deepEqual(parsedRemoteEnv.find(item => item.name === 'AUTHOROS_DEMO_MODE').environments, ['production']);
const previewVercelEnvListOutput = `
 name                                       value               environments                         created
 AUTHOROS_DEMO_MODE                         Encrypted           Preview (authoros-preview)           2m ago
 NEXT_PUBLIC_APP_URL                        Encrypted           Preview (authoros-preview), Production          2m ago
`;
const parsedPreviewRemoteEnv = parseVercelEnvListOutput(previewVercelEnvListOutput);
assert.deepEqual(parsedPreviewRemoteEnv.find(item => item.name === 'AUTHOROS_DEMO_MODE').environments, ['preview']);
assert.deepEqual(parsedPreviewRemoteEnv.find(item => item.name === 'NEXT_PUBLIC_APP_URL').environments, ['preview', 'production']);
const remoteAudit = createVercelRemoteEnvAudit({
  project: 'author-os',
  environments: ['production'],
  output: vercelEnvListOutput,
  appUrl: 'https://author.arcanea.ai',
});
assert.equal(remoteAudit.summary.baselinePresentCount, remoteAudit.summary.baselineNameCount);
assert.equal(remoteAudit.environmentSummaries.production.requiredPresentCount, 14);
assert.equal(remoteAudit.environmentSummaries.production.baselinePresentCount, remoteAudit.environmentSummaries.production.baselineNameCount);
assert.ok(remoteAudit.missingRequired.includes('CLERK_SECRET_KEY'));
assert.ok(remoteAudit.missingRequired.includes('POSTGRES_URL'));
assert.equal(remoteAudit.status, 'blocked');
assert.ok(remoteAudit.note.includes('presence only'));
assert.ok(!JSON.stringify(remoteAudit).includes('sk_live_replace_me'));
const productionAndPreviewRemoteAudit = createVercelRemoteEnvAudit({
  project: 'author-os',
  environments: ['production', 'preview'],
  output: vercelEnvListOutput,
  appUrl: 'https://author.arcanea.ai',
});
assert.equal(productionAndPreviewRemoteAudit.environmentSummaries.production.baselinePresentCount, productionAndPreviewRemoteAudit.environmentSummaries.production.baselineNameCount);
assert.equal(productionAndPreviewRemoteAudit.environmentSummaries.preview.baselinePresentCount, 0);
assert.ok(productionAndPreviewRemoteAudit.environmentSummaries.preview.missingRequired.includes('AUTHOROS_DEMO_MODE'));
const previewRemoteAudit = createVercelRemoteEnvAudit({
  project: 'author-os',
  environments: ['preview'],
  output: previewVercelEnvListOutput,
  appUrl: 'https://author.arcanea.ai',
  previewBranch: 'authoros-preview',
});
assert.ok(previewRemoteAudit.baseline.present.includes('AUTHOROS_DEMO_MODE'));
assert.ok(previewRemoteAudit.baseline.missing.includes('AUTHOROS_REQUIRE_AUTH'));
assert.equal(previewRemoteAudit.status, 'blocked');

const blockedSetupContract = createProductionSetupContract({ env: {}, project: 'author-os', environments: ['production'] });
assert.equal(blockedSetupContract.status, 'blocked');
assert.ok(blockedSetupContract.connectors.some(connector => connector.id === 'identity' && connector.status === 'blocked'));
assert.ok(blockedSetupContract.proofEndpoints.some(endpoint => endpoint.path === '/api/system/setup-contract'));
assert.ok(blockedSetupContract.commandPlan.commands.some(item => item.name === 'STRIPE_SECRET_KEY' && item.sensitive));
assert.ok(blockedSetupContract.baselinePlan.commands.some(item => item.name === 'AUTHOROS_REQUIRE_AUTH' && item.value === 'true'));
assert.ok(blockedSetupContract.remoteEnvAuditPlan.command.includes('cloud-env --vercel --audit'));
assert.ok(!JSON.stringify(blockedSetupContract).includes('sk_live_replace_me'));

const blockedLaunchPlan = createLaunchOperationsPlan({ env: {}, project: 'author-os' });
assert.equal(blockedLaunchPlan.status, 'blocked');
assert.ok(blockedLaunchPlan.stages.some(stage => stage.id === 'environment' && stage.status === 'blocked'));
assert.ok(blockedLaunchPlan.actions.some(action => action.id === 'apply-safe-env-baseline'));
assert.ok(blockedLaunchPlan.actions.some(action => action.id === 'audit-remote-env-presence'));
assert.ok(blockedLaunchPlan.actions.some(action => action.id === 'configure-production-env'));
assert.ok(blockedLaunchPlan.proofCommands.includes('npm run ci:local'));
const branchedLaunchPlan = createLaunchOperationsPlan({
  env: {},
  project: 'author-os',
  previewBranch: 'authoros-preview',
});
assert.ok(branchedLaunchPlan.actions.find(action => action.id === 'apply-safe-env-baseline').command.includes('--preview-branch authoros-preview'));
assert.ok(branchedLaunchPlan.actions.find(action => action.id === 'configure-production-env').command.includes('--preview-branch authoros-preview'));

const reviewLaunchPlan = createLaunchOperationsPlan({
  env: readyLaunchEnv,
  migration: { plan: { status: 'current', latestVersion: AUTHOR_OS_CLOUD_MIGRATION_VERSION } },
});
assert.equal(reviewLaunchPlan.status, 'needs_review');
assert.ok(reviewLaunchPlan.actions.some(action => action.id === 'deploy-preview'));

const readyLaunchPlan = createLaunchOperationsPlan({
  env: readyLaunchEnv,
  migration: { plan: { status: 'current', latestVersion: AUTHOR_OS_CLOUD_MIGRATION_VERSION } },
  previewVerified: true,
});
assert.equal(readyLaunchPlan.status, 'ready');
assert.equal(readyLaunchPlan.summary.blockerCount, 0);
assert.equal(readyLaunchPlan.summary.reviewCount, 0);

const readySetupContract = createProductionSetupContract({ env: readyLaunchEnv, project: 'author-os' });
assert.equal(readySetupContract.status, 'ready');
assert.equal(readySetupContract.summary.blockedConnectorCount, 0);
assert.ok(readySetupContract.connectors.some(connector => connector.id === 'managed-ai' && connector.status === 'pass'));
assert.ok(readySetupContract.connectors.some(connector => connector.id === 'preview-automation-access' && connector.status === 'pass'));
assert.equal(readySetupContract.envContract.specs.find(spec => spec.name === 'CLERK_SECRET_KEY').current, undefined);
assert.ok(readySetupContract.operatorSequence.some(step => step.command.includes('verify-live-cockpit')));

const setupWithoutPreviewBypass = createProductionSetupContract({
  env: {
    ...readyLaunchEnv,
    AUTHOROS_VERCEL_PROTECTION_BYPASS: '',
  },
  project: 'author-os',
});
assert.equal(setupWithoutPreviewBypass.status, 'needs_review');
assert.ok(setupWithoutPreviewBypass.connectors.some(connector => connector.id === 'preview-automation-access' && connector.status === 'needs_review'));

const readyProductionEvidence = createProductionEvidenceReport({
  env: {
    ...readyLaunchEnv,
    VERCEL_ENV: 'production',
    VERCEL_TARGET_ENV: 'production',
    VERCEL_PROJECT_ID: 'prj_authoros',
    VERCEL_URL: 'author.arcanea.ai',
    VERCEL_PROJECT_PRODUCTION_URL: 'author.arcanea.ai',
    VERCEL_GIT_COMMIT_SHA: 'abc123',
    VERCEL_GIT_COMMIT_REF: 'main',
  },
  migration: { plan: { status: 'current', latestVersion: AUTHOR_OS_CLOUD_MIGRATION_VERSION } },
  previewVerified: true,
  runtime: {
    projectAdapter: 'postgres',
    auth: { provider: 'clerk', required: true, trustedHeaderAuth: false },
  },
  requireProductionTarget: true,
});
assert.equal(readyProductionEvidence.status, 'ready');
assert.equal(readyProductionEvidence.summary.blockerCount, 0);
assert.equal(readyProductionEvidence.summary.operatorNextActionCount, 0);
assert.deepEqual(readyProductionEvidence.operatorNextActions, []);
assert.equal(readyProductionEvidence.evidence.deployment.environment, 'production');
assert.equal(readyProductionEvidence.evidence.runtime.projectAdapter, 'postgres');
assert.ok(!JSON.stringify(readyProductionEvidence).includes('sk_test_clerk_authoros123'));
assert.ok(!JSON.stringify(readyProductionEvidence).includes('postgres://author:password'));

const blockedProductionEvidence = createProductionEvidenceReport({
  env: { AUTHOROS_DEMO_MODE: 'true' },
  runtime: {
    projectAdapter: 'demo',
    auth: { required: false },
  },
  expectProduction: true,
});
assert.equal(blockedProductionEvidence.status, 'blocked');
assert.ok(blockedProductionEvidence.checks.some(check => check.id === 'runtime-production-mode' && check.status === 'blocked'));
assert.ok(blockedProductionEvidence.operatorNextActions.some(action => action.id === 'populate-and-validate-env-values'));
assert.ok(blockedProductionEvidence.operatorNextActions.some(action => action.id === 'audit-remote-env-presence'));
assert.ok(blockedProductionEvidence.operatorNextActions.some(action => action.id === 'promote-verified-preview'));
assert.ok(blockedProductionEvidence.operatorNextActions.every(action => !JSON.stringify(action).includes('sk_live_replace_me')));

const postgresCalls = [];
const postgresAdapter = createPostgresProjectAdapter({
  query: async (sql, params) => {
    postgresCalls.push({ sql, params });
    if (sql.startsWith('select graph from author_projects')) {
      return { rows: [{ graph: sampleProject }] };
    }
    return { rows: [] };
  },
});
await assert.rejects(() => postgresAdapter.loadProject('prj_luminous_archive'), /workspace scope/);
const postgresProject = await postgresAdapter.loadProject('prj_luminous_archive', { workspaceId: 'wrk_arcanea_demo' });
assert.equal(postgresProject.project.id, 'prj_luminous_archive');
assert.ok(postgresCalls.some(call => call.sql.includes("set_config('app.current_workspace_id'")));
postgresCalls.length = 0;
await postgresAdapter.saveProject(sampleProject, {
  workspaceId: 'wrk_arcanea_demo',
  context: {
    userId: 'user_author',
    plan: 'cloud-studio',
    roles: ['editor'],
  },
});
assert.ok(postgresCalls.some(call => call.sql.includes('insert into author_workspaces')));
assert.ok(postgresCalls.some(call => call.sql.includes('insert into author_workspace_members')));
assert.ok(postgresCalls.some(call => call.sql.includes('insert into author_projects')));
assert.ok(postgresCalls.some(call => call.sql.includes('insert into author_assets')));

postgresCalls.length = 0;
await postgresAdapter.saveProject(memoryProject, {
  workspaceId: 'wrk_arcanea_demo',
  context: {
    userId: 'user_author',
    plan: 'cloud-studio',
    roles: ['owner'],
  },
  workflowJobs: [{
    id: 'workflow_test_export',
    runtime: 'vercel-workflows',
    purpose: 'test-export',
    runId: exportRun.run.id,
    status: 'completed',
    steps: ['collect_scope', 'write_artifact'],
    humanPausePoints: ['before_export'],
  }],
});
assert.ok(postgresCalls.some(call => call.sql.includes('insert into author_agent_runs')));
assert.ok(postgresCalls.some(call => call.sql.includes('insert into author_workflow_jobs')));
assert.ok(postgresCalls.some(call => call.sql.includes('insert into author_credit_ledger')));
assert.ok(postgresCalls.some(call => call.sql.includes('insert into author_suggestions')));
assert.ok(postgresCalls.some(call => call.sql.includes('insert into author_approvals')));
assert.ok(postgresCalls.some(call => call.sql.includes('insert into author_exports')));
const workflowCall = postgresCalls.find(call => call.sql.includes('insert into author_workflow_jobs'));
assert.equal(workflowCall.params[3], exportRun.run.id);

const payload = JSON.stringify({
  id: 'evt_test_checkout',
  type: 'checkout.session.completed',
  created: 1783210000,
  data: {
    object: {
      id: 'cs_test_author',
      object: 'checkout.session',
      customer: 'cus_test_author',
      subscription: 'sub_test_author',
      client_reference_id: 'wrk_arcanea_demo',
      amount_total: 7900,
      currency: 'usd',
      metadata: {
        workspaceId: 'wrk_arcanea_demo',
        userId: 'user_author',
        offerId: 'cloud-studio',
      },
    },
  },
});
const timestamp = 1783210000;
const secret = 'whsec_test_secret';
const signature = createHmac('sha256', secret).update(`${timestamp}.${payload}`, 'utf8').digest('hex');
assert.equal(verifyStripeWebhookSignature(payload, `t=${timestamp},v1=${signature}`, secret, { nowSeconds: timestamp }).verified, true);

assert.equal(resolveBillingModeForOffer('cloud-creator'), 'subscription');
assert.equal(resolveBillingModeForOffer('foundry-pack'), 'payment');
const checkoutPlan = createStripeCheckoutSessionPlan({
  offerId: 'cloud-studio',
  workspaceId: 'wrk_arcanea_demo',
  userId: 'user_author',
  email: 'author@example.com',
  projectId: 'prj_luminous_archive',
  successUrl: '/checkout/done?session_id={CHECKOUT_SESSION_ID}',
  cancelUrl: '/checkout/cancelled',
  metadata: {
    campaign: 'founder-window',
  },
}, {
  AUTHOROS_DEMO_MODE: 'false',
  NEXT_PUBLIC_APP_URL: 'https://author.arcanea.ai',
  STRIPE_PRICE_CLOUD_STUDIO: 'price_cloud_studio_test',
});
assert.equal(checkoutPlan.mode, 'subscription');
assert.equal(checkoutPlan.priceId, 'price_cloud_studio_test');
assert.equal(checkoutPlan.successUrl, 'https://author.arcanea.ai/checkout/done?session_id={CHECKOUT_SESSION_ID}');
assert.equal(checkoutPlan.metadata.offerId, 'cloud-studio');
assert.equal(checkoutPlan.metadata.campaign, 'founder-window');
assert.equal(checkoutPlan.params.subscription_data.metadata.workspaceId, 'wrk_arcanea_demo');
const checkoutForm = createStripeFormParams(checkoutPlan.params);
assert.equal(checkoutForm.get('mode'), 'subscription');
assert.equal(checkoutForm.get('line_items[0][price]'), 'price_cloud_studio_test');
assert.equal(checkoutForm.get('line_items[0][quantity]'), '1');
assert.equal(checkoutForm.get('metadata[offerId]'), 'cloud-studio');
assert.equal(checkoutForm.get('metadata[workspaceId]'), 'wrk_arcanea_demo');
assert.equal(checkoutForm.get('subscription_data[metadata][workspaceId]'), 'wrk_arcanea_demo');
assert.equal(checkoutForm.get('allow_promotion_codes'), 'true');
assert.equal(sanitizeStripeCheckoutSessionPlan(checkoutPlan).userId, 'present');
assert.throws(
  () => createStripeCheckoutSessionPlan({ offerId: 'open-core', workspaceId: 'wrk_arcanea_demo' }, {}),
  /Open core is free/,
);
assert.throws(
  () => createStripeCheckoutSessionPlan({ offerId: 'cloud-creator', workspaceId: 'wrk_arcanea_demo' }, { AUTHOROS_DEMO_MODE: 'false' }),
  /concrete Stripe price id/,
);
const demoCheckout = await createDemoCheckoutClient({ sessionId: 'cs_demo_author' }).createCheckoutSession(checkoutPlan);
assert.equal(demoCheckout.id, 'cs_demo_author');
assert.equal(demoCheckout.url, 'https://checkout.stripe.com/c/pay/cs_demo_author');
let capturedStripeRequest = null;
const stripeClient = createStripeCheckoutClient({
  secretKey: 'sk_test_author',
  fetchImpl: async (url, options) => {
    capturedStripeRequest = {
      url,
      method: options.method,
      authorization: options.headers.authorization,
      contentType: options.headers['content-type'],
      form: new URLSearchParams(String(options.body)),
    };
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({
        id: 'cs_test_author',
        object: 'checkout.session',
        url: 'https://checkout.stripe.com/c/pay/cs_test_author',
        status: 'open',
        mode: 'subscription',
        livemode: false,
      }),
    };
  },
});
const stripeCheckout = await stripeClient.createCheckoutSession(checkoutPlan);
assert.equal(stripeCheckout.id, 'cs_test_author');
assert.equal(capturedStripeRequest.url, 'https://api.stripe.com/v1/checkout/sessions');
assert.equal(capturedStripeRequest.method, 'POST');
assert.equal(capturedStripeRequest.authorization, 'Bearer sk_test_author');
assert.equal(capturedStripeRequest.contentType, 'application/x-www-form-urlencoded');
assert.equal(capturedStripeRequest.form.get('client_reference_id'), 'wrk_arcanea_demo');
assert.equal(capturedStripeRequest.form.get('line_items[0][price]'), 'price_cloud_studio_test');
await assert.rejects(
  () => createUnconfiguredCheckoutClient({ reason: 'Checkout unavailable.' }).createCheckoutSession(checkoutPlan),
  /Checkout unavailable/,
);

const billingEvent = normalizeBillingEvent(JSON.parse(payload));
assert.equal(billingEvent.workspaceId, 'wrk_arcanea_demo');
assert.equal(billingEvent.offerId, 'cloud-studio');
assert.equal(billingEvent.stripeSubscriptionId, 'sub_test_author');

const mutation = createEntitlementMutationFromBillingEvent(billingEvent);
assert.equal(mutation.status, 'active');
assert.equal(mutation.entitlements.offerId, 'cloud-studio');
assert.equal(mutation.creditGrant.amountUsd, 40);

const grantLedger = createBillingLedgerEntryFromGrant(mutation.creditGrant);
assert.equal(grantLedger.taskType, 'credit_grant');
assert.equal(grantLedger.includedCreditUsd, 40);

const billingSnapshot = createBillingAccountSnapshot({
  workspaceId: 'wrk_arcanea_demo',
  entitlement: mutation,
  billingEvent,
});
assert.equal(billingSnapshot.plan, 'cloud-studio');
assert.equal(billingSnapshot.status, 'active');
assert.equal(billingSnapshot.stripeCustomerId, 'cus_test_author');
assert.equal(billingSnapshot.hasStripeCustomer, true);

const portalPlan = createStripeBillingPortalSessionPlan({
  stripeCustomerId: billingSnapshot.stripeCustomerId,
  workspaceId: 'wrk_arcanea_demo',
  userId: 'user_author',
  returnUrl: '/billing',
}, {
  NEXT_PUBLIC_APP_URL: 'https://author.arcanea.ai',
});
assert.equal(portalPlan.returnUrl, 'https://author.arcanea.ai/billing');
const portalForm = createStripeFormParams(portalPlan.params);
assert.equal(portalForm.get('customer'), 'cus_test_author');
assert.equal(portalForm.get('return_url'), 'https://author.arcanea.ai/billing');
assert.equal(sanitizeStripeBillingPortalSessionPlan(portalPlan).hasStripeCustomer, true);
assert.throws(
  () => createStripeBillingPortalSessionPlan({ workspaceId: 'wrk_arcanea_demo' }),
  /Stripe customer id/,
);
const demoPortal = await createDemoBillingPortalClient({ sessionId: 'bps_demo_author' }).createBillingPortalSession(portalPlan);
assert.equal(demoPortal.id, 'bps_demo_author');
assert.equal(demoPortal.url, 'https://billing.stripe.com/p/session/bps_demo_author');
let capturedPortalRequest = null;
const stripePortalClient = createStripeBillingPortalClient({
  secretKey: 'sk_test_author',
  fetchImpl: async (url, options) => {
    capturedPortalRequest = {
      url,
      method: options.method,
      authorization: options.headers.authorization,
      contentType: options.headers['content-type'],
      form: new URLSearchParams(String(options.body)),
    };
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({
        id: 'bps_test_author',
        object: 'billing_portal.session',
        url: 'https://billing.stripe.com/p/session/test_author',
        customer: 'cus_test_author',
        return_url: 'https://author.arcanea.ai/billing',
        livemode: false,
      }),
    };
  },
});
const stripePortal = await stripePortalClient.createBillingPortalSession(portalPlan);
assert.equal(stripePortal.id, 'bps_test_author');
assert.equal(capturedPortalRequest.url, 'https://api.stripe.com/v1/billing_portal/sessions');
assert.equal(capturedPortalRequest.method, 'POST');
assert.equal(capturedPortalRequest.authorization, 'Bearer sk_test_author');
assert.equal(capturedPortalRequest.contentType, 'application/x-www-form-urlencoded');
assert.equal(capturedPortalRequest.form.get('customer'), 'cus_test_author');
await assert.rejects(
  () => createUnconfiguredBillingPortalClient({ reason: 'Portal unavailable.' }).createBillingPortalSession(portalPlan),
  /Portal unavailable/,
);

const intake = createServiceIntake({
  workspaceId: 'wrk_arcanea_demo',
  userId: 'user_author',
  email: 'author@example.com',
  projectTitle: 'The Test Novel',
  goals: ['setup cockpit'],
  requestedServices: ['concierge-setup'],
});
assert.equal(intake.offerId, 'concierge-setup');
assert.equal(intake.goals.length, 1);

const demoBillingAdapter = createDemoBillingAdapter();
assert.equal(await demoBillingAdapter.recordBillingEvent(billingEvent), billingEvent.id);
assert.equal(await demoBillingAdapter.recordEntitlementMutation(mutation), mutation.id);
assert.equal(await demoBillingAdapter.recordCreditGrant(mutation.creditGrant), mutation.creditGrant.id);
assert.equal(await demoBillingAdapter.recordServiceIntake(intake), intake.id);
const demoLatestEntitlement = await demoBillingAdapter.getLatestEntitlement('wrk_arcanea_demo');
assert.equal(demoLatestEntitlement.offerId, 'cloud-studio');
assert.equal(demoLatestEntitlement.status, 'active');
const demoBillingStatus = await demoBillingAdapter.getBillingStatus('wrk_arcanea_demo');
assert.equal(demoBillingStatus.plan, 'cloud-studio');
assert.equal(demoBillingStatus.stripeCustomerId, 'cus_test_author');
assert.equal(demoBillingStatus.entitlements.offerId, 'cloud-studio');
assert.equal(demoBillingAdapter.state.billingEvents.length, 1);
assert.equal(demoBillingAdapter.state.entitlementMutations.length, 1);
assert.equal(demoBillingAdapter.state.creditGrants.length, 1);
assert.equal(demoBillingAdapter.state.serviceIntakes.length, 1);

const unconfiguredBillingAdapter = createUnconfiguredBillingAdapter({ reason: 'Billing persistence unavailable.' });
await assert.rejects(() => unconfiguredBillingAdapter.recordServiceIntake(intake), /Billing persistence unavailable/);
assert.equal(await unconfiguredBillingAdapter.getLatestEntitlement('wrk_arcanea_demo'), null);
assert.equal((await unconfiguredBillingAdapter.getBillingStatus('wrk_arcanea_demo')).plan, 'open-core');

const billingCalls = [];
const billingScopes = [];
const postgresBillingAdapter = createPostgresBillingAdapter({
  query: async (sql, params = []) => {
    billingCalls.push({ sql, params, scope: null });
    return { rows: [] };
  },
  withWorkspaceScope: async (workspaceId, operation) => {
    billingScopes.push(workspaceId);
    return operation(async (sql, params = []) => {
      billingCalls.push({ sql, params, scope: workspaceId });
      if (String(sql).includes('from author_billing_events')) {
        return {
          rows: [{
            id: billingEvent.id,
            workspace_id: billingEvent.workspaceId,
            provider: billingEvent.provider,
            provider_event_id: billingEvent.id,
            event_type: billingEvent.type,
            offer_id: billingEvent.offerId,
            stripe_customer_id: billingEvent.stripeCustomerId,
            stripe_subscription_id: billingEvent.stripeSubscriptionId,
            status: billingEvent.status,
            payload: billingEvent,
            created_at: billingEvent.createdAt,
          }],
        };
      }
      if (String(sql).includes('from author_entitlement_events')) {
        return {
          rows: [{
            id: mutation.id,
            workspace_id: mutation.workspaceId,
            user_id: mutation.userId,
            provider: mutation.provider,
            provider_event_id: mutation.providerEventId,
            offer_id: mutation.offerId,
            plan_name: mutation.planName,
            status: mutation.status,
            entitlements: mutation.entitlements,
            created_at: mutation.createdAt,
          }],
        };
      }
      return { rows: [] };
    });
  },
});
await postgresBillingAdapter.recordBillingEvent(billingEvent);
await postgresBillingAdapter.recordEntitlementMutation(mutation);
await postgresBillingAdapter.recordCreditGrant(mutation.creditGrant);
await postgresBillingAdapter.recordServiceIntake(intake);
const latestPostgresEntitlement = await postgresBillingAdapter.getLatestEntitlement('wrk_arcanea_demo');
assert.equal(latestPostgresEntitlement.offerId, 'cloud-studio');
assert.equal(latestPostgresEntitlement.entitlements.offerId, 'cloud-studio');
const latestPostgresBillingStatus = await postgresBillingAdapter.getBillingStatus('wrk_arcanea_demo');
assert.equal(latestPostgresBillingStatus.plan, 'cloud-studio');
assert.equal(latestPostgresBillingStatus.stripeCustomerId, 'cus_test_author');
assert.ok(billingScopes.every(scope => scope === 'wrk_arcanea_demo'));
assert.ok(billingCalls.some(call => call.sql.includes('insert into author_billing_events') && call.scope === 'wrk_arcanea_demo'));
assert.ok(billingCalls.some(call => call.sql.includes('insert into author_entitlement_events') && call.scope === 'wrk_arcanea_demo'));
assert.ok(billingCalls.some(call => call.sql.includes('insert into author_credit_grants') && call.scope === 'wrk_arcanea_demo'));
assert.ok(billingCalls.some(call => call.sql.includes('insert into author_service_intakes') && call.scope === 'wrk_arcanea_demo'));
assert.ok(billingCalls.some(call => call.sql.includes('from author_entitlement_events') && call.scope === 'wrk_arcanea_demo'));

const workspaceOptionalBillingEvent = {
  ...billingEvent,
  id: 'evt_workspace_optional',
  providerEventId: 'evt_workspace_optional',
  workspaceId: null,
};
await postgresBillingAdapter.recordBillingEvent(workspaceOptionalBillingEvent);
assert.ok(billingCalls.some(call => call.params[0] === 'evt_workspace_optional' && call.scope === null));

const migration = fs.readFileSync(path.resolve('packages/cloud/migrations/001_author_os_cloud.sql'), 'utf-8');
assert.ok(migration.includes('author_schema_migrations'));
assert.ok(migration.includes('author_workspaces'));
assert.ok(migration.includes('author_workspace_members_workspace_isolation'));
assert.ok(migration.includes('author_credit_ledger'));
assert.ok(migration.includes('author_billing_events'));
assert.ok(migration.includes('author_service_intakes'));
assert.ok(migration.includes('author_workflow_jobs'));
assert.ok(migration.includes('enable row level security'));
assert.ok(migration.includes("current_setting('app.current_workspace_id'"));
assert.ok(migration.includes('with check'));

const migrations = loadCloudMigrations({ migrationsDir: path.resolve('packages/cloud/migrations') });
assert.equal(migrations.length, 1);
assert.equal(migrations[0].version, AUTHOR_OS_CLOUD_MIGRATION_VERSION);
assert.match(migrations[0].checksum, /^[a-f0-9]{64}$/);

const migrationPlan = createCloudMigrationPlan({ migrations, appliedMigrations: [] });
assert.equal(migrationPlan.status, 'pending');
assert.equal(migrationPlan.pending.length, 1);

const currentMigrationPlan = createCloudMigrationPlan({
  migrations,
  appliedMigrations: [{ version: AUTHOR_OS_CLOUD_MIGRATION_VERSION, checksum: migrations[0].checksum }],
});
assert.equal(currentMigrationPlan.status, 'current');
assert.equal(currentMigrationPlan.pending.length, 0);

const mismatchPlan = createCloudMigrationPlan({
  migrations,
  appliedMigrations: [{ version: AUTHOR_OS_CLOUD_MIGRATION_VERSION, checksum: 'wrong' }],
});
assert.equal(mismatchPlan.status, 'checksum_mismatch');
assert.equal(mismatchPlan.checksumMismatches.length, 1);

const migrationCalls = [];
let appliedMigrationRows = [];
const migrationRunner = createCloudMigrationRunner({
  now: () => '2026-07-05T00:00:00.000Z',
  query: async (sql, params = []) => {
    migrationCalls.push({ sql, params });
    if (String(sql).startsWith('select version')) return { rows: appliedMigrationRows };
    if (String(sql).startsWith('insert into author_schema_migrations')) {
      appliedMigrationRows = [{
        version: params[0],
        checksum: params[1],
        description: params[2],
        applied_by: params[3],
        applied_at: params[4],
      }];
    }
    return { rows: [] };
  },
});
const dryMigrationRun = await migrationRunner.applyPendingMigrations({ migrations, dryRun: true });
assert.equal(dryMigrationRun.dryRun, true);
assert.equal(dryMigrationRun.plan.pending.length, 1);
const appliedMigrationRun = await migrationRunner.applyPendingMigrations({ migrations });
assert.equal(appliedMigrationRun.applied.length, 1);
assert.equal(appliedMigrationRun.finalPlan.status, 'current');
assert.ok(migrationCalls.some(call => call.sql === 'begin'));
assert.ok(migrationCalls.some(call => call.sql === 'commit'));
assert.ok(migrationCalls.some(call => String(call.sql).includes('author_schema_migrations')));
const idempotentMigrationRun = await migrationRunner.applyPendingMigrations({ migrations });
assert.equal(idempotentMigrationRun.applied.length, 0);
assert.equal(idempotentMigrationRun.finalPlan.status, 'current');

console.log('Cloud tests passed.');

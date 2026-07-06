import {
  buildCockpitViewModel,
  buildPackRegistry,
  buildProjectContext,
  canUseFeature,
  appendAuditArtifacts,
  createAgentRun,
  createCreditLedgerEntry,
  createEmptyProject,
  createExportRecord,
  createProjectFromManuscript,
  createPublishingReadinessReport,
  createRevisionSuggestion,
  createSceneRecord,
  createStarterProject,
  createEntitlementSnapshot as createCoreEntitlementSnapshot,
  decideSuggestion as decideCoreSuggestion,
  exportBookMarkdown,
  generateCharacterBoard,
  getOfferById,
  installPackIntoProject,
  normalizeProject,
  runContinuityCheck,
  sampleProject,
  searchManuscript,
} from '../../core/src/index.js';
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';

function readHeader(headers, name) {
  if (!headers) return null;
  if (typeof headers.get === 'function') return headers.get(name) || headers.get(name.toLowerCase()) || null;
  return headers[name] || headers[name.toLowerCase()] || null;
}

function readFirstHeader(headers, names = []) {
  for (const name of names) {
    const value = readHeader(headers, name);
    if (value) return value;
  }
  return null;
}

function splitList(value, fallback = []) {
  if (!value) return fallback;
  return String(value).split(',').map(item => item.trim()).filter(Boolean);
}

export function isHostedProductionTarget(env = {}) {
  return [
    env.VERCEL_TARGET_ENV,
    env.VERCEL_ENV,
    env.AUTHOROS_DEPLOYMENT_ENV,
  ].some(value => String(value || '').toLowerCase() === 'production');
}

export function isAuthorOsDemoMode(env = {}) {
  if (isHostedProductionTarget(env)) return false;
  return String(env.AUTHOROS_DEMO_MODE ?? 'true').toLowerCase() !== 'false';
}

export const AUTHOR_OS_MCP_SCOPES = Object.freeze([
  'authoros:read',
  'authoros:write',
  'authoros:agents',
  'authoros:export',
]);

function isLocalHostname(hostname) {
  return ['localhost', '127.0.0.1', '::1'].includes(hostname);
}

function normalizeHttpsOrLocalOrigin(value) {
  if (!value) return null;
  try {
    const url = new URL(String(value).startsWith('http') ? String(value) : `https://${value}`);
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && isLocalHostname(url.hostname))) {
      return null;
    }
    return url.origin;
  } catch {
    return null;
  }
}

function resolveRequestOrigin(requestUrl) {
  if (!requestUrl) return null;
  return normalizeHttpsOrLocalOrigin(requestUrl);
}

function resolvePublicOrigin(env = {}, requestUrl = null) {
  return normalizeHttpsOrLocalOrigin(env.NEXT_PUBLIC_APP_URL)
    || normalizeHttpsOrLocalOrigin(env.AUTHOROS_PUBLIC_URL)
    || normalizeHttpsOrLocalOrigin(env.VERCEL_PROJECT_PRODUCTION_URL)
    || resolveRequestOrigin(requestUrl)
    || 'http://localhost:3000';
}

function normalizeAbsoluteUrls(values = []) {
  return values
    .map(value => normalizeHttpsOrLocalOrigin(value))
    .filter(Boolean);
}

function quoteHeaderValue(value) {
  return String(value || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

export function createMcpProtectedResourceMetadata(input = {}) {
  const env = input.env || {};
  const origin = resolvePublicOrigin(env, input.requestUrl);
  const resourcePath = input.resourcePath || '/api/mcp';
  const resource = new URL(resourcePath, origin).toString();
  const metadataUrl = new URL('/.well-known/oauth-protected-resource', origin).toString();
  const configuredAuthorizationServers = normalizeAbsoluteUrls(splitList(
    env.AUTHOROS_MCP_AUTHORIZATION_SERVER_URL
      || env.AUTHOROS_AUTHORIZATION_SERVER_URL
      || env.OAUTH_AUTHORIZATION_SERVER_URL,
  ));
  const authorizationServers = configuredAuthorizationServers.length
    ? configuredAuthorizationServers
    : [origin];
  const scopes = Array.from(new Set(input.scopes?.length ? input.scopes : AUTHOR_OS_MCP_SCOPES));

  return {
    resource,
    protected_resource: resource,
    authorization_servers: authorizationServers,
    scopes_supported: scopes,
    bearer_methods_supported: ['header'],
    resource_documentation: new URL('/setup', origin).toString(),
    resource_policy_uri: new URL('/api/system/setup-contract', origin).toString(),
    mcp_endpoint: resource,
    mcp_metadata_url: metadataUrl,
    authorization_server_status: configuredAuthorizationServers.length ? 'configured' : 'fallback_origin',
    mcp: {
      transport: 'http-json',
      endpoint: resource,
      manifest: resource,
      required_scopes: scopes,
    },
  };
}

export function createMcpWwwAuthenticateHeader(input = {}) {
  const metadata = createMcpProtectedResourceMetadata(input);
  const scopes = Array.from(new Set(input.scopes?.length ? input.scopes : AUTHOR_OS_MCP_SCOPES));
  const parts = [
    'Bearer realm="AuthorOS MCP"',
    `resource_metadata="${quoteHeaderValue(metadata.mcp_metadata_url)}"`,
    `scope="${quoteHeaderValue(scopes.join(' '))}"`,
  ];
  if (input.error) parts.push(`error="${quoteHeaderValue(input.error)}"`);
  if (input.errorDescription) parts.push(`error_description="${quoteHeaderValue(input.errorDescription)}"`);
  return parts.join(', ');
}

export function createHostedRequestContext(input = {}) {
  const headers = input.headers || input.request?.headers || {};
  const env = input.env || {};
  const auth = input.auth || {};
  const productionTarget = isHostedProductionTarget(env);
  const requireAuth = productionTarget || String(env.AUTHOROS_REQUIRE_AUTH || '').toLowerCase() === 'true';
  const allowTrustedHeaderAuth = String(env.AUTHOROS_ALLOW_TRUSTED_AUTH_HEADERS || '').toLowerCase() === 'true';
  const demoMode = !requireAuth && isAuthorOsDemoMode(env);
  const canUseHeaderIdentity = demoMode || !requireAuth || allowTrustedHeaderAuth;
  const headerUserId = canUseHeaderIdentity ? readFirstHeader(headers, [
    'x-authoros-user-id',
    'x-author-os-user-id',
    'x-clerk-user-id',
    'x-user-id',
  ]) : null;
  const headerWorkspaceId = canUseHeaderIdentity ? readFirstHeader(headers, [
    'x-authoros-workspace-id',
    'x-author-os-workspace-id',
    'x-clerk-org-id',
    'x-organization-id',
  ]) : null;
  const headerPlan = canUseHeaderIdentity ? readFirstHeader(headers, [
    'x-authoros-plan',
    'x-author-os-plan',
    'x-plan-id',
  ]) : null;
  const headerRoles = canUseHeaderIdentity ? splitList(readFirstHeader(headers, [
    'x-authoros-roles',
    'x-author-os-roles',
    'x-authoros-role',
    'x-author-os-role',
    'x-role',
  ])) : [];
  const authRoles = splitList(auth.roles);
  const userId = auth.userId || headerUserId || (demoMode ? env.AUTHOROS_DEMO_USER_ID || 'demo-user' : null);
  const workspaceId = auth.workspaceId || headerWorkspaceId || (demoMode ? env.AUTHOROS_DEMO_WORKSPACE_ID || 'wrk_arcanea_demo' : null);
  const plan = auth.plan || headerPlan || (demoMode
    ? env.AUTHOROS_DEMO_PLAN || 'cloud-studio'
    : env.AUTHOROS_DEFAULT_PLAN || 'open-core');
  const roles = authRoles.length ? authRoles : headerRoles.length ? headerRoles : demoMode ? ['owner'] : splitList(env.AUTHOROS_DEFAULT_AUTH_ROLE);
  const authVerified = Boolean(auth.verified) || Boolean(allowTrustedHeaderAuth && headerUserId && headerWorkspaceId);
  const authSource = auth.source || (auth.verified
    ? 'verified-auth'
    : authVerified && allowTrustedHeaderAuth
    ? 'trusted-header'
    : headerUserId
      ? 'header'
      : demoMode
        ? 'demo'
        : 'missing');

  if (requireAuth && !authVerified) {
    const error = new Error('Hosted AuthorOS requires verified authentication before trusting tenant context.');
    error.code = 'AUTH_REQUIRED';
    error.status = 401;
    throw error;
  }

  if (requireAuth && (!userId || !workspaceId)) {
    const error = new Error('Hosted AuthorOS requires an authenticated user and workspace context.');
    error.code = 'AUTH_REQUIRED';
    error.status = 401;
    throw error;
  }

  return {
    mode: demoMode ? 'demo' : 'production',
    authProvider: auth.authProvider || env.AUTHOROS_AUTH_PROVIDER || (demoMode ? 'header-demo' : 'external-auth-required'),
    authSource,
    authVerified,
    userId,
    workspaceId,
    plan,
    roles,
    projectId: input.projectId || null,
    requestId: readHeader(headers, 'x-request-id') || readHeader(headers, 'x-vercel-id') || `req_${Date.now().toString(36)}`,
  };
}

export function createAccessDecision(context, project, options = {}) {
  const graph = normalizeProject(project);
  const requiredFeature = options.requiredFeature || 'hosted-cockpit';
  const requiredRole = options.requiredRole || 'viewer';
  const entitlements = createEntitlementSnapshot(context.plan || graph.workspace.plan);
  const roleRank = { viewer: 1, agent: 2, editor: 3, owner: 4, admin: 5 };
  const maxRole = Math.max(0, ...(context.roles || []).map(role => roleRank[role] || 0));
  const neededRole = roleRank[requiredRole] || 1;
  const workspaceMatches = Boolean(context.workspaceId && graph.workspace.id === context.workspaceId);
  const featureAllowed = requiredFeature ? canUseFeature(entitlements, requiredFeature) : true;
  const allowed = workspaceMatches && featureAllowed && maxRole >= neededRole;

  return {
    allowed,
    reason: allowed
      ? 'allowed'
      : !workspaceMatches
        ? 'workspace_mismatch'
        : !featureAllowed
          ? 'entitlement_required'
          : 'role_required',
    workspaceMatches,
    featureAllowed,
    maxRole,
    neededRole,
    entitlements,
  };
}

export function assertProjectAccess(context, project, options = {}) {
  const decision = createAccessDecision(context, project, options);
  if (decision.allowed) return decision;
  const error = new Error(`Project access denied: ${decision.reason}`);
  error.code = decision.reason.toUpperCase();
  error.status = decision.reason === 'entitlement_required' ? 402 : 403;
  error.decision = decision;
  throw error;
}

export function createWorkspaceAccessDecision(context, options = {}) {
  const requiredFeature = options.requiredFeature || 'hosted-cockpit';
  const requiredRole = options.requiredRole || 'editor';
  const entitlements = createEntitlementSnapshot(context.plan || 'open-core');
  const roleRank = { viewer: 1, agent: 2, editor: 3, owner: 4, admin: 5 };
  const maxRole = Math.max(0, ...(context.roles || []).map(role => roleRank[role] || 0));
  const neededRole = roleRank[requiredRole] || 3;
  const featureAllowed = requiredFeature ? canUseFeature(entitlements, requiredFeature) : true;
  const workspacePresent = Boolean(context.workspaceId);
  const allowed = workspacePresent && featureAllowed && maxRole >= neededRole;

  return {
    allowed,
    reason: allowed
      ? 'allowed'
      : !workspacePresent
        ? 'workspace_required'
        : !featureAllowed
          ? 'entitlement_required'
          : 'role_required',
    workspacePresent,
    featureAllowed,
    maxRole,
    neededRole,
    entitlements,
  };
}

export function assertWorkspaceAccess(context, options = {}) {
  const decision = createWorkspaceAccessDecision(context, options);
  if (decision.allowed) return decision;
  const error = new Error(`Workspace access denied: ${decision.reason}`);
  error.code = decision.reason.toUpperCase();
  error.status = decision.reason === 'entitlement_required' ? 402 : 403;
  error.decision = decision;
  throw error;
}

export function createPackInstallAccessDecision(context, options = {}) {
  const entitlements = options.entitlements || createCoreEntitlementSnapshot(context.plan || options.plan || 'open-core');
  const acceptedFeatures = options.acceptedFeatures || [
    'marketplace',
    'marketplacePurchases',
    'premium-packs',
    'foundry-pack',
    'pack:authoros-foundry-pack',
  ];
  const matchedFeatures = acceptedFeatures.filter(feature => canUseFeature(entitlements, feature));
  const allowed = matchedFeatures.length > 0;
  return {
    allowed,
    reason: allowed ? 'allowed' : 'pack_entitlement_required',
    requiredAnyFeature: acceptedFeatures,
    matchedFeatures,
    featureAllowed: allowed,
    entitlements,
  };
}

export function assertPackInstallAccess(context, options = {}) {
  const decision = createPackInstallAccessDecision(context, options);
  if (decision.allowed) return decision;
  const error = new Error('Pack install requires cloud marketplace access or a premium pack entitlement.');
  error.code = 'PACK_ENTITLEMENT_REQUIRED';
  error.status = 402;
  error.decision = decision;
  throw error;
}

function createWorkspaceScopeError() {
  const error = new Error('Postgres project access requires a workspace scope for tenant isolation.');
  error.code = 'WORKSPACE_SCOPE_REQUIRED';
  error.status = 500;
  return error;
}

function resolveHighestWorkspaceRole(roles = []) {
  const roleRank = { viewer: 1, agent: 2, editor: 3, owner: 4, admin: 5 };
  const normalized = splitList(roles).filter(role => roleRank[role]);
  if (!normalized.length) return 'owner';
  return normalized.sort((a, b) => roleRank[b] - roleRank[a])[0];
}

function createStableId(prefix = 'id') {
  return `${prefix}_${randomUUID().replace(/-/g, '').slice(0, 14)}`;
}

function uniqueList(value = []) {
  return [...new Set((Array.isArray(value) ? value : []).filter(Boolean))];
}

function safePathSegment(value, fallback = 'asset') {
  const segment = String(value || fallback)
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 96);
  return segment || fallback;
}

function decodeBase64Asset(input) {
  const value = String(input || '').trim();
  if (!value) return null;
  const base64 = value.replace(/^data:[^;]+;base64,/, '');
  return Buffer.from(base64, 'base64');
}

function createAssetRecord(input = {}) {
  const assetId = input.id || createStableId('asset');
  const now = input.now || new Date().toISOString();
  const type = input.type || input.kind || (input.contentType ? String(input.contentType).split('/')[0] : 'asset');
  const title = input.title || input.filename || assetId;
  const provenance = {
    source: input.source || input.blobUrl || input.path || null,
    storage: input.storage || 'metadata-only',
    access: input.access || 'private',
    capturedBy: 'author-os-hosted-asset-intake',
    originalFilename: input.filename || null,
    contentType: input.contentType || null,
    byteSize: Number(input.byteSize || 0),
    ...(input.provenance || {}),
  };
  return {
    id: assetId,
    type,
    title,
    source: input.source || input.blobUrl || input.path || `author-os://${input.projectId || 'project'}/assets/${assetId}`,
    blobUrl: input.blobUrl || null,
    path: input.path || null,
    rights: input.rights || 'unknown',
    usedIn: uniqueList(input.usedIn),
    tags: uniqueList(input.tags),
    variants: Array.isArray(input.variants) ? input.variants : [],
    provenance,
    contentType: input.contentType || null,
    access: input.access || 'private',
    byteSize: Number(input.byteSize || 0),
    createdBy: input.createdBy || null,
    createdAt: input.createdAt || now,
    updatedAt: input.updatedAt || now,
  };
}

async function syncPostgresProjectArtifacts(scopedQuery, graph, options = {}) {
  const workspaceId = options.workspaceId || graph.workspace.id;
  const projectId = graph.project.id;

  for (const asset of graph.assets || []) {
    await scopedQuery(
      [
        'insert into author_assets',
        '(id, workspace_id, project_id, type, title, blob_url, rights, provenance, used_in)',
        'values ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
        'on conflict (id) do update set',
        'type = excluded.type, title = excluded.title, blob_url = excluded.blob_url,',
        'rights = excluded.rights, provenance = excluded.provenance, used_in = excluded.used_in',
      ].join(' '),
      [
        asset.id,
        workspaceId,
        projectId,
        asset.type || 'asset',
        asset.title || asset.id,
        asset.blobUrl || asset.blob_url || asset.source || asset.path || `author-os://${projectId}/assets/${asset.id}`,
        asset.rights || 'unknown',
        asset.provenance || { source: asset.source || null, variants: asset.variants || [] },
        asset.usedIn || asset.used_in || [],
      ],
    );
  }

  for (const run of graph.agentRuns || []) {
    await scopedQuery(
      [
        'insert into author_agent_runs',
        '(id, workspace_id, project_id, task_id, task_type, status, route_id, model, gateway_tags, prompt_scope, approval_state, output, created_at, updated_at)',
        'values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)',
        'on conflict (id) do update set',
        'task_id = excluded.task_id, task_type = excluded.task_type, status = excluded.status,',
        'route_id = excluded.route_id, model = excluded.model, gateway_tags = excluded.gateway_tags,',
        'prompt_scope = excluded.prompt_scope, approval_state = excluded.approval_state,',
        'output = excluded.output, updated_at = excluded.updated_at',
      ].join(' '),
      [
        run.id,
        workspaceId,
        projectId,
        run.taskId || null,
        run.taskType || 'operations',
        run.status || 'queued',
        run.routeId || 'operations',
        run.model || 'gateway:dynamic',
        run.gatewayTags || [],
        run.promptScope || [],
        run.approvalState || 'not_required',
        run.output || null,
        run.createdAt || new Date().toISOString(),
        run.updatedAt || run.createdAt || new Date().toISOString(),
      ],
    );
  }

  for (const workflow of options.workflowJobs || []) {
    await scopedQuery(
      [
        'insert into author_workflow_jobs',
        '(id, workspace_id, project_id, run_id, runtime, purpose, status, steps, human_pause_points, observable, durable, created_at, updated_at)',
        'values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, now(), now())',
        'on conflict (id) do update set',
        'run_id = excluded.run_id, runtime = excluded.runtime, purpose = excluded.purpose,',
        'status = excluded.status, steps = excluded.steps, human_pause_points = excluded.human_pause_points,',
        'observable = excluded.observable, durable = excluded.durable, updated_at = now()',
      ].join(' '),
      [
        workflow.id,
        workspaceId,
        projectId,
        workflow.runId || workflow.run_id || null,
        workflow.runtime || 'vercel-workflows',
        workflow.purpose || 'hosted-author-workflow',
        workflow.status || 'queued',
        workflow.steps || [],
        workflow.humanPausePoints || workflow.human_pause_points || [],
        workflow.observable !== false,
        workflow.durable !== false,
      ],
    );
  }

  for (const entry of graph.creditLedger || []) {
    await scopedQuery(
      [
        'insert into author_credit_ledger',
        '(id, workspace_id, project_id, run_id, source, provider, model, task_type, input_tokens, output_tokens, estimated_cost_usd, included_credit_usd, billable_usd, created_at)',
        'values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)',
        'on conflict (id) do update set',
        'run_id = excluded.run_id, source = excluded.source, provider = excluded.provider,',
        'model = excluded.model, task_type = excluded.task_type, input_tokens = excluded.input_tokens,',
        'output_tokens = excluded.output_tokens, estimated_cost_usd = excluded.estimated_cost_usd,',
        'included_credit_usd = excluded.included_credit_usd, billable_usd = excluded.billable_usd',
      ].join(' '),
      [
        entry.id,
        workspaceId,
        entry.projectId || projectId,
        entry.runId || null,
        entry.source || 'managed-gateway',
        entry.provider || 'vercel-ai-gateway',
        entry.model || 'gateway:dynamic',
        entry.taskType || 'operations',
        Number(entry.inputTokens || 0),
        Number(entry.outputTokens || 0),
        Number(entry.estimatedCostUsd || 0),
        Number(entry.includedCreditUsd || 0),
        Number(entry.billableUsd || 0),
        entry.createdAt || new Date().toISOString(),
      ],
    );
  }

  for (const suggestion of graph.suggestions || []) {
    await scopedQuery(
      [
        'insert into author_suggestions',
        '(id, workspace_id, project_id, run_id, kind, target_type, target_id, title, instruction, proposal, evidence, approval_state, created_at, updated_at)',
        'values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)',
        'on conflict (id) do update set',
        'run_id = excluded.run_id, kind = excluded.kind, target_type = excluded.target_type,',
        'target_id = excluded.target_id, title = excluded.title, instruction = excluded.instruction,',
        'proposal = excluded.proposal, evidence = excluded.evidence, approval_state = excluded.approval_state,',
        'updated_at = excluded.updated_at',
      ].join(' '),
      [
        suggestion.id,
        workspaceId,
        projectId,
        suggestion.runId || null,
        suggestion.kind || 'revision',
        suggestion.targetType || 'Project',
        suggestion.targetId || suggestion.sceneId || null,
        suggestion.title || 'Human-reviewable suggestion',
        suggestion.instruction || '',
        suggestion.proposal || '',
        suggestion.evidence || [],
        suggestion.approvalState || 'requested',
        suggestion.createdAt || new Date().toISOString(),
        suggestion.updatedAt || suggestion.createdAt || new Date().toISOString(),
      ],
    );
  }

  for (const approval of graph.approvals || []) {
    await scopedQuery(
      [
        'insert into author_approvals',
        '(id, workspace_id, project_id, target_type, target_id, decision, approver_id, notes, conditions, created_at)',
        'values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)',
        'on conflict (id) do update set',
        'decision = excluded.decision, approver_id = excluded.approver_id, notes = excluded.notes,',
        'conditions = excluded.conditions',
      ].join(' '),
      [
        approval.id,
        workspaceId,
        projectId,
        approval.targetType || 'Suggestion',
        approval.targetId,
        approval.decision || 'pending',
        approval.approverId || 'hosted-human',
        approval.notes || '',
        approval.conditions || [],
        approval.createdAt || new Date().toISOString(),
      ],
    );
  }

  for (const exportRecord of graph.exports || []) {
    await scopedQuery(
      [
        'insert into author_exports',
        '(id, workspace_id, project_id, format, status, path, approval_state, source_run_id, checksum, created_at, updated_at)',
        'values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)',
        'on conflict (id) do update set',
        'format = excluded.format, status = excluded.status, path = excluded.path,',
        'approval_state = excluded.approval_state, source_run_id = excluded.source_run_id,',
        'checksum = excluded.checksum, updated_at = excluded.updated_at',
      ].join(' '),
      [
        exportRecord.id,
        workspaceId,
        exportRecord.projectId || projectId,
        exportRecord.format || 'markdown',
        exportRecord.status || 'queued',
        exportRecord.path || null,
        exportRecord.approvalState || 'not_required',
        exportRecord.sourceRunId || null,
        exportRecord.checksum || null,
        exportRecord.createdAt || new Date().toISOString(),
        exportRecord.updatedAt || exportRecord.createdAt || new Date().toISOString(),
      ],
    );
  }
}

export function createPostgresProjectAdapter({ query, withWorkspaceScope, requireWorkspaceScope = true }) {
  if (typeof query !== 'function') throw new Error('createPostgresProjectAdapter requires a query function.');

  async function runInWorkspaceScope(workspaceId, operation) {
    if (!workspaceId && requireWorkspaceScope) throw createWorkspaceScopeError();
    if (workspaceId && typeof withWorkspaceScope === 'function') {
      return withWorkspaceScope(workspaceId, operation);
    }
    if (!workspaceId) return operation(query);

    await query("select set_config('app.current_workspace_id', $1, false)", [workspaceId]);
    try {
      return await operation(query);
    } finally {
      await query("select set_config('app.current_workspace_id', '', false)", []);
    }
  }

  return {
    async listProjects(options = {}) {
      const workspaceId = options.workspaceId || options.context?.workspaceId || null;
      const limit = Math.max(1, Math.min(Number(options.limit || 50), 100));
      const rows = await runInWorkspaceScope(workspaceId, scopedQuery => (
        workspaceId
          ? scopedQuery(
              'select graph from author_projects where workspace_id = $1 order by updated_at desc limit $2',
              [workspaceId, limit],
            )
          : scopedQuery('select graph from author_projects order by updated_at desc limit $1', [limit])
      ));
      const rawRows = Array.isArray(rows) ? rows : rows?.rows || [];
      return rawRows.map(row => normalizeProject(row.graph || row));
    },
    async loadProject(projectId, options = {}) {
      const workspaceId = options.workspaceId || options.context?.workspaceId || null;
      const rows = await runInWorkspaceScope(workspaceId, scopedQuery => (
        workspaceId
          ? scopedQuery('select graph from author_projects where id = $1 and workspace_id = $2 limit 1', [projectId, workspaceId])
          : scopedQuery('select graph from author_projects where id = $1 limit 1', [projectId])
      ));
      const graph = Array.isArray(rows) ? rows[0]?.graph : rows?.rows?.[0]?.graph;
      return graph ? normalizeProject(graph) : null;
    },
    async saveProject(project, options = {}) {
      const graph = normalizeProject(project);
      const workspaceId = options.workspaceId || graph.workspace.id;
      const context = options.context || {};
      await runInWorkspaceScope(workspaceId, async scopedQuery => {
        await scopedQuery(
          [
            'insert into author_workspaces (id, name, plan, owner_user_id, updated_at)',
            'values ($1, $2, $3, $4, now())',
            'on conflict (id) do update set',
            'name = excluded.name,',
            'plan = excluded.plan,',
            'updated_at = now()',
          ].join(' '),
          [
            workspaceId,
            graph.workspace.name || 'Author Workspace',
            context.plan || graph.workspace.plan || 'open-core',
            context.userId || options.ownerUserId || 'system',
          ],
        );

        if (context.userId) {
          await scopedQuery(
            [
              'insert into author_workspace_members (workspace_id, user_id, role)',
              'values ($1, $2, $3)',
              'on conflict (workspace_id, user_id) do update set role = excluded.role',
            ].join(' '),
            [workspaceId, context.userId, resolveHighestWorkspaceRole(context.roles)],
          );
        }

        await scopedQuery(
          [
            'insert into author_projects (id, workspace_id, title, stage, graph, updated_at)',
            'values ($1, $2, $3, $4, $5, now())',
            'on conflict (id) do update set',
            'workspace_id = $2, title = $3, stage = $4, graph = $5, updated_at = now()',
          ].join(' '),
          [graph.project.id, workspaceId, graph.project.title, graph.project.stage, graph],
        );

        await syncPostgresProjectArtifacts(scopedQuery, graph, {
          ...options,
          workspaceId,
          context,
        });
      });
      return graph.project.id;
    },
  };
}

export function createUnconfiguredProjectAdapter(input = {}) {
  const reason = input.reason || 'Production project adapter is not configured.';
  async function fail() {
    const error = new Error(reason);
    error.code = 'PROJECT_ADAPTER_NOT_CONFIGURED';
    error.status = 503;
    throw error;
  }
  return {
    async listProjects() {
      return fail();
    },
    async loadProject() {
      return fail();
    },
    async saveProject() {
      return fail();
    },
  };
}

export function createDemoProjectAdapter(input = {}) {
  const seedProjects = input.projects || [input.project || sampleProject];
  const projects = new Map(seedProjects.map(project => {
    const graph = normalizeProject(project);
    return [graph.project.id, graph];
  }));

  function firstProject() {
    return projects.values().next().value || normalizeProject(sampleProject);
  }

  return {
    async listProjects(options = {}) {
      const workspaceId = options.workspaceId || options.context?.workspaceId || null;
      return [...projects.values()].filter(project => !workspaceId || project.workspace.id === workspaceId);
    },
    async loadProject(projectId) {
      if (!projectId || projectId === 'demo') return firstProject();
      if (projects.has(projectId)) {
        return projects.get(projectId);
      }
      return null;
    },
    async saveProject(project) {
      const graph = normalizeProject(project);
      projects.set(graph.project.id, graph);
      return graph.project.id;
    },
  };
}

export function createUnconfiguredBillingAdapter(input = {}) {
  const reason = input.reason || 'Production billing adapter is not configured.';
  async function fail() {
    const error = new Error(reason);
    error.code = 'BILLING_ADAPTER_NOT_CONFIGURED';
    error.status = 503;
    throw error;
  }
  return {
    async recordBillingEvent() {
      return fail();
    },
    async recordEntitlementMutation() {
      return fail();
    },
    async recordCreditGrant() {
      return fail();
    },
    async recordServiceIntake() {
      return fail();
    },
    async getLatestEntitlement() {
      return null;
    },
    async getBillingStatus(workspaceId, input = {}) {
      return createBillingAccountSnapshot({
        workspaceId,
        fallbackPlan: input.fallbackPlan || 'open-core',
      });
    },
  };
}

export function createDemoBillingAdapter(input = {}) {
  const state = input.state || {
    billingEvents: [],
    entitlementMutations: [],
    creditGrants: [],
    serviceIntakes: [],
  };
  return {
    state,
    async recordBillingEvent(event) {
      const id = event.id || `${event.provider || 'stripe'}_${event.providerEventId || Date.now().toString(36)}`;
      state.billingEvents = state.billingEvents.filter(item => item.id !== id);
      state.billingEvents.push({ ...event, id });
      return id;
    },
    async recordEntitlementMutation(mutation) {
      state.entitlementMutations = state.entitlementMutations.filter(item => item.id !== mutation.id);
      state.entitlementMutations.push(mutation);
      return mutation.id;
    },
    async recordCreditGrant(grant) {
      if (!grant) return null;
      state.creditGrants = state.creditGrants.filter(item => item.id !== grant.id);
      state.creditGrants.push(grant);
      return grant.id;
    },
    async recordServiceIntake(intake) {
      state.serviceIntakes = state.serviceIntakes.filter(item => item.id !== intake.id);
      state.serviceIntakes.push(intake);
      return intake.id;
    },
    async getLatestEntitlement(workspaceId) {
      const matches = state.entitlementMutations
        .filter(item => !workspaceId || item.workspaceId === workspaceId)
        .sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || '')));
      return matches.at(-1) || null;
    },
    async getBillingStatus(workspaceId, input = {}) {
      const entitlement = await this.getLatestEntitlement(workspaceId);
      const billingEvents = state.billingEvents
        .filter(item => !workspaceId || item.workspaceId === workspaceId)
        .sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || '')));
      return createBillingAccountSnapshot({
        workspaceId,
        entitlement,
        billingEvent: billingEvents.at(-1) || null,
        fallbackPlan: input.fallbackPlan || 'open-core',
      });
    },
  };
}

export function createUnconfiguredAssetAdapter(input = {}) {
  const reason = input.reason || 'Production asset storage is not configured.';
  async function fail() {
    const error = new Error(reason);
    error.code = 'ASSET_STORAGE_NOT_CONFIGURED';
    error.status = 503;
    throw error;
  }
  return {
    async uploadAsset() {
      return fail();
    },
    async deleteAsset() {
      return fail();
    },
  };
}

export function createDemoAssetAdapter(input = {}) {
  const state = input.state || { assets: [] };
  return {
    state,
    async uploadAsset({ pathname, body, contentType, access = 'private' }) {
      const byteSize = typeof body?.byteLength === 'number' ? body.byteLength : Buffer.byteLength(String(body || ''));
      const blob = {
        url: `demo-blob://${pathname}`,
        pathname,
        contentType: contentType || 'application/octet-stream',
        access,
        byteSize,
      };
      state.assets = state.assets.filter(item => item.pathname !== pathname);
      state.assets.push(blob);
      return blob;
    },
    async deleteAsset(pathname) {
      const before = state.assets.length;
      state.assets = state.assets.filter(item => item.pathname !== pathname);
      return { deleted: state.assets.length !== before };
    },
  };
}

export function createHostedAssetService({
  projectAdapter,
  assetAdapter = null,
  now = () => new Date().toISOString(),
  maxUploadBytes = 10 * 1024 * 1024,
} = {}) {
  if (!projectAdapter?.loadProject) throw new Error('createHostedAssetService requires a projectAdapter with loadProject(projectId).');

  async function loadForAssets(projectId, context, options = {}) {
    const project = await projectAdapter.loadProject(projectId, { ...options, workspaceId: context.workspaceId, context });
    if (!project) {
      const error = new Error(`Project not found: ${projectId}`);
      error.code = 'PROJECT_NOT_FOUND';
      error.status = 404;
      throw error;
    }
    const graph = normalizeProject(project);
    const access = assertProjectAccess(context, graph, {
      requiredRole: options.requiredRole || 'viewer',
      requiredFeature: 'hosted-cockpit',
    });
    return { project: graph, access };
  }

  async function save(project, context, options = {}) {
    if (typeof projectAdapter.saveProject === 'function') {
      await projectAdapter.saveProject(project, { ...options, workspaceId: context.workspaceId, context });
    }
  }

  return {
    async listAssets(projectId, context, input = {}) {
      const { project, access } = await loadForAssets(projectId, context, { requiredRole: input.requiredRole || 'viewer' });
      const limit = Math.max(1, Math.min(Number(input.limit || 100), 250));
      const type = input.type ? String(input.type).toLowerCase() : null;
      const assets = project.assets
        .filter(asset => !type || String(asset.type || '').toLowerCase() === type)
        .slice(0, limit);
      return {
        projectId,
        generatedAt: now(),
        tenant: sanitizeTenantContext(context),
        access,
        assets,
        count: assets.length,
      };
    },

    async createAsset(projectId, context, input = {}) {
      const { project, access } = await loadForAssets(projectId, context, { requiredRole: input.requiredRole || 'editor' });
      const assetId = input.id || createStableId('asset');
      const contentType = input.contentType || input.mimeType || null;
      const filename = input.filename || input.title || `${assetId}${contentType?.includes('png') ? '.png' : ''}`;
      const usedIn = uniqueList(input.usedIn || input.usedInIds || input.sourceIds);
      const tags = uniqueList(input.tags);
      const accessMode = input.access === 'public' ? 'public' : 'private';
      const body = decodeBase64Asset(input.contentBase64 || input.base64);
      let uploaded = null;
      let storage = input.storage || 'metadata-only';

      if (body) {
        if (body.byteLength > maxUploadBytes) {
          const error = new Error(`Asset upload exceeds ${maxUploadBytes} bytes.`);
          error.code = 'ASSET_UPLOAD_TOO_LARGE';
          error.status = 413;
          throw error;
        }
        if (!assetAdapter?.uploadAsset) {
          const error = new Error('Asset upload requires a configured asset adapter.');
          error.code = 'ASSET_STORAGE_NOT_CONFIGURED';
          error.status = 503;
          throw error;
        }
        const pathname = [
          safePathSegment(context.workspaceId, 'workspace'),
          safePathSegment(project.project.id, 'project'),
          'assets',
          safePathSegment(assetId, 'asset'),
          safePathSegment(filename, 'upload.bin'),
        ].join('/');
        uploaded = await assetAdapter.uploadAsset({
          pathname,
          body,
          contentType: contentType || 'application/octet-stream',
          access: accessMode,
        });
        storage = uploaded.url?.startsWith('demo-blob://') ? 'demo-blob' : 'vercel-blob';
      }

      const asset = createAssetRecord({
        ...input,
        id: assetId,
        projectId,
        filename,
        contentType: contentType || uploaded?.contentType || null,
        access: accessMode,
        rights: input.rights || (body ? 'user-provided' : 'unknown'),
        source: input.source || uploaded?.url || uploaded?.source || null,
        blobUrl: uploaded?.url || uploaded?.source || null,
        path: uploaded?.pathname || uploaded?.path || input.path || null,
        byteSize: uploaded?.byteSize || body?.byteLength || input.byteSize || 0,
        storage,
        usedIn,
        tags,
        createdBy: context.userId,
        now: now(),
      });

      const entities = project.entities.map(entity => {
        if (!usedIn.includes(entity.id)) return entity;
        return {
          ...entity,
          assetIds: uniqueList([...(entity.assetIds || []), asset.id]),
        };
      });
      const run = createAgentRun({
        taskType: input.taskType || 'asset_generation',
        status: 'completed',
        promptScope: ['asset-intake', ...usedIn.map(id => `source:${id}`)],
        approvalState: 'not_required',
        output: {
          assetId: asset.id,
          storage,
          rights: asset.rights,
          usedIn,
        },
      });
      const updated = appendAuditArtifacts(normalizeProject({
        ...project,
        entities,
        assets: [...project.assets.filter(item => item.id !== asset.id), asset],
      }), { agentRuns: [run] });

      await save(updated, context);
      return {
        projectId,
        generatedAt: now(),
        tenant: sanitizeTenantContext(context),
        access,
        asset,
        run,
        persistence: typeof projectAdapter.saveProject === 'function' ? 'adapter_save_called' : 'read_only_adapter',
      };
    },
  };
}

export function createPostgresBillingAdapter({ query, withWorkspaceScope = null }) {
  if (typeof query !== 'function') throw new Error('createPostgresBillingAdapter requires a query function.');

  async function runInBillingScope(workspaceId, operation) {
    if (workspaceId && typeof withWorkspaceScope === 'function') {
      return withWorkspaceScope(workspaceId, operation);
    }
    return operation(query);
  }

  function normalizeEntitlementRow(row = null) {
    if (!row) return null;
    return {
      id: row.id,
      workspaceId: row.workspace_id ?? row.workspaceId ?? null,
      userId: row.user_id ?? row.userId ?? null,
      provider: row.provider,
      providerEventId: row.provider_event_id ?? row.providerEventId ?? null,
      offerId: row.offer_id ?? row.offerId,
      planName: row.plan_name ?? row.planName,
      status: row.status,
      entitlements: row.entitlements || null,
      createdAt: row.created_at ?? row.createdAt ?? null,
    };
  }

  function normalizeBillingEventRow(row = null) {
    if (!row) return null;
    return {
      id: row.id,
      provider: row.provider,
      providerEventId: row.provider_event_id ?? row.providerEventId ?? null,
      eventType: row.event_type ?? row.eventType ?? null,
      workspaceId: row.workspace_id ?? row.workspaceId ?? null,
      offerId: row.offer_id ?? row.offerId ?? null,
      stripeCustomerId: row.stripe_customer_id ?? row.stripeCustomerId ?? null,
      stripeSubscriptionId: row.stripe_subscription_id ?? row.stripeSubscriptionId ?? null,
      status: row.status || null,
      payload: row.payload || null,
      createdAt: row.created_at ?? row.createdAt ?? null,
    };
  }

  return {
    async recordBillingEvent(event) {
      const normalized = event.provider === 'stripe' && event.providerEventId ? event : {
        provider: event.provider || 'stripe',
        providerEventId: event.id,
        eventType: event.type,
        workspaceId: event.workspaceId || null,
        offerId: event.offerId || null,
        stripeCustomerId: event.stripeCustomerId || null,
        stripeSubscriptionId: event.stripeSubscriptionId || null,
        status: event.status || null,
        payload: event,
      };
      await runInBillingScope(normalized.workspaceId, scopedQuery => scopedQuery(
        [
          'insert into author_billing_events',
          '(id, workspace_id, provider, provider_event_id, event_type, offer_id, stripe_customer_id, stripe_subscription_id, status, payload)',
          'values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)',
          'on conflict (provider, provider_event_id) do update set payload = $10, status = $9',
        ].join(' '),
        [
          normalized.id || `${normalized.provider}_${normalized.providerEventId}`,
          normalized.workspaceId,
          normalized.provider,
          normalized.providerEventId,
          normalized.eventType,
          normalized.offerId,
          normalized.stripeCustomerId,
          normalized.stripeSubscriptionId,
          normalized.status,
          normalized.payload,
        ],
      ));
      return normalized.id || `${normalized.provider}_${normalized.providerEventId}`;
    },
    async recordEntitlementMutation(mutation) {
      await runInBillingScope(mutation.workspaceId, scopedQuery => scopedQuery(
        [
          'insert into author_entitlement_events',
          '(id, workspace_id, user_id, provider, provider_event_id, offer_id, plan_name, status, entitlements)',
          'values ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
          'on conflict (id) do nothing',
        ].join(' '),
        [
          mutation.id,
          mutation.workspaceId,
          mutation.userId,
          mutation.provider,
          mutation.providerEventId,
          mutation.offerId,
          mutation.planName,
          mutation.status,
          mutation.entitlements,
        ],
      ));
      return mutation.id;
    },
    async recordCreditGrant(grant) {
      if (!grant) return null;
      await runInBillingScope(grant.workspaceId, scopedQuery => scopedQuery(
        [
          'insert into author_credit_grants',
          '(id, workspace_id, offer_id, amount_usd, source, provider_event_id, period_start, period_end)',
          'values ($1, $2, $3, $4, $5, $6, $7, $8)',
          'on conflict (id) do nothing',
        ].join(' '),
        [
          grant.id,
          grant.workspaceId,
          grant.offerId,
          grant.amountUsd,
          grant.source,
          grant.providerEventId,
          grant.periodStart,
          grant.periodEnd,
        ],
      ));
      return grant.id;
    },
    async recordServiceIntake(intake) {
      await runInBillingScope(intake.workspaceId, scopedQuery => scopedQuery(
        [
          'insert into author_service_intakes',
          '(id, workspace_id, user_id, offer_id, status, author_name, email, project_title, manuscript_state, goals, constraints, requested_services)',
          'values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)',
          'on conflict (id) do update set status = $5, updated_at = now()',
        ].join(' '),
        [
          intake.id,
          intake.workspaceId,
          intake.userId,
          intake.offerId,
          intake.status,
          intake.authorName,
          intake.email,
          intake.projectTitle,
          intake.manuscriptState,
          intake.goals,
          intake.constraints,
          intake.requestedServices,
        ],
      ));
      return intake.id;
    },
    async getLatestEntitlement(workspaceId) {
      if (!workspaceId) return null;
      const result = await runInBillingScope(workspaceId, scopedQuery => scopedQuery(
        [
          'select id, workspace_id, user_id, provider, provider_event_id, offer_id, plan_name, status, entitlements, created_at',
          'from author_entitlement_events',
          'where workspace_id = $1',
          'order by created_at desc',
          'limit 1',
        ].join(' '),
        [workspaceId],
      ));
      return normalizeEntitlementRow(result.rows?.[0] || null);
    },
    async getBillingStatus(workspaceId, input = {}) {
      if (!workspaceId) {
        return createBillingAccountSnapshot({
          workspaceId: null,
          fallbackPlan: input.fallbackPlan || 'open-core',
        });
      }
      const [entitlementResult, billingResult] = await runInBillingScope(workspaceId, async scopedQuery => Promise.all([
        scopedQuery(
          [
            'select id, workspace_id, user_id, provider, provider_event_id, offer_id, plan_name, status, entitlements, created_at',
            'from author_entitlement_events',
            'where workspace_id = $1',
            'order by created_at desc',
            'limit 1',
          ].join(' '),
          [workspaceId],
        ),
        scopedQuery(
          [
            'select id, workspace_id, provider, provider_event_id, event_type, offer_id, stripe_customer_id, stripe_subscription_id, status, payload, created_at',
            'from author_billing_events',
            'where workspace_id = $1',
            'order by created_at desc',
            'limit 1',
          ].join(' '),
          [workspaceId],
        ),
      ]));
      return createBillingAccountSnapshot({
        workspaceId,
        entitlement: normalizeEntitlementRow(entitlementResult.rows?.[0] || null),
        billingEvent: normalizeBillingEventRow(billingResult.rows?.[0] || null),
        fallbackPlan: input.fallbackPlan || 'open-core',
      });
    },
  };
}

export function createHostedProjectService({ projectAdapter, now = () => new Date().toISOString() } = {}) {
  if (!projectAdapter?.loadProject) throw new Error('createHostedProjectService requires a projectAdapter with loadProject(projectId).');

  async function loadAuthorizedProject(projectId, context, options = {}) {
    const project = await projectAdapter.loadProject(projectId, { ...options, workspaceId: context.workspaceId, context });
    if (!project) {
      const error = new Error(`Project not found: ${projectId}`);
      error.code = 'PROJECT_NOT_FOUND';
      error.status = 404;
      throw error;
    }
    const graph = normalizeProject(project);
    const access = assertProjectAccess(context, graph, options);
    return { project: graph, access };
  }

  return {
    async listProjects(context, input = {}) {
      const access = assertWorkspaceAccess(context, {
        requiredRole: input.requiredRole || 'viewer',
        requiredFeature: 'hosted-cockpit',
      });
      if (typeof projectAdapter.listProjects !== 'function') {
        const error = new Error('Project adapter does not support workspace project listing.');
        error.code = 'PROJECT_LIST_NOT_SUPPORTED';
        error.status = 503;
        throw error;
      }
      const projects = await projectAdapter.listProjects({
        workspaceId: context.workspaceId,
        context,
        limit: input.limit,
      });
      return {
        generatedAt: now(),
        tenant: sanitizeTenantContext(context),
        access,
        projects: projects.map(item => {
          const graph = normalizeProject(item);
          return {
            id: graph.project.id,
            title: graph.project.title,
            type: graph.project.type,
            genre: graph.project.genre,
            stage: graph.project.stage,
            targetWords: graph.project.targetWords,
            updatedAt: graph.project.updatedAt,
            workspaceId: graph.workspace.id,
            plan: graph.workspace.plan,
          };
        }),
      };
    },

    async createProject(context, input = {}) {
      const access = assertWorkspaceAccess(context, {
        requiredRole: input.requiredRole || 'editor',
        requiredFeature: 'hosted-cockpit',
      });
      const manuscriptText = input.manuscriptText || input.manuscript || input.text || null;
      const seedMode = String(input.seedMode || input.mode || '').toLowerCase();
      const createBlankProject = input.blank === true || seedMode === 'blank';
      const seedInput = {
        id: input.id,
        title: input.title || 'Untitled Book',
        type: input.type || 'book',
        genre: Array.isArray(input.genre) ? input.genre : [],
        stage: input.stage || 'ideation',
        targetWords: input.targetWords || 80000,
        workspaceId: context.workspaceId,
        workspaceName: input.workspaceName || 'Author Workspace',
        plan: context.plan || 'cloud-creator',
      };
      const sourceGraph = input.graph
        ? normalizeProject(input.graph)
        : manuscriptText
          ? createProjectFromManuscript({
              ...input,
              manuscriptText,
              workspaceId: context.workspaceId,
              workspaceName: input.workspaceName || 'Author Workspace',
              plan: context.plan || 'cloud-creator',
              sourceTool: input.sourceTool || 'hosted-cockpit',
              importMode: input.importMode || 'hosted-text',
            })
          : createBlankProject
            ? createEmptyProject(seedInput)
            : createStarterProject({
                ...seedInput,
                template: input.template || input.storyTemplate,
                premise: input.premise,
                audience: input.audience,
                tone: input.tone,
                seriesIntent: input.seriesIntent,
                protagonistName: input.protagonistName,
                foilName: input.foilName,
                settingName: input.settingName,
                readerName: input.readerName,
                methodName: input.methodName,
                sourceTool: input.sourceTool || 'hosted-cockpit',
              });
      const project = normalizeProject({
        ...sourceGraph,
        workspace: {
          ...sourceGraph.workspace,
          id: context.workspaceId,
          plan: context.plan || sourceGraph.workspace.plan,
        },
        project: {
          ...sourceGraph.project,
          title: input.title || sourceGraph.project.title,
          type: input.type || sourceGraph.project.type,
          genre: Array.isArray(input.genre) ? input.genre : sourceGraph.project.genre,
          stage: input.stage || sourceGraph.project.stage,
          targetWords: input.targetWords || sourceGraph.project.targetWords,
          updatedAt: now(),
        },
      });

      if (typeof projectAdapter.saveProject !== 'function') {
        const error = new Error('Project adapter is read-only; cannot create hosted project.');
        error.code = 'PROJECT_ADAPTER_READ_ONLY';
        error.status = 503;
        throw error;
      }

      await projectAdapter.saveProject(project, { workspaceId: context.workspaceId, context });
      return {
        projectId: project.project.id,
        generatedAt: now(),
        tenant: sanitizeTenantContext(context),
        access,
        project: {
          id: project.project.id,
          title: project.project.title,
          type: project.project.type,
          genre: project.project.genre,
          stage: project.project.stage,
          targetWords: project.project.targetWords,
          workspaceId: project.workspace.id,
        },
        importSummary: manuscriptText ? {
          mode: 'manuscript-text',
          chapterCount: project.chapters.length,
          sceneCount: project.scenes.length,
          wordCount: project.scenes.reduce((sum, scene) => sum + Number(scene.wordCount || 0), 0),
          sourceName: input.sourceName || null,
          provenanceAssetId: project.assets.find(asset => asset.type === 'manuscript')?.id || null,
        } : input.graph ? {
          mode: 'graph',
          chapterCount: project.chapters.length,
          sceneCount: project.scenes.length,
          wordCount: project.scenes.reduce((sum, scene) => sum + Number(scene.wordCount || 0), 0),
          sourceName: input.sourceName || null,
          provenanceAssetId: null,
        } : null,
        activationSummary: !manuscriptText && !input.graph ? {
          mode: createBlankProject ? 'blank' : 'starter',
          template: project.project.template || null,
          templateLabel: project.project.templateLabel || null,
          chapterCount: project.chapters.length,
          sceneCount: project.scenes.length,
          beatCount: project.beats.length,
          taskCount: project.tasks.length,
          boardCount: project.boards.length,
          assetCount: project.assets.length,
          decisionCount: project.decisions.length,
          starterBriefAssetId: project.assets.find(asset => asset.id === 'asset_starter_brief')?.id || null,
        } : null,
        persistence: 'adapter_save_called',
      };
    },

    async readProject(projectId, context, options = {}) {
      return loadAuthorizedProject(projectId, context, options);
    },
    async readCanon(projectId, context, options = {}) {
      const { project, access } = await loadAuthorizedProject(projectId, context, options);
      return {
        projectId,
        generatedAt: now(),
        tenant: sanitizeTenantContext(context),
        access,
        canon: {
          entities: project.entities,
          relationships: project.relationships,
          timelineEvents: project.timelineEvents,
          continuityRules: project.continuityRules,
          assets: project.assets,
          publishingPlans: project.publishingPlans,
        },
      };
    },
    async searchManuscript(projectId, context, input = {}) {
      const { project, access } = await loadAuthorizedProject(projectId, context, input);
      return {
        projectId,
        generatedAt: now(),
        tenant: sanitizeTenantContext(context),
        access,
        query: input.query || '',
        results: searchManuscript(project, input.query, { limit: input.limit || 12 }),
      };
    },
    async getRunStatus(projectId, context, input = {}) {
      const { project, access } = await loadAuthorizedProject(projectId, context, input);
      const run = project.agentRuns.find(item => item.id === input.runId) || null;
      return {
        projectId,
        generatedAt: now(),
        tenant: sanitizeTenantContext(context),
        access,
        runId: input.runId || null,
        found: Boolean(run),
        run,
        fallback: run ? null : 'No persisted run found in the hosted project graph.',
      };
    },
    async readProjectContext(projectId, context, options = {}) {
      const { project, access } = await loadAuthorizedProject(projectId, context, options);
      return {
        projectId,
        generatedAt: now(),
        tenant: sanitizeTenantContext(context),
        access,
        context: buildProjectContext(project, options),
      };
    },
    async readCockpit(projectId, context, options = {}) {
      const { project, access } = await loadAuthorizedProject(projectId, context, options);
      return {
        projectId,
        generatedAt: now(),
        tenant: sanitizeTenantContext(context),
        access,
        cockpit: buildCockpitViewModel(project),
      };
    },
    async readPublishingReadiness(projectId, context, options = {}) {
      const { project, access } = await loadAuthorizedProject(projectId, context, options);
      return {
        projectId,
        generatedAt: now(),
        tenant: sanitizeTenantContext(context),
        access,
        readiness: createPublishingReadinessReport(project, options),
      };
    },

    async listPacks(context, input = {}) {
      const access = assertWorkspaceAccess(context, {
        requiredRole: input.requiredRole || 'viewer',
        requiredFeature: 'hosted-cockpit',
      });
      const packAccess = createPackInstallAccessDecision(context, { entitlements: access.entitlements });
      return {
        generatedAt: now(),
        tenant: sanitizeTenantContext(context),
        access,
        packAccess,
        registry: buildPackRegistry(),
      };
    },

    async installPack(projectId, context, input = {}) {
      const { project, access } = await loadAuthorizedProject(projectId, context, {
        ...input,
        requiredRole: input.requiredRole || 'editor',
        requiredFeature: 'hosted-cockpit',
      });
      const packAccess = assertPackInstallAccess(context, { entitlements: access.entitlements });
      if (typeof projectAdapter.saveProject !== 'function') {
        const error = new Error('Project adapter is read-only; cannot install hosted pack.');
        error.code = 'PROJECT_ADAPTER_READ_ONLY';
        error.status = 503;
        throw error;
      }
      const result = installPackIntoProject(project, input.packId || input.selection || 'authoros-foundry-pack', {
        installedBy: context.userId || 'hosted-cockpit',
        installedAt: now(),
      });
      await projectAdapter.saveProject(result.project, { workspaceId: context.workspaceId, context });
      return {
        projectId,
        generatedAt: now(),
        tenant: sanitizeTenantContext(context),
        access,
        packAccess,
        installed: result.installed,
        skipped: result.skipped,
        manifestId: result.manifestId,
        registryVersion: result.registryVersion,
        noProseGenerated: result.noProseGenerated,
        activationSummary: {
          installedPackCount: result.project.installedPacks.length,
          taskCount: result.project.tasks.length,
          boardCount: result.project.boards.length,
          assetCount: result.project.assets.length,
          decisionCount: result.project.decisions.length,
        },
        persistence: 'adapter_save_called',
      };
    },
  };
}

export function createHostedWorkflowService({ projectAdapter, aiAdapter = null, now = () => new Date().toISOString() } = {}) {
  if (!projectAdapter?.loadProject) throw new Error('createHostedWorkflowService requires a projectAdapter with loadProject(projectId).');

  async function loadForMutation(projectId, context, options = {}) {
    const project = await projectAdapter.loadProject(projectId, { ...options, workspaceId: context.workspaceId, context });
    if (!project) {
      const error = new Error(`Project not found: ${projectId}`);
      error.code = 'PROJECT_NOT_FOUND';
      error.status = 404;
      throw error;
    }
    const graph = normalizeProject(project);
    const access = assertProjectAccess(context, graph, {
      requiredRole: options.requiredRole || 'agent',
      requiredFeature: options.requiredFeature || 'hosted-cockpit',
    });
    return { project: graph, access };
  }

  async function save(project, context, options = {}) {
    if (typeof projectAdapter.saveProject === 'function') {
      await projectAdapter.saveProject(project, { ...options, workspaceId: context.workspaceId, context });
    }
  }

  function wantsManagedAi(input = {}) {
    return Boolean(input.useManagedAi || input.managedAi || input.ai === 'managed' || input.runMode === 'managed-ai');
  }

  async function runManagedAi(taskType, project, context, input = {}, extra = {}) {
    if (!wantsManagedAi(input)) return null;
    if (!aiAdapter?.runTask) {
      const error = new Error('Managed AI was requested, but no AI adapter is configured.');
      error.code = 'AI_ADAPTER_NOT_CONFIGURED';
      error.status = 503;
      throw error;
    }
    return aiAdapter.runTask(taskType, {
      ...input,
      workspaceId: context.workspaceId,
      userId: context.userId,
      projectId: project.project.id,
      environment: context.mode,
      context: {
        project,
        ...(extra.context || {}),
      },
      promptScope: extra.promptScope || input.promptScope || [],
    });
  }

  function enrichRunWithAi(run, aiResult) {
    if (!aiResult) return run;
    return {
      ...run,
      status: aiResult.status || run.status,
      routeId: aiResult.routeId || run.routeId,
      model: aiResult.model || run.model,
      gatewayTags: aiResult.gatewayTags || run.gatewayTags,
      promptScope: aiResult.promptScope?.length ? aiResult.promptScope : run.promptScope,
      costEstimateUsd: aiResult.estimatedCostUsd ?? run.costEstimateUsd,
      tokenEstimate: aiResult.usage?.totalTokens ?? run.tokenEstimate,
      output: {
        ...(run.output || {}),
        managedAi: {
          mode: aiResult.mode,
          provider: aiResult.provider,
          model: aiResult.model,
          routeId: aiResult.routeId,
          finishReason: aiResult.finishReason,
          usage: aiResult.usage,
        },
      },
      updatedAt: now(),
    };
  }

  function createAiCreditLedgerEntry(project, context, run, taskType, aiResult) {
    if (!aiResult) return null;
    return createCreditLedgerEntry({
      workspaceId: context.workspaceId || project.workspace.id,
      projectId: project.project.id,
      runId: run.id,
      source: aiResult.mode === 'dry-run' ? 'managed-gateway-dry-run' : 'managed-gateway',
      provider: aiResult.provider || 'vercel-ai-gateway',
      model: aiResult.model || run.model,
      taskType,
      estimatedCostUsd: aiResult.estimatedCostUsd || 0,
      includedCreditUsd: 0,
      inputTokens: aiResult.usage?.inputTokens || 0,
      outputTokens: aiResult.usage?.outputTokens || 0,
    });
  }

  return {
    async startAgentRun(projectId, context, input = {}) {
      const taskType = input.taskType || 'operations';
      const { project, access } = await loadForMutation(projectId, context, { requiredRole: 'agent' });
      const workflow = createWorkflowRunContract({
        purpose: input.purpose || taskType,
        steps: input.steps,
      });
      let updated = project;
      let run = null;
      let suggestion = null;
      let report = null;
      let board = null;
      let exportRecord = null;
      let scene = null;
      let creditLedgerEntry = null;
      let sandbox = null;

      if (taskType === 'create_scene') {
        const aiResult = await runManagedAi(taskType, project, context, input, {
          promptScope: ['scene-input'],
        });
        scene = createSceneRecord({
          id: input.sceneId || input.id,
          chapterId: input.chapterId,
          title: input.title || 'Untitled Scene',
          synopsis: input.synopsis || '',
          pov: input.pov || null,
          text: input.text || aiResult?.text || '',
          status: input.status || 'draft',
          order: Number.isFinite(input.order) ? input.order : project.scenes.length + 1,
          entityIds: Array.isArray(input.entityIds) ? input.entityIds : [],
          beatIds: Array.isArray(input.beatIds) ? input.beatIds : [],
          timelineEventIds: Array.isArray(input.timelineEventIds) ? input.timelineEventIds : [],
          tags: Array.isArray(input.tags) ? input.tags : [],
        });
        run = createAgentRun({
          taskType,
          status: 'completed',
          promptScope: ['scene-input'],
          approvalState: 'not_required',
          output: { sceneId: scene.id },
        });
        run = enrichRunWithAi(run, aiResult);
        creditLedgerEntry = createAiCreditLedgerEntry(project, context, run, taskType, aiResult);
        updated = appendAuditArtifacts(normalizeProject({
          ...project,
          scenes: [...project.scenes, scene],
        }), {
          agentRuns: [run],
          creditLedgerEntries: creditLedgerEntry ? [creditLedgerEntry] : [],
        });
      } else if (taskType === 'revise_scene') {
        const sourceScene = project.scenes.find(item => item.id === input.sceneId) || null;
        const aiResult = await runManagedAi(taskType, project, context, input, {
          promptScope: [`scene:${input.sceneId || 'unknown'}`, 'instruction'],
          context: { scene: sourceScene },
        });
        const revision = createRevisionSuggestion(project, input.sceneId, input.instruction || '', {
          ...input,
          proposal: aiResult?.text || input.proposal,
          estimatedCostUsd: aiResult?.estimatedCostUsd ?? input.estimatedCostUsd,
          inputTokens: aiResult?.usage?.inputTokens ?? input.inputTokens,
          outputTokens: aiResult?.usage?.outputTokens ?? input.outputTokens,
          provider: aiResult?.provider || input.provider,
        });
        run = revision.run;
        suggestion = revision.suggestion;
        creditLedgerEntry = revision.creditLedgerEntry;
        run = enrichRunWithAi(run, aiResult);
        if (aiResult) {
          suggestion = {
            ...suggestion,
            runId: run.id,
            routeId: run.routeId,
          };
          creditLedgerEntry = createAiCreditLedgerEntry(project, context, run, taskType, aiResult);
        }
        updated = appendAuditArtifacts(project, {
          agentRuns: [run],
          suggestions: [suggestion],
          creditLedgerEntries: [creditLedgerEntry],
        });
      } else if (taskType === 'run_continuity_check') {
        report = runContinuityCheck(project);
        run = report.run;
        updated = appendAuditArtifacts(project, { agentRuns: [run] });
      } else if (taskType === 'generate_character_board') {
        board = generateCharacterBoard(project, input.character || input.characterId || input.characterName);
        run = createAgentRun({
          taskType,
          status: board.found ? 'completed' : 'needs_review',
          promptScope: ['entities', 'relationships', 'scenes', 'assets'],
          approvalState: 'not_required',
          output: { found: board.found, boardId: board.board?.id || null },
        });
        updated = appendAuditArtifacts(project, { agentRuns: [run] });
      } else if (taskType === 'export_book') {
        run = createAgentRun({
          taskType,
          status: 'completed',
          promptScope: ['chapters', 'scenes', 'publishingPlans'],
          approvalState: 'not_required',
          output: { format: input.format || 'markdown' },
        });
        exportRecord = createExportRecord(project, {
          format: input.format || 'markdown',
          status: 'ready',
          path: input.path || `exports/${project.project.id}.${input.format || 'md'}`,
          sourceRunId: run.id,
        });
        sandbox = createSandboxJobContract({
          purpose: 'hosted-export-render',
          outputs: [exportRecord.format, 'logs'],
        });
        updated = appendAuditArtifacts(project, { agentRuns: [run], exports: [exportRecord] });
      } else {
        run = createAgentRun({
          taskType,
          status: input.status || 'queued',
          promptScope: input.promptScope || [],
          approvalState: input.approvalRequired ? 'requested' : 'not_required',
          output: input.output || null,
        });
        updated = appendAuditArtifacts(project, { agentRuns: [run] });
      }

      await save(updated, context, {
        workflowJobs: [{
          ...workflow,
          runId: run?.id || null,
          status: run?.status || 'queued',
        }],
      });
      return {
        projectId,
        generatedAt: now(),
        tenant: sanitizeTenantContext(context),
        access,
        workflow,
        sandbox,
        run,
        suggestion,
        report,
        board,
        scene,
        export: exportRecord,
        markdownPreview: taskType === 'export_book' && (input.format || 'markdown') === 'markdown'
          ? exportBookMarkdown(project).slice(0, 2000)
          : null,
        creditLedgerEntry,
        managedAi: run?.output?.managedAi || null,
        persistence: typeof projectAdapter.saveProject === 'function' ? 'adapter_save_called' : 'read_only_adapter',
      };
    },

    async decideSuggestion(projectId, context, suggestionId, input = {}) {
      const { project, access } = await loadForMutation(projectId, context, { requiredRole: 'editor' });
      const decision = decideCoreSuggestion(project, suggestionId, input.decision || 'pending', {
        approverId: context.userId || input.approverId || 'hosted-human',
        notes: input.notes || '',
        conditions: Array.isArray(input.conditions) ? input.conditions : [],
      });
      await save(decision.project, context);
      return {
        projectId,
        generatedAt: now(),
        tenant: sanitizeTenantContext(context),
        access,
        suggestion: decision.suggestion,
        approval: decision.approval,
        persistence: typeof projectAdapter.saveProject === 'function' ? 'adapter_save_called' : 'read_only_adapter',
      };
    },
  };
}

export function createBillingPriceCatalog(env = {}) {
  const defaults = {
    'foundry-pack': env.STRIPE_PRICE_FOUNDRY_PACK || 'lookup:authoros-foundry-pack',
    'pro-local': env.STRIPE_PRICE_PRO_LOCAL || 'lookup:authoros-pro-local',
    'founder-lifetime-local': env.STRIPE_PRICE_FOUNDER_LIFETIME_LOCAL || 'lookup:authoros-founder-lifetime-local',
    'cloud-creator': env.STRIPE_PRICE_CLOUD_CREATOR || 'lookup:authoros-cloud-creator',
    'cloud-studio': env.STRIPE_PRICE_CLOUD_STUDIO || 'lookup:authoros-cloud-studio',
    'agency-small-press': env.STRIPE_PRICE_AGENCY_SMALL_PRESS || 'lookup:authoros-agency-small-press',
    'concierge-setup': env.STRIPE_PRICE_CONCIERGE_SETUP || 'lookup:authoros-concierge-setup',
    'agentic-service-sprint': env.STRIPE_PRICE_AGENTIC_SERVICE_SPRINT || 'lookup:authoros-agentic-service-sprint',
  };
  return Object.fromEntries(Object.entries(defaults).filter(([, value]) => Boolean(value)));
}

export function resolveOfferFromPrice(priceIdOrLookupKey, env = {}) {
  const catalog = createBillingPriceCatalog(env);
  const match = Object.entries(catalog).find(([, value]) => value === priceIdOrLookupKey || value === `lookup:${priceIdOrLookupKey}`);
  if (match) return getOfferById(match[0]);
  const byOfferId = priceIdOrLookupKey ? getOfferById(priceIdOrLookupKey) : null;
  return byOfferId?.id === priceIdOrLookupKey ? byOfferId : null;
}

const SUBSCRIPTION_CHECKOUT_OFFERS = new Set([
  'pro-local',
  'cloud-creator',
  'cloud-studio',
  'agency-small-press',
]);

function createCodedError(message, code, status = 400) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  return error;
}

function isDemoCheckoutRuntime(env = {}, input = {}) {
  if (input.demoMode !== undefined) return Boolean(input.demoMode);
  return isAuthorOsDemoMode(env);
}

function resolveCheckoutBaseUrl(input = {}, env = {}) {
  if (input.baseUrl) return input.baseUrl;
  if (input.appUrl) return input.appUrl;
  if (env.NEXT_PUBLIC_APP_URL) return env.NEXT_PUBLIC_APP_URL;
  if (env.VERCEL_URL) return `https://${String(env.VERCEL_URL).replace(/^https?:\/\//, '')}`;
  return 'http://localhost:3000';
}

function resolveCheckoutUrl(value, baseUrl, fallbackPath) {
  return new URL(value || fallbackPath, baseUrl).toString();
}

function normalizeMetadata(input = {}) {
  return Object.fromEntries(Object.entries(input)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => [key, String(value)]));
}

export function resolveBillingModeForOffer(offerOrId) {
  const offer = typeof offerOrId === 'string' ? getOfferById(offerOrId) : offerOrId;
  return SUBSCRIPTION_CHECKOUT_OFFERS.has(offer?.id) ? 'subscription' : 'payment';
}

export function createBillingAccountSnapshot(input = {}) {
  const entitlement = input.entitlement || null;
  const billingEvent = input.billingEvent || null;
  const workspaceId = input.workspaceId || entitlement?.workspaceId || billingEvent?.workspaceId || null;
  const status = entitlement?.status || 'unconfigured';
  const plan = status === 'active'
    ? entitlement.offerId
    : status === 'cancelled'
      ? 'open-core'
      : input.fallbackPlan || entitlement?.offerId || 'open-core';
  const entitlements = entitlement?.entitlements || createEntitlementSnapshot(plan);
  const stripeCustomerId = entitlement?.stripeCustomerId || billingEvent?.stripeCustomerId || billingEvent?.payload?.billingEvent?.stripeCustomerId || null;
  const stripeSubscriptionId = entitlement?.stripeSubscriptionId || billingEvent?.stripeSubscriptionId || billingEvent?.payload?.billingEvent?.stripeSubscriptionId || null;

  return {
    workspaceId,
    generatedAt: input.generatedAt || new Date().toISOString(),
    plan,
    status,
    source: entitlement ? 'billing-entitlement' : 'request-context',
    stripeCustomerId,
    stripeSubscriptionId,
    hasStripeCustomer: Boolean(stripeCustomerId),
    entitlement: entitlement ? {
      id: entitlement.id,
      offerId: entitlement.offerId,
      planName: entitlement.planName,
      status: entitlement.status,
      provider: entitlement.provider,
      providerEventId: entitlement.providerEventId,
      createdAt: entitlement.createdAt || null,
    } : null,
    entitlements,
    lastBillingEvent: billingEvent ? {
      id: billingEvent.id,
      provider: billingEvent.provider,
      providerEventId: billingEvent.providerEventId,
      eventType: billingEvent.eventType || billingEvent.type || null,
      offerId: billingEvent.offerId || null,
      status: billingEvent.status || null,
      createdAt: billingEvent.createdAt || null,
    } : null,
  };
}

export function createStripeCheckoutSessionPlan(input = {}, env = {}) {
  const offerId = String(input.offerId || input.plan || '').trim();
  if (!offerId) {
    throw createCodedError('A checkout offerId is required.', 'CHECKOUT_OFFER_REQUIRED', 400);
  }

  const offer = getOfferById(offerId);
  if (offer.id !== offerId) {
    throw createCodedError(`Unknown checkout offer: ${offerId}`, 'CHECKOUT_OFFER_UNKNOWN', 404);
  }
  if (offer.id === 'open-core') {
    throw createCodedError('Open core is free and does not create a Stripe Checkout Session.', 'CHECKOUT_OFFER_NOT_SELLABLE', 400);
  }

  const workspaceId = input.workspaceId || input.clientReferenceId || null;
  if (!workspaceId) {
    throw createCodedError('Checkout requires a workspace id so billing can be audited and reconciled.', 'CHECKOUT_WORKSPACE_REQUIRED', 400);
  }

  const catalog = createBillingPriceCatalog(env);
  const priceId = input.priceId || catalog[offer.id] || null;
  if (!priceId) {
    throw createCodedError(`No Stripe price is configured for ${offer.id}.`, 'STRIPE_PRICE_NOT_CONFIGURED', 503);
  }

  const demoRuntime = isDemoCheckoutRuntime(env, input);
  const allowLookupPrice = input.allowLookupPrice ?? demoRuntime;
  if (String(priceId).startsWith('lookup:') && !allowLookupPrice) {
    throw createCodedError(`Production checkout requires a concrete Stripe price id for ${offer.id}.`, 'STRIPE_PRICE_NOT_CONFIGURED', 503);
  }

  const mode = input.mode || resolveBillingModeForOffer(offer);
  if (!['payment', 'subscription'].includes(mode)) {
    throw createCodedError(`Unsupported Stripe Checkout mode: ${mode}`, 'STRIPE_CHECKOUT_MODE_UNSUPPORTED', 400);
  }

  const baseUrl = resolveCheckoutBaseUrl(input, env);
  const successUrl = resolveCheckoutUrl(input.successUrl, baseUrl, '/checkout/success?session_id={CHECKOUT_SESSION_ID}');
  const cancelUrl = resolveCheckoutUrl(input.cancelUrl, baseUrl, '/checkout/cancel');
  const metadata = normalizeMetadata({
    source: 'author-os-checkout',
    workspaceId,
    userId: input.userId || null,
    offerId: offer.id,
    plan: offer.layer,
    projectId: input.projectId || null,
    priceId,
    checkoutMode: mode,
    email: input.email || null,
    ...(input.metadata || {}),
  });
  const automaticTaxEnabled = Boolean(input.automaticTaxEnabled ?? String(env.STRIPE_AUTOMATIC_TAX_ENABLED || '').toLowerCase() === 'true');

  const params = {
    mode,
    success_url: successUrl,
    cancel_url: cancelUrl,
    client_reference_id: workspaceId,
    customer: input.stripeCustomerId || undefined,
    customer_email: input.stripeCustomerId ? undefined : input.email || undefined,
    allow_promotion_codes: input.allowPromotionCodes ?? true,
    automatic_tax: { enabled: automaticTaxEnabled },
    line_items: [{ price: priceId, quantity: Number(input.quantity || 1) }],
    metadata,
    subscription_data: mode === 'subscription' ? { metadata } : undefined,
    payment_intent_data: mode === 'payment' ? { metadata } : undefined,
  };

  return {
    provider: 'stripe',
    offer,
    offerId: offer.id,
    mode,
    priceId,
    workspaceId,
    userId: input.userId || null,
    projectId: input.projectId || null,
    email: input.email || null,
    successUrl,
    cancelUrl,
    metadata,
    params,
    createdAt: input.createdAt || new Date().toISOString(),
  };
}

function appendStripeFormValue(form, key, value) {
  if (value === undefined || value === null) return;
  if (Array.isArray(value)) {
    value.forEach((item, index) => appendStripeFormValue(form, `${key}[${index}]`, item));
    return;
  }
  if (typeof value === 'object') {
    for (const [childKey, childValue] of Object.entries(value)) {
      appendStripeFormValue(form, `${key}[${childKey}]`, childValue);
    }
    return;
  }
  if (typeof value === 'boolean') {
    form.append(key, value ? 'true' : 'false');
    return;
  }
  form.append(key, String(value));
}

export function createStripeFormParams(params = {}) {
  const form = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    appendStripeFormValue(form, key, value);
  }
  return form;
}

export function sanitizeStripeCheckoutSessionPlan(plan = {}) {
  return {
    provider: plan.provider || 'stripe',
    offerId: plan.offerId || null,
    offerLayer: plan.offer?.layer || null,
    mode: plan.mode || null,
    priceId: plan.priceId || null,
    workspaceId: plan.workspaceId || null,
    userId: plan.userId ? 'present' : null,
    projectId: plan.projectId || null,
    successUrl: plan.successUrl || null,
    cancelUrl: plan.cancelUrl || null,
    metadata: plan.metadata || {},
    lineItemCount: Array.isArray(plan.params?.line_items) ? plan.params.line_items.length : 0,
    allowPromotionCodes: Boolean(plan.params?.allow_promotion_codes),
    automaticTaxEnabled: Boolean(plan.params?.automatic_tax?.enabled),
    createdAt: plan.createdAt || null,
  };
}

export function createUnconfiguredCheckoutClient(input = {}) {
  const reason = input.reason || 'Production Stripe checkout is not configured. Set STRIPE_SECRET_KEY before accepting paid checkouts.';
  return {
    mode: 'unconfigured',
    async createCheckoutSession() {
      throw createCodedError(reason, 'STRIPE_CHECKOUT_NOT_CONFIGURED', 503);
    },
  };
}

export function createDemoCheckoutClient(input = {}) {
  return {
    mode: 'demo',
    async createCheckoutSession(plan) {
      const suffix = (input.id || randomUUID()).replace(/[^a-zA-Z0-9]/g, '').slice(0, 18);
      const id = input.sessionId || `cs_demo_${suffix}`;
      return {
        id,
        url: `${input.checkoutBaseUrl || 'https://checkout.stripe.com/c/pay'}/${id}`,
        status: 'open',
        mode: plan.mode,
        provider: 'stripe-demo',
        livemode: false,
        offerId: plan.offerId,
        priceId: plan.priceId,
      };
    },
  };
}

export function createStripeCheckoutClient(input = {}) {
  const secretKey = input.secretKey || input.env?.STRIPE_SECRET_KEY || null;
  const fetchImpl = input.fetchImpl || globalThis.fetch;
  const apiBaseUrl = input.apiBaseUrl || 'https://api.stripe.com/v1';
  if (!secretKey || typeof fetchImpl !== 'function') {
    return createUnconfiguredCheckoutClient({
      reason: !secretKey
        ? 'Production Stripe checkout is not configured. Set STRIPE_SECRET_KEY before accepting paid checkouts.'
        : 'Stripe checkout requires a fetch implementation.',
    });
  }

  return {
    mode: 'stripe',
    async createCheckoutSession(plan) {
      const response = await fetchImpl(`${apiBaseUrl}/checkout/sessions`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${secretKey}`,
          'content-type': 'application/x-www-form-urlencoded',
        },
        body: createStripeFormParams(plan.params),
      });
      const text = await response.text();
      let body = null;
      try {
        body = text ? JSON.parse(text) : {};
      } catch {
        body = { raw: text };
      }
      if (!response.ok) {
        const error = createCodedError(
          body?.error?.message || `Stripe Checkout Session creation failed with status ${response.status}.`,
          'STRIPE_CHECKOUT_CREATE_FAILED',
          response.status || 502,
        );
        error.stripeStatus = response.status;
        error.stripeRequestId = response.headers?.get?.('request-id') || null;
        throw error;
      }
      return {
        id: body.id,
        url: body.url,
        status: body.status || 'open',
        mode: body.mode || plan.mode,
        provider: 'stripe',
        livemode: body.livemode ?? null,
        customerId: body.customer || null,
        offerId: plan.offerId,
        priceId: plan.priceId,
        raw: body,
      };
    },
  };
}

export function createStripeBillingPortalSessionPlan(input = {}, env = {}) {
  const stripeCustomerId = input.stripeCustomerId || input.customer || null;
  if (!stripeCustomerId) {
    throw createCodedError('A Stripe customer id is required to create a billing portal session.', 'STRIPE_CUSTOMER_REQUIRED', 409);
  }
  const baseUrl = resolveCheckoutBaseUrl(input, env);
  const returnUrl = resolveCheckoutUrl(input.returnUrl, baseUrl, '/billing');
  const params = {
    customer: stripeCustomerId,
    return_url: returnUrl,
    configuration: input.configuration || env.STRIPE_BILLING_PORTAL_CONFIGURATION || undefined,
    locale: input.locale || undefined,
  };
  return {
    provider: 'stripe',
    stripeCustomerId,
    workspaceId: input.workspaceId || null,
    userId: input.userId || null,
    returnUrl,
    params,
    createdAt: input.createdAt || new Date().toISOString(),
  };
}

export function sanitizeStripeBillingPortalSessionPlan(plan = {}) {
  return {
    provider: plan.provider || 'stripe',
    workspaceId: plan.workspaceId || null,
    userId: plan.userId ? 'present' : null,
    hasStripeCustomer: Boolean(plan.stripeCustomerId),
    returnUrl: plan.returnUrl || null,
    configuration: plan.params?.configuration || null,
    locale: plan.params?.locale || null,
    createdAt: plan.createdAt || null,
  };
}

export function createUnconfiguredBillingPortalClient(input = {}) {
  const reason = input.reason || 'Production Stripe billing portal is not configured. Set STRIPE_SECRET_KEY and enable Customer Portal before accepting subscription management.';
  return {
    mode: 'unconfigured',
    async createBillingPortalSession() {
      throw createCodedError(reason, 'STRIPE_PORTAL_NOT_CONFIGURED', 503);
    },
  };
}

export function createDemoBillingPortalClient(input = {}) {
  return {
    mode: 'demo',
    async createBillingPortalSession(plan) {
      const suffix = (input.id || randomUUID()).replace(/[^a-zA-Z0-9]/g, '').slice(0, 18);
      const id = input.sessionId || `bps_demo_${suffix}`;
      return {
        id,
        url: `${input.portalBaseUrl || 'https://billing.stripe.com/p/session'}/${id}`,
        provider: 'stripe-demo',
        livemode: false,
        customerId: plan.stripeCustomerId,
        returnUrl: plan.returnUrl,
      };
    },
  };
}

export function createStripeBillingPortalClient(input = {}) {
  const secretKey = input.secretKey || input.env?.STRIPE_SECRET_KEY || null;
  const fetchImpl = input.fetchImpl || globalThis.fetch;
  const apiBaseUrl = input.apiBaseUrl || 'https://api.stripe.com/v1';
  if (!secretKey || typeof fetchImpl !== 'function') {
    return createUnconfiguredBillingPortalClient({
      reason: !secretKey
        ? 'Production Stripe billing portal is not configured. Set STRIPE_SECRET_KEY before accepting subscription management.'
        : 'Stripe billing portal requires a fetch implementation.',
    });
  }

  return {
    mode: 'stripe',
    async createBillingPortalSession(plan) {
      const response = await fetchImpl(`${apiBaseUrl}/billing_portal/sessions`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${secretKey}`,
          'content-type': 'application/x-www-form-urlencoded',
        },
        body: createStripeFormParams(plan.params),
      });
      const text = await response.text();
      let body = null;
      try {
        body = text ? JSON.parse(text) : {};
      } catch {
        body = { raw: text };
      }
      if (!response.ok) {
        const error = createCodedError(
          body?.error?.message || `Stripe Billing Portal Session creation failed with status ${response.status}.`,
          'STRIPE_PORTAL_CREATE_FAILED',
          response.status || 502,
        );
        error.stripeStatus = response.status;
        error.stripeRequestId = response.headers?.get?.('request-id') || null;
        throw error;
      }
      return {
        id: body.id,
        url: body.url,
        provider: 'stripe',
        livemode: body.livemode ?? null,
        customerId: body.customer || plan.stripeCustomerId,
        returnUrl: body.return_url || plan.returnUrl,
        raw: body,
      };
    },
  };
}

export function verifyStripeWebhookSignature(payload, signatureHeader, secret, options = {}) {
  if (!secret) {
    const error = new Error('STRIPE_WEBHOOK_SECRET is required to verify billing webhooks.');
    error.code = 'WEBHOOK_SECRET_REQUIRED';
    error.status = 500;
    throw error;
  }
  if (!signatureHeader) {
    const error = new Error('Missing Stripe-Signature header.');
    error.code = 'WEBHOOK_SIGNATURE_MISSING';
    error.status = 400;
    throw error;
  }

  const parts = Object.fromEntries(String(signatureHeader).split(',').map(part => {
    const [key, value] = part.split('=');
    return [key, value];
  }));
  const timestamp = Number(parts.t || 0);
  const signature = parts.v1;
  const nowSeconds = Number(options.nowSeconds || Math.floor(Date.now() / 1000));
  const toleranceSeconds = Number(options.toleranceSeconds || 300);
  if (!timestamp || Math.abs(nowSeconds - timestamp) > toleranceSeconds) {
    const error = new Error('Stripe webhook timestamp is outside tolerance.');
    error.code = 'WEBHOOK_TIMESTAMP_OUT_OF_TOLERANCE';
    error.status = 400;
    throw error;
  }
  if (!signature) {
    const error = new Error('Stripe webhook v1 signature is missing.');
    error.code = 'WEBHOOK_SIGNATURE_MISSING';
    error.status = 400;
    throw error;
  }

  const signedPayload = `${timestamp}.${payload}`;
  const expected = createHmac('sha256', secret).update(signedPayload, 'utf8').digest('hex');
  const expectedBuffer = Buffer.from(expected, 'hex');
  const actualBuffer = Buffer.from(signature, 'hex');
  if (expectedBuffer.length !== actualBuffer.length || !timingSafeEqual(expectedBuffer, actualBuffer)) {
    const error = new Error('Stripe webhook signature verification failed.');
    error.code = 'WEBHOOK_SIGNATURE_INVALID';
    error.status = 400;
    throw error;
  }

  return { verified: true, timestamp };
}

function extractStripeLinePriceId(object = {}) {
  const line = object.lines?.data?.[0] || object.items?.data?.[0] || null;
  return line?.price?.lookup_key || line?.price?.id || object.metadata?.priceId || object.metadata?.lookupKey || null;
}

export function normalizeBillingEvent(event = {}, env = {}) {
  const object = event.data?.object || event.object || {};
  const metadata = object.metadata || {};
  const priceId = extractStripeLinePriceId(object);
  const offer = getOfferById(metadata.offerId || metadata.plan || '')?.id === (metadata.offerId || metadata.plan)
    ? getOfferById(metadata.offerId || metadata.plan)
    : resolveOfferFromPrice(priceId, env);

  return {
    id: event.id || `billing_${Date.now().toString(36)}`,
    provider: 'stripe',
    type: event.type || 'unknown',
    livemode: Boolean(event.livemode),
    workspaceId: metadata.workspaceId || object.client_reference_id || object.subscription_details?.metadata?.workspaceId || null,
    userId: metadata.userId || object.customer_email || null,
    offerId: offer?.id || metadata.offerId || metadata.plan || null,
    planName: offer?.layer || null,
    stripeCustomerId: object.customer || null,
    stripeSubscriptionId: object.subscription || object.id || null,
    stripeCheckoutSessionId: event.type === 'checkout.session.completed' ? object.id : null,
    priceId,
    status: object.status || null,
    amountTotal: object.amount_total ?? object.amount_paid ?? null,
    currency: object.currency || null,
    createdAt: new Date((event.created || Math.floor(Date.now() / 1000)) * 1000).toISOString(),
    rawObjectType: object.object || null,
  };
}

export function createEntitlementMutationFromBillingEvent(event, env = {}) {
  const normalized = event.provider === 'stripe' && event.workspaceId !== undefined ? event : normalizeBillingEvent(event, env);
  const offer = getOfferById(normalized.offerId || 'open-core');
  const activeTypes = new Set([
    'checkout.session.completed',
    'customer.subscription.created',
    'customer.subscription.updated',
    'invoice.paid',
  ]);
  const cancelledTypes = new Set([
    'customer.subscription.deleted',
    'customer.subscription.paused',
  ]);
  const status = cancelledTypes.has(normalized.type) || normalized.status === 'canceled'
    ? 'cancelled'
    : activeTypes.has(normalized.type)
      ? 'active'
      : 'recorded';

  return {
    id: `ent_${normalized.id}`,
    provider: normalized.provider,
    providerEventId: normalized.id,
    workspaceId: normalized.workspaceId,
    userId: normalized.userId,
    offerId: offer.id,
    planName: offer.layer,
    status,
    stripeCustomerId: normalized.stripeCustomerId,
    stripeSubscriptionId: normalized.stripeSubscriptionId,
    entitlements: createEntitlementSnapshot(status === 'cancelled' ? 'open-core' : offer.id),
    creditGrant: status === 'active' && offer.aiCreditsIncludedUsd
      ? createCreditGrant({
          workspaceId: normalized.workspaceId,
          offerId: offer.id,
          amountUsd: offer.aiCreditsIncludedUsd,
          source: 'stripe-entitlement',
          providerEventId: normalized.id,
        })
      : null,
    createdAt: normalized.createdAt,
  };
}

export function createCreditGrant(input = {}) {
  return {
    id: input.id || `grant_${Date.now().toString(36)}`,
    workspaceId: input.workspaceId || null,
    offerId: input.offerId || 'open-core',
    amountUsd: Number(Number(input.amountUsd || 0).toFixed(4)),
    source: input.source || 'manual',
    providerEventId: input.providerEventId || null,
    periodStart: input.periodStart || new Date().toISOString(),
    periodEnd: input.periodEnd || null,
    createdAt: input.createdAt || new Date().toISOString(),
  };
}

export function createBillingLedgerEntryFromGrant(grant, input = {}) {
  return createCreditLedgerEntry({
    id: input.id || `credit_${grant.id}`,
    workspaceId: grant.workspaceId,
    projectId: input.projectId || null,
    runId: input.runId || null,
    source: grant.source,
    provider: 'stripe',
    model: 'credit-grant',
    taskType: 'credit_grant',
    estimatedCostUsd: 0,
    includedCreditUsd: grant.amountUsd,
    inputTokens: 0,
    outputTokens: 0,
  });
}

export function createServiceIntake(input = {}) {
  return {
    id: input.id || `intake_${Date.now().toString(36)}`,
    workspaceId: input.workspaceId || null,
    userId: input.userId || null,
    offerId: input.offerId || 'concierge-setup',
    status: input.status || 'new',
    authorName: input.authorName || '',
    email: input.email || '',
    projectTitle: input.projectTitle || '',
    manuscriptState: input.manuscriptState || 'unknown',
    goals: input.goals || [],
    constraints: input.constraints || [],
    requestedServices: input.requestedServices || [],
    createdAt: input.createdAt || new Date().toISOString(),
  };
}

export function sanitizeTenantContext(context = {}) {
  return {
    mode: context.mode,
    authProvider: context.authProvider,
    authSource: context.authSource,
    authVerified: Boolean(context.authVerified),
    userId: context.userId ? 'present' : null,
    workspaceId: context.workspaceId,
    plan: context.plan,
    entitlementSource: context.entitlementSource || 'request-context',
    billingEntitlementId: context.billingEntitlementId || null,
    billingEntitlementStatus: context.billingEntitlementStatus || null,
    roles: context.roles || [],
    requestId: context.requestId,
  };
}

function envFlag(env, key, expected) {
  return String(env[key] ?? '').toLowerCase() === expected;
}

function hasAnyEnv(env, names = []) {
  return names.some(name => Boolean(env[name]));
}

function normalizeEnvValue(value) {
  return String(value ?? '').trim();
}

function isPlaceholderEnvValue(name, value) {
  const rawValue = normalizeEnvValue(value);
  const lowered = rawValue.toLowerCase();
  if (!rawValue) return false;
  if (['present', 'configured', 'replace-me', 'replace_me', 'todo', 'tbd'].includes(lowered)) return true;
  if (lowered.includes('replace_me') || lowered.includes('replace-me')) return true;
  if (lowered.includes('your_') || lowered.includes('your-') || lowered.includes('<')) return true;
  if (lowered === 'provider/model-from-ai-gateway-catalog' || lowered === 'provider/fallback-model') return true;
  if (lowered.includes('user:password@host.neon.tech')) return true;
  if (lowered === 'https://replace@sentry.io/project') return true;
  if (String(name).startsWith('STRIPE_PRICE_') && lowered.startsWith('price_replace_')) return true;
  return false;
}

function createEnvValidationResult(valid, reason) {
  return { valid, reason: valid ? null : reason };
}

function validateProductionEnvValue(name, value) {
  const rawValue = normalizeEnvValue(value);
  if (!rawValue) return { valid: false, reason: 'missing' };
  if (isPlaceholderEnvValue(name, rawValue)) return { valid: false, reason: 'placeholder' };

  if (name === 'POSTGRES_URL' || name === 'DATABASE_URL') {
    return createEnvValidationResult(
      /^postgres(?:ql)?:\/\/[^:]+:[^@]+@[^/]+\/[^?]+/.test(rawValue),
      'invalid_postgres_url',
    );
  }

  if (name === 'NEXT_PUBLIC_APP_URL') {
    return createEnvValidationResult(
      /^https:\/\/[^ ]+\.[^ ]+/.test(rawValue),
      'invalid_https_url',
    );
  }

  if (name === 'AUTHOROS_MCP_AUTHORIZATION_SERVER_URL' || name === 'AUTHOROS_AUTHORIZATION_SERVER_URL') {
    return createEnvValidationResult(
      /^https:\/\/[^ ]+\.[^ ]+/.test(rawValue),
      'invalid_authorization_server_url',
    );
  }

  if (name === 'CLERK_SECRET_KEY' || name === 'STRIPE_SECRET_KEY') {
    return createEnvValidationResult(
      /^sk_(test|live)_[A-Za-z0-9_-]{8,}$/.test(rawValue),
      'invalid_secret_key',
    );
  }

  if (name === 'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY' || name === 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY') {
    return createEnvValidationResult(
      /^pk_(test|live)_[A-Za-z0-9_-]{8,}$/.test(rawValue),
      'invalid_publishable_key',
    );
  }

  if (name === 'STRIPE_WEBHOOK_SECRET') {
    return createEnvValidationResult(
      /^whsec_[A-Za-z0-9_-]{8,}$/.test(rawValue),
      'invalid_webhook_secret',
    );
  }

  if (name === 'STRIPE_BILLING_PORTAL_CONFIGURATION') {
    return createEnvValidationResult(
      /^bpc_[A-Za-z0-9_-]{4,}$/.test(rawValue),
      'invalid_billing_portal_configuration',
    );
  }

  if (String(name).startsWith('STRIPE_PRICE_')) {
    return createEnvValidationResult(
      /^price_[A-Za-z0-9_-]{4,}$/.test(rawValue),
      'invalid_price_id',
    );
  }

  if (name === 'BLOB_READ_WRITE_TOKEN') {
    return createEnvValidationResult(rawValue.length >= 16, 'invalid_blob_token');
  }

  if (name === 'AI_GATEWAY_API_KEY' || name === 'VERCEL_AI_GATEWAY_API_KEY') {
    return createEnvValidationResult(rawValue.length >= 12, 'invalid_ai_gateway_key');
  }

  if (name === 'SENTRY_DSN') {
    return createEnvValidationResult(
      /^https:\/\/[^@]+@[^/]+\/\d+/.test(rawValue),
      'invalid_sentry_dsn',
    );
  }

  if (name === 'NEXT_PUBLIC_POSTHOG_KEY') {
    return createEnvValidationResult(
      /^phc_[A-Za-z0-9_-]{8,}$/.test(rawValue),
      'invalid_posthog_key',
    );
  }

  if (name === 'NEXT_PUBLIC_POSTHOG_HOST') {
    return createEnvValidationResult(
      /^https:\/\/[^ ]+\.[^ ]+/.test(rawValue),
      'invalid_posthog_host',
    );
  }

  if (name === 'AUTHOROS_VERCEL_PROTECTION_BYPASS' || name === 'VERCEL_AUTOMATION_BYPASS_SECRET') {
    return createEnvValidationResult(rawValue.length >= 16, 'invalid_vercel_protection_bypass_secret');
  }

  if (String(name).startsWith('AUTHOROS_MODEL_') || name === 'AUTHOROS_AI_FALLBACK_MODELS') {
    return createEnvValidationResult(
      rawValue.split(',').map(item => item.trim()).every(item => /^[^/\s]+\/[^/\s]+$/.test(item)),
      'invalid_model_id',
    );
  }

  if (name === 'AUTHOROS_AI_PROVIDER_ORDER') {
    return createEnvValidationResult(
      rawValue.split(',').map(item => item.trim()).every(Boolean),
      'invalid_provider_order',
    );
  }

  if (name === 'AUTHOROS_AI_MAX_INPUT_TOKENS' || name === 'AUTHOROS_AI_MAX_OUTPUT_TOKENS') {
    const valueNumber = Number(rawValue);
    return createEnvValidationResult(
      Number.isFinite(valueNumber) && valueNumber > 0,
      'invalid_token_budget',
    );
  }

  return { valid: true, reason: null };
}

function getEnvSpecByName(name) {
  return AUTHOR_OS_PRODUCTION_ENV_CONTRACT.find(spec => spec.name === name || (spec.aliases || []).includes(name));
}

function isProductionEnvValueReady(env, name) {
  const spec = getEnvSpecByName(name);
  if (!spec) {
    const rawValue = normalizeEnvValue(env[name]);
    return Boolean(rawValue) && !isPlaceholderEnvValue(name, rawValue);
  }
  return resolveEnvSpecStatus(spec, env).status === 'pass';
}

function areProductionEnvValuesReady(env, names = []) {
  return names.every(name => isProductionEnvValueReady(env, name));
}

function isAnyProductionEnvValueReady(env, names = []) {
  return names.some(name => isProductionEnvValueReady(env, name));
}

function createReadinessCheck(input) {
  return {
    id: input.id,
    label: input.label,
    status: input.status,
    severity: input.severity || 'blocker',
    env: input.env || [],
    detail: input.detail || '',
    nextAction: input.nextAction || '',
  };
}

export const AUTHOR_OS_PRODUCTION_ENV_CONTRACT = [
  {
    name: 'AUTHOROS_DEMO_MODE',
    group: 'runtime',
    expected: 'false',
    required: true,
    sensitive: false,
    example: 'false',
    description: 'Disables the sample project adapter in hosted production.',
  },
  {
    name: 'AUTHOROS_REQUIRE_AUTH',
    group: 'runtime',
    expected: 'true',
    required: true,
    sensitive: false,
    example: 'true',
    description: 'Requires verified tenant identity before serving project data.',
  },
  {
    name: 'AUTHOROS_AUTH_PROVIDER',
    group: 'auth',
    expected: 'clerk',
    required: true,
    sensitive: false,
    example: 'clerk',
    description: 'Selects Clerk as the first hosted auth provider.',
  },
  {
    name: 'AUTHOROS_ALLOW_TRUSTED_AUTH_HEADERS',
    group: 'auth',
    expected: 'false',
    required: true,
    sensitive: false,
    example: 'false',
    description: 'Keeps raw tenant identity headers disabled unless a reviewed gateway injects them.',
  },
  {
    name: 'AUTHOROS_DEFAULT_PLAN',
    group: 'entitlements',
    required: true,
    sensitive: false,
    example: 'cloud-creator',
    description: 'Fallback plan until Stripe entitlement events become the source of truth.',
  },
  {
    name: 'AUTHOROS_DEFAULT_AUTH_ROLE',
    group: 'entitlements',
    required: true,
    sensitive: false,
    example: 'editor',
    description: 'Fallback role for authenticated users without explicit workspace claims.',
  },
  {
    name: 'AUTHOROS_PROJECT_ADAPTER',
    group: 'data',
    expected: 'postgres',
    required: true,
    sensitive: false,
    example: 'postgres',
    description: 'Forces hosted persistence through the tenant-scoped Postgres adapter.',
  },
  {
    name: 'AUTHOROS_DB_MIGRATION_VERSION',
    group: 'data',
    expected: '001_author_os_cloud',
    required: true,
    sensitive: false,
    example: '001_author_os_cloud',
    description: 'Declares the verified schema version applied to the target database.',
  },
  {
    name: 'AUTHOROS_MIGRATION_APPLIED_BY',
    group: 'data',
    required: true,
    sensitive: false,
    example: 'author-os-cli',
    description: 'Audit identity recorded by the migration runner.',
  },
  {
    name: 'AUTHOROS_PG_POOL_MAX',
    group: 'data',
    required: true,
    sensitive: false,
    example: '5',
    description: 'Caps the hosted Postgres pool per server instance.',
  },
  {
    name: 'AUTHOROS_PG_IDLE_TIMEOUT_MS',
    group: 'data',
    required: true,
    sensitive: false,
    example: '5000',
    description: 'Closes idle Postgres connections promptly in serverless runtimes.',
  },
  {
    name: 'NEXT_PUBLIC_APP_URL',
    group: 'app',
    required: true,
    sensitive: false,
    example: 'https://author.arcanea.ai',
    description: 'Canonical HTTPS URL for auth callbacks, webhooks, and public links.',
  },
  {
    name: 'CLERK_SECRET_KEY',
    group: 'auth',
    required: true,
    sensitive: true,
    example: 'sk_live_replace_me',
    description: 'Clerk server secret key.',
  },
  {
    name: 'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY',
    group: 'auth',
    required: true,
    sensitive: false,
    example: 'pk_live_replace_me',
    description: 'Clerk browser publishable key.',
  },
  {
    name: 'NEXT_PUBLIC_CLERK_SIGN_IN_URL',
    group: 'auth',
    required: true,
    sensitive: false,
    example: '/sign-in',
    description: 'Hosted sign-in route.',
  },
  {
    name: 'NEXT_PUBLIC_CLERK_SIGN_UP_URL',
    group: 'auth',
    required: true,
    sensitive: false,
    example: '/sign-up',
    description: 'Hosted sign-up route.',
  },
  {
    name: 'AUTHOROS_MCP_AUTHORIZATION_SERVER_URL',
    group: 'auth',
    required: true,
    sensitive: false,
    example: 'https://auth.replace-me.example.com',
    description: 'OAuth authorization server advertised by hosted MCP protected-resource metadata.',
  },
  {
    name: 'POSTGRES_URL',
    group: 'data',
    required: true,
    aliases: ['DATABASE_URL'],
    sensitive: true,
    example: 'postgres://user:password@host.neon.tech/db?sslmode=require',
    description: 'Vercel Marketplace Postgres connection string. DATABASE_URL is accepted as an alias.',
  },
  {
    name: 'BLOB_READ_WRITE_TOKEN',
    group: 'assets',
    required: true,
    sensitive: true,
    example: 'vercel_blob_rw_replace_me',
    description: 'Vercel Blob token for private author assets.',
  },
  {
    name: 'STRIPE_SECRET_KEY',
    group: 'billing',
    required: true,
    sensitive: true,
    example: 'sk_live_replace_me',
    description: 'Stripe server secret key.',
  },
  {
    name: 'STRIPE_WEBHOOK_SECRET',
    group: 'billing',
    required: true,
    sensitive: true,
    example: 'whsec_replace_me',
    description: 'Stripe webhook signing secret.',
  },
  {
    name: 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
    group: 'billing',
    required: true,
    sensitive: false,
    example: 'pk_live_replace_me',
    description: 'Stripe browser publishable key.',
  },
  {
    name: 'STRIPE_BILLING_PORTAL_CONFIGURATION',
    group: 'billing',
    recommended: true,
    sensitive: false,
    example: 'bpc_replace_me',
    description: 'Optional Stripe Customer Portal configuration id for subscription management sessions.',
  },
  {
    name: 'STRIPE_PRICE_PRO_LOCAL',
    group: 'billing',
    required: true,
    sensitive: false,
    example: 'price_replace_pro_local',
    description: 'Stripe recurring price for Pro Local.',
  },
  {
    name: 'STRIPE_PRICE_CLOUD_CREATOR',
    group: 'billing',
    required: true,
    sensitive: false,
    example: 'price_replace_cloud_creator',
    description: 'Stripe recurring price for Cloud Creator.',
  },
  {
    name: 'STRIPE_PRICE_CLOUD_STUDIO',
    group: 'billing',
    required: true,
    sensitive: false,
    example: 'price_replace_cloud_studio',
    description: 'Stripe recurring price for Cloud Studio.',
  },
  {
    name: 'STRIPE_PRICE_AGENCY_SMALL_PRESS',
    group: 'billing',
    required: true,
    sensitive: false,
    example: 'price_replace_agency_small_press',
    description: 'Stripe recurring price for Agency / Small Press.',
  },
  {
    name: 'STRIPE_PRICE_FOUNDER_LIFETIME_LOCAL',
    group: 'offers',
    recommended: true,
    sensitive: false,
    example: 'price_replace_founder_lifetime',
    description: 'Launch price for founder lifetime local access.',
  },
  {
    name: 'STRIPE_PRICE_FOUNDRY_PACK',
    group: 'offers',
    recommended: true,
    sensitive: false,
    example: 'price_replace_foundry_pack',
    description: 'One-time Stripe price for the first paid Foundry Pack.',
  },
  {
    name: 'STRIPE_PRICE_CONCIERGE_SETUP',
    group: 'offers',
    recommended: true,
    sensitive: false,
    example: 'price_replace_concierge_setup',
    description: 'Launch price for concierge setup.',
  },
  {
    name: 'STRIPE_PRICE_AGENTIC_SERVICE_SPRINT',
    group: 'offers',
    recommended: true,
    sensitive: false,
    example: 'price_replace_service_sprint',
    description: 'Launch price for agentic service sprints.',
  },
  {
    name: 'AI_GATEWAY_API_KEY',
    group: 'ai',
    required: true,
    aliases: ['VERCEL_AI_GATEWAY_API_KEY'],
    sensitive: true,
    example: 'vck_replace_me',
    description: 'Vercel AI Gateway key for managed agent runs. VERCEL_AI_GATEWAY_API_KEY is accepted as an alias.',
  },
  {
    name: 'AUTHOROS_MODEL_EXTRACTOR',
    group: 'ai',
    recommended: true,
    sensitive: false,
    example: 'provider/model-from-ai-gateway-catalog',
    description: 'AI Gateway model id for extraction, classification, and import cleanup tasks.',
  },
  {
    name: 'AUTHOROS_MODEL_CONTINUITY',
    group: 'ai',
    recommended: true,
    sensitive: false,
    example: 'provider/model-from-ai-gateway-catalog',
    description: 'AI Gateway model id for continuity, timeline, and reasoning-heavy story checks.',
  },
  {
    name: 'AUTHOROS_MODEL_PROSE',
    group: 'ai',
    recommended: true,
    sensitive: false,
    example: 'provider/model-from-ai-gateway-catalog',
    description: 'AI Gateway model id for drafting and voice-preserving revision.',
  },
  {
    name: 'AUTHOROS_MODEL_VISUAL',
    group: 'ai',
    recommended: true,
    sensitive: false,
    example: 'provider/model-from-ai-gateway-catalog',
    description: 'AI Gateway model id for visual briefs, multimodal review, and image-adjacent tasks.',
  },
  {
    name: 'AUTHOROS_MODEL_OPERATIONS',
    group: 'ai',
    recommended: true,
    sensitive: false,
    example: 'provider/model-from-ai-gateway-catalog',
    description: 'AI Gateway model id for export, metadata, support, and low-cost operational tasks.',
  },
  {
    name: 'AUTHOROS_AI_PROVIDER_ORDER',
    group: 'ai',
    recommended: true,
    sensitive: false,
    example: 'anthropic,bedrock',
    description: 'Optional AI Gateway provider failover order.',
  },
  {
    name: 'AUTHOROS_AI_FALLBACK_MODELS',
    group: 'ai',
    recommended: true,
    sensitive: false,
    example: 'provider/fallback-model',
    description: 'Optional comma-separated AI Gateway fallback model ids.',
  },
  {
    name: 'AUTHOROS_AI_MAX_INPUT_TOKENS',
    group: 'ai',
    recommended: true,
    sensitive: false,
    example: '24000',
    description: 'Pre-flight prompt budget for managed model calls.',
  },
  {
    name: 'AUTHOROS_AI_MAX_OUTPUT_TOKENS',
    group: 'ai',
    recommended: true,
    sensitive: false,
    example: '1200',
    description: 'Default output budget for managed model calls.',
  },
  {
    name: 'SENTRY_DSN',
    group: 'observability',
    recommended: true,
    sensitive: true,
    example: 'https://replace@sentry.io/project',
    description: 'Sentry DSN for production error capture.',
  },
  {
    name: 'NEXT_PUBLIC_POSTHOG_KEY',
    group: 'observability',
    recommended: true,
    sensitive: false,
    example: 'phc_replace_me',
    description: 'PostHog browser key for activation analytics.',
  },
  {
    name: 'NEXT_PUBLIC_POSTHOG_HOST',
    group: 'observability',
    recommended: true,
    sensitive: false,
    example: 'https://us.i.posthog.com',
    description: 'PostHog host.',
  },
  {
    name: 'AUTHOROS_VERCEL_PROTECTION_BYPASS',
    group: 'verification',
    recommended: true,
    aliases: ['VERCEL_AUTOMATION_BYPASS_SECRET'],
    sensitive: true,
    example: 'vercel_protection_bypass_replace_me',
    description: 'Vercel Protection Bypass for Automation secret used by live preview verification. VERCEL_AUTOMATION_BYPASS_SECRET is accepted as an alias.',
  },
];

function resolveEnvSpecStatus(spec, env = {}) {
  const names = [spec.name, ...(spec.aliases || [])];
  const configuredName = names.find(name => Boolean(env[name])) || null;
  const rawValue = configuredName ? String(env[configuredName]) : '';
  const validation = configuredName
    ? validateProductionEnvValue(configuredName, rawValue)
    : { valid: false, reason: 'missing' };
  const expectedMatches = spec.expected
    ? validation.valid && rawValue.toLowerCase() === String(spec.expected).toLowerCase()
    : validation.valid && Boolean(rawValue);
  const configured = Boolean(configuredName);
  const status = expectedMatches
    ? 'pass'
    : validation.reason === 'placeholder'
      ? 'placeholder'
      : configured && validation.reason && validation.reason !== 'missing'
        ? 'wrong_value'
        : spec.required
          ? configured && spec.expected ? 'wrong_value' : 'missing'
          : spec.recommended
            ? configured && spec.expected ? 'wrong_value' : 'recommended'
            : 'optional';
  const valueState = !configured
    ? 'missing'
    : validation.reason === 'placeholder'
      ? 'placeholder'
      : validation.valid
        ? 'configured'
        : 'invalid';

  return {
    ...spec,
    aliases: spec.aliases || [],
    configured,
    configuredName,
    status,
    valueState,
    validationReason: validation.reason && validation.reason !== 'missing' ? validation.reason : null,
    expected: spec.expected || null,
    current: configured ? spec.sensitive ? 'redacted' : rawValue : null,
  };
}

function summarizeEnvFailures(specs, required) {
  return specs
    .filter(spec => Boolean(required ? spec.required : spec.recommended) && spec.status !== 'pass')
    .map(spec => spec.name);
}

function summarizeEnvFailureByState(specs, state, required) {
  return specs
    .filter(spec => Boolean(required ? spec.required : spec.recommended) && spec.valueState === state)
    .map(spec => spec.name);
}

export function createProductionEnvContract(env = {}, options = {}) {
  const specs = (options.specs || AUTHOR_OS_PRODUCTION_ENV_CONTRACT)
    .map(spec => resolveEnvSpecStatus(spec, env));
  const required = specs.filter(spec => spec.required);
  const recommended = specs.filter(spec => spec.recommended);
  const missingRequired = required.filter(spec => spec.status !== 'pass');
  const missingRecommended = recommended.filter(spec => spec.status !== 'pass');
  const groups = {};

  for (const spec of specs) {
    if (!groups[spec.group]) groups[spec.group] = { total: 0, ready: 0, missing: 0, recommended: 0 };
    groups[spec.group].total += 1;
    if (spec.status === 'pass') groups[spec.group].ready += 1;
    if (spec.required && spec.status !== 'pass') groups[spec.group].missing += 1;
    if (spec.recommended && spec.status !== 'pass') groups[spec.group].recommended += 1;
  }

  return {
    status: missingRequired.length ? 'blocked' : missingRecommended.length ? 'needs_review' : 'ready',
    generatedAt: new Date().toISOString(),
    requiredCount: required.length,
    requiredReadyCount: required.length - missingRequired.length,
    recommendedCount: recommended.length,
    recommendedReadyCount: recommended.length - missingRecommended.length,
    missingRequired: summarizeEnvFailures(specs, true),
    missingRecommended: summarizeEnvFailures(specs, false),
    placeholderRequired: summarizeEnvFailureByState(specs, 'placeholder', true),
    placeholderRecommended: summarizeEnvFailureByState(specs, 'placeholder', false),
    invalidRequired: summarizeEnvFailureByState(specs, 'invalid', true),
    invalidRecommended: summarizeEnvFailureByState(specs, 'invalid', false),
    groups,
    specs,
  };
}

export function renderProductionEnvExample(options = {}) {
  const specs = options.specs || AUTHOR_OS_PRODUCTION_ENV_CONTRACT;
  const groupOrder = options.groupOrder || ['runtime', 'auth', 'entitlements', 'data', 'app', 'assets', 'billing', 'offers', 'ai', 'observability', 'verification'];
  const specsByGroup = new Map();
  for (const spec of specs) {
    if (!specsByGroup.has(spec.group)) specsByGroup.set(spec.group, []);
    specsByGroup.get(spec.group).push(spec);
  }
  const lines = [
    '# Arcanea Author Cockpit production environment',
    '# Copy values into Vercel Project Settings or add them with `vercel env add`.',
    '# Do not commit real secrets. This file contains placeholders only.',
    '',
  ];

  for (const group of groupOrder) {
    const groupedSpecs = specsByGroup.get(group) || [];
    if (!groupedSpecs.length) continue;
    lines.push('', `# ${group.toUpperCase()}`);
    for (const spec of groupedSpecs) {
      lines.push(`# ${spec.description}`);
      if (spec.aliases?.length) lines.push(`# Accepted alias: ${spec.aliases.join(', ')}`);
      lines.push(`${spec.name}=${spec.example || ''}`);
    }
  }

  return `${lines.join('\n').replace(/\n{3,}/g, '\n\n')}\n`;
}

export function createVercelEnvCommandPlan(input = {}) {
  const specs = input.specs || AUTHOR_OS_PRODUCTION_ENV_CONTRACT;
  const environments = input.environments || ['production', 'preview'];
  const project = input.project || 'author-os';
  const previewBranch = input.previewBranch || '';
  const productionBranch = input.productionBranch || input.env?.VERCEL_GIT_PRODUCTION_BRANCH || input.env?.AUTHOROS_PRODUCTION_BRANCH || 'main';
  const normalizedEnvironments = environments.map(normalizeVercelEnvironmentName);
  const previewBranchProductionConflict = Boolean(previewBranch)
    && normalizedEnvironments.includes('preview')
    && isProductionGitBranch(previewBranch, productionBranch);
  const previewBranchUsable = Boolean(previewBranch) && !previewBranchProductionConflict;
  const commands = [];

  for (const spec of specs) {
    for (const environment of environments) {
      const normalizedEnvironment = normalizeVercelEnvironmentName(environment);
      const envTarget = normalizedEnvironment === 'preview' && previewBranchUsable
        ? `${normalizedEnvironment} ${previewBranch}`
        : normalizedEnvironment === 'preview' && previewBranchProductionConflict
          ? `${normalizedEnvironment} <non-production-branch>`
        : normalizedEnvironment;
      commands.push({
        name: spec.name,
        environment,
        previewBranch: normalizedEnvironment === 'preview' && previewBranchUsable ? previewBranch : null,
        requestedPreviewBranch: normalizedEnvironment === 'preview' && previewBranch ? previewBranch : null,
        productionBranch: normalizedEnvironment === 'preview' ? productionBranch : null,
        requiresPreviewBranch: normalizedEnvironment === 'preview' && !previewBranchUsable,
        previewBranchProductionConflict: normalizedEnvironment === 'preview' && previewBranchProductionConflict,
        group: spec.group,
        required: Boolean(spec.required),
        recommended: Boolean(spec.recommended),
        sensitive: Boolean(spec.sensitive),
        command: `vercel env add ${spec.name} ${envTarget}`,
        previewBranchCommand: normalizedEnvironment === 'preview'
          ? `vercel env add ${spec.name} preview <gitbranch>`
          : null,
      });
    }
  }

  return {
    project,
    environments,
    previewBranch: previewBranchUsable ? previewBranch : null,
    requestedPreviewBranch: previewBranch || null,
    productionBranch,
    previewBranchProductionConflict,
    previewBranchRequired: commands.some(command => command.requiresPreviewBranch),
    commandCount: commands.length,
    commands,
    note: previewBranchProductionConflict
      ? `Preview branch "${previewBranch}" matches the production branch "${productionBranch}". Use --preview-branch <non-production-branch> before applying Preview env commands.`
      : previewBranchUsable
      ? `Commands intentionally omit values. Preview commands are scoped to branch "${previewBranch}". Paste values into Vercel CLI prompts or Project Settings.`
      : 'Commands intentionally omit values. Paste values into Vercel CLI prompts or Project Settings. Vercel CLI non-interactive preview writes may require a Git branch; pass --preview-branch <branch> for branch-scoped preview commands.',
  };
}

function resolveApplyEnvSpec(inputName, specs = AUTHOR_OS_PRODUCTION_ENV_CONTRACT) {
  return specs.find(spec => spec.name === inputName || (spec.aliases || []).includes(inputName)) || null;
}

function findConfiguredApplyName(spec, env = {}) {
  return [spec.name, ...(spec.aliases || [])].find(name => Object.prototype.hasOwnProperty.call(env, name) && normalizeEnvValue(env[name])) || null;
}

function resolveVercelEnvTarget(environment, previewBranch, previewBranchProductionConflict) {
  const normalizedEnvironment = normalizeVercelEnvironmentName(environment);
  if (normalizedEnvironment === 'preview' && previewBranch && !previewBranchProductionConflict) {
    return `${normalizedEnvironment} ${previewBranch}`;
  }
  if (normalizedEnvironment === 'preview' && previewBranchProductionConflict) {
    return `${normalizedEnvironment} <non-production-branch>`;
  }
  return normalizedEnvironment;
}

export function createVercelEnvApplyPlan(input = {}) {
  const specs = input.specs || AUTHOR_OS_PRODUCTION_ENV_CONTRACT;
  const env = input.env || {};
  const environments = input.environments || ['production', 'preview'];
  const project = input.project || 'author-os';
  const previewBranch = input.previewBranch || '';
  const productionBranch = input.productionBranch || env.VERCEL_GIT_PRODUCTION_BRANCH || env.AUTHOROS_PRODUCTION_BRANCH || 'main';
  const includeRecommended = Boolean(input.includeRecommended);
  const normalizedEnvironments = environments.map(normalizeVercelEnvironmentName);
  const previewBranchProductionConflict = Boolean(previewBranch)
    && normalizedEnvironments.includes('preview')
    && isProductionGitBranch(previewBranch, productionBranch);
  const previewBranchUsable = Boolean(previewBranch) && !previewBranchProductionConflict;
  const explicitNames = Array.isArray(input.names) ? input.names.filter(Boolean) : [];
  const defaultNames = specs
    .filter(spec => (spec.required || (includeRecommended && spec.recommended)) && findConfiguredApplyName(spec, env))
    .map(spec => spec.name);
  const requestedNames = [...new Set(explicitNames.length ? explicitNames : defaultNames)];
  const unknownNames = [];
  const records = [];
  const commands = [];

  for (const requestedName of requestedNames) {
    const spec = resolveApplyEnvSpec(requestedName, specs);
    if (!spec) {
      unknownNames.push(requestedName);
      records.push({
        name: requestedName,
        requestedName,
        status: 'unknown',
        valueState: 'unknown',
        sensitive: true,
        environments: [],
        validationReason: 'unknown_env_name',
      });
      continue;
    }

    const status = resolveEnvSpecStatus(spec, env);
    const ready = status.status === 'pass';
    const record = {
      name: spec.name,
      requestedName,
      configuredName: status.configuredName,
      group: spec.group,
      required: Boolean(spec.required),
      recommended: Boolean(spec.recommended),
      sensitive: Boolean(spec.sensitive),
      status: ready ? 'ready' : status.valueState === 'missing' ? 'missing' : 'invalid',
      valueState: status.valueState,
      validationReason: status.validationReason,
      environments: normalizedEnvironments,
      aliases: spec.aliases || [],
    };
    records.push(record);

    if (!ready) continue;

    for (const environment of normalizedEnvironments) {
      const envTarget = resolveVercelEnvTarget(environment, previewBranchUsable ? previewBranch : '', previewBranchProductionConflict);
      commands.push({
        name: spec.name,
        configuredName: status.configuredName,
        environment,
        previewBranch: environment === 'preview' && previewBranchUsable ? previewBranch : null,
        requestedPreviewBranch: environment === 'preview' && previewBranch ? previewBranch : null,
        productionBranch: environment === 'preview' ? productionBranch : null,
        requiresPreviewBranch: environment === 'preview' && !previewBranchUsable,
        previewBranchProductionConflict: environment === 'preview' && previewBranchProductionConflict,
        group: spec.group,
        required: Boolean(spec.required),
        recommended: Boolean(spec.recommended),
        sensitive: Boolean(spec.sensitive),
        valueState: 'redacted',
        command: `vercel env add ${spec.name} ${envTarget} --value <redacted> --yes ${spec.sensitive ? '--sensitive' : '--no-sensitive'} --force`,
      });
    }
  }

  const missing = records.filter(record => record.status === 'missing').map(record => record.name);
  const invalid = records.filter(record => record.status === 'invalid').map(record => record.name);
  const ready = records.filter(record => record.status === 'ready').map(record => record.name);
  const blocked = unknownNames.length || missing.length || invalid.length || previewBranchProductionConflict || commands.some(command => command.requiresPreviewBranch);

  return {
    project,
    environments: normalizedEnvironments,
    previewBranch: previewBranchUsable ? previewBranch : null,
    requestedPreviewBranch: previewBranch || null,
    productionBranch,
    previewBranchProductionConflict,
    includeRecommended,
    generatedAt: new Date().toISOString(),
    status: blocked ? 'blocked' : ready.length ? 'ready' : 'empty',
    requestedCount: requestedNames.length,
    readyCount: ready.length,
    commandCount: commands.length,
    records,
    commands,
    ready,
    missing,
    invalid,
    unknownNames,
    note: 'Values are validated locally and redacted from this plan. When --apply is used, the CLI sends values to Vercel via stdin and never prints them.',
  };
}

function quoteBashValue(value) {
  return `'${String(value).replace(/'/g, "'\"'\"'")}'`;
}

function quotePowerShellValue(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function quoteCliValue(value) {
  const text = String(value);
  if (/^[A-Za-z0-9_./:=,@-]+$/.test(text)) return text;
  return `"${text.replace(/"/g, '\\"')}"`;
}

function createBaselineValueMap(input = {}) {
  const env = input.env || {};
  const appUrl = normalizeHttpsOrLocalOrigin(input.appUrl || env.NEXT_PUBLIC_APP_URL || env.VERCEL_PROJECT_PRODUCTION_URL);
  const values = {
    AUTHOROS_DEMO_MODE: 'false',
    AUTHOROS_REQUIRE_AUTH: 'true',
    AUTHOROS_AUTH_PROVIDER: 'clerk',
    AUTHOROS_ALLOW_TRUSTED_AUTH_HEADERS: 'false',
    AUTHOROS_DEFAULT_PLAN: input.defaultPlan || env.AUTHOROS_DEFAULT_PLAN || 'cloud-creator',
    AUTHOROS_DEFAULT_AUTH_ROLE: input.defaultRole || env.AUTHOROS_DEFAULT_AUTH_ROLE || 'editor',
    AUTHOROS_PROJECT_ADAPTER: 'postgres',
    AUTHOROS_DB_MIGRATION_VERSION: '001_author_os_cloud',
    AUTHOROS_MIGRATION_APPLIED_BY: input.migrationAppliedBy || env.AUTHOROS_MIGRATION_APPLIED_BY || 'author-os-cli',
    AUTHOROS_PG_POOL_MAX: String(input.pgPoolMax || env.AUTHOROS_PG_POOL_MAX || '5'),
    AUTHOROS_PG_IDLE_TIMEOUT_MS: String(input.pgIdleTimeoutMs || env.AUTHOROS_PG_IDLE_TIMEOUT_MS || '5000'),
    NEXT_PUBLIC_CLERK_SIGN_IN_URL: input.signInUrl || env.NEXT_PUBLIC_CLERK_SIGN_IN_URL || '/sign-in',
    NEXT_PUBLIC_CLERK_SIGN_UP_URL: input.signUpUrl || env.NEXT_PUBLIC_CLERK_SIGN_UP_URL || '/sign-up',
    AUTHOROS_AI_MAX_INPUT_TOKENS: String(input.maxInputTokens || env.AUTHOROS_AI_MAX_INPUT_TOKENS || '24000'),
    AUTHOROS_AI_MAX_OUTPUT_TOKENS: String(input.maxOutputTokens || env.AUTHOROS_AI_MAX_OUTPUT_TOKENS || '1200'),
    NEXT_PUBLIC_POSTHOG_HOST: input.posthogHost || env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
  };
  if (appUrl) values.NEXT_PUBLIC_APP_URL = appUrl;
  return values;
}

export function createVercelEnvBaselinePlan(input = {}) {
  const specs = input.specs || AUTHOR_OS_PRODUCTION_ENV_CONTRACT;
  const environments = input.environments || ['production', 'preview'];
  const project = input.project || 'author-os';
  const previewBranch = input.previewBranch || '';
  const productionBranch = input.productionBranch || input.env?.VERCEL_GIT_PRODUCTION_BRANCH || input.env?.AUTHOROS_PRODUCTION_BRANCH || 'main';
  const normalizedEnvironments = environments.map(normalizeVercelEnvironmentName);
  const previewBranchProductionConflict = Boolean(previewBranch)
    && normalizedEnvironments.includes('preview')
    && isProductionGitBranch(previewBranch, productionBranch);
  const previewBranchUsable = Boolean(previewBranch) && !previewBranchProductionConflict;
  const values = createBaselineValueMap(input);
  const specsByName = new Map(specs.map(spec => [spec.name, spec]));
  const commands = [];
  const manualCommands = [];
  const skippedSensitiveDefaults = [];

  for (const [name, value] of Object.entries(values)) {
    const spec = specsByName.get(name);
    if (!spec || spec.sensitive) {
      if (spec?.sensitive) skippedSensitiveDefaults.push(name);
      continue;
    }
    for (const environment of environments) {
      const normalizedEnvironment = normalizeVercelEnvironmentName(environment);
      const envTarget = normalizedEnvironment === 'preview' && previewBranchUsable
        ? `${normalizedEnvironment} ${previewBranch}`
        : normalizedEnvironment === 'preview' && previewBranchProductionConflict
          ? `${normalizedEnvironment} <non-production-branch>`
        : normalizedEnvironment;
      const baseCommand = `vercel env add ${name} ${envTarget}`;
      const valueFlagCommand = `${baseCommand} --value ${quoteCliValue(value)} --yes --no-sensitive --force`;
      const branchCommand = normalizedEnvironment === 'preview'
        ? `vercel env add ${name} preview <non-production-branch> --value ${quoteCliValue(value)} --yes --no-sensitive --force`
        : null;
      commands.push({
        name,
        value,
        environment,
        previewBranch: normalizedEnvironment === 'preview' && previewBranchUsable ? previewBranch : null,
        requestedPreviewBranch: normalizedEnvironment === 'preview' && previewBranch ? previewBranch : null,
        productionBranch: normalizedEnvironment === 'preview' ? productionBranch : null,
        requiresPreviewBranch: normalizedEnvironment === 'preview' && !previewBranchUsable,
        previewBranchProductionConflict: normalizedEnvironment === 'preview' && previewBranchProductionConflict,
        group: spec.group,
        required: Boolean(spec.required),
        recommended: Boolean(spec.recommended),
        sensitive: false,
        command: valueFlagCommand,
        bashCommand: valueFlagCommand,
        powershellCommand: valueFlagCommand,
        stdinBashCommand: `printf '%s\\n' ${quoteBashValue(value)} | ${baseCommand}`,
        stdinPowerShellCommand: `${quotePowerShellValue(value)} | ${baseCommand}`,
        previewBranchCommand: branchCommand,
      });
    }
  }

  const baselineNames = new Set(commands.map(command => command.name));
  for (const spec of specs.filter(item => (item.required || item.recommended) && !baselineNames.has(item.name))) {
    for (const environment of environments) {
      const normalizedEnvironment = normalizeVercelEnvironmentName(environment);
      const envTarget = normalizedEnvironment === 'preview' && previewBranchUsable
        ? `${normalizedEnvironment} ${previewBranch}`
        : normalizedEnvironment === 'preview' && previewBranchProductionConflict
          ? `${normalizedEnvironment} <non-production-branch>`
        : normalizedEnvironment;
      manualCommands.push({
        name: spec.name,
        environment,
        previewBranch: normalizedEnvironment === 'preview' && previewBranchUsable ? previewBranch : null,
        requestedPreviewBranch: normalizedEnvironment === 'preview' && previewBranch ? previewBranch : null,
        productionBranch: normalizedEnvironment === 'preview' ? productionBranch : null,
        requiresPreviewBranch: normalizedEnvironment === 'preview' && !previewBranchUsable,
        previewBranchProductionConflict: normalizedEnvironment === 'preview' && previewBranchProductionConflict,
        group: spec.group,
        required: Boolean(spec.required),
        recommended: Boolean(spec.recommended),
        sensitive: Boolean(spec.sensitive),
        reason: spec.sensitive ? 'secret_or_token' : 'provider_specific_value',
        command: `vercel env add ${spec.name} ${envTarget}`,
        previewBranchCommand: normalizedEnvironment === 'preview'
          ? `vercel env add ${spec.name} preview <non-production-branch>`
          : null,
      });
    }
  }

  return {
    project,
    environments,
    appUrl: values.NEXT_PUBLIC_APP_URL || null,
    commandCount: commands.length,
    baselineNameCount: baselineNames.size,
    manualCommandCount: manualCommands.length,
    manualNameCount: new Set(manualCommands.map(command => command.name)).size,
    commands,
    manualCommands,
    skippedSensitiveDefaults,
    previewBranch: previewBranchUsable ? previewBranch : null,
    requestedPreviewBranch: previewBranch || null,
    productionBranch,
    previewBranchProductionConflict,
    previewBranchRequired: commands.some(command => command.requiresPreviewBranch),
    note: previewBranchProductionConflict
      ? `Preview branch "${previewBranch}" matches the production branch "${productionBranch}". Use --preview-branch <non-production-branch> before applying safe Preview baseline values. Secrets, provider keys, price ids, database URLs, and OAuth issuer URLs remain manual/redacted.`
      : previewBranchUsable
      ? `Baseline commands contain only deterministic non-secret values. Preview commands are scoped to branch "${previewBranch}". Secrets, provider keys, price ids, database URLs, and OAuth issuer URLs remain manual/redacted.`
      : 'Baseline commands contain only deterministic non-secret values. Vercel CLI non-interactive preview env writes may require a Git branch; pass --preview-branch <branch> for branch-scoped preview commands. Secrets, provider keys, price ids, database URLs, and OAuth issuer URLs remain manual/redacted.',
  };
}

function stripAnsi(value = '') {
  return String(value).replace(/\x1b\[[0-9;]*m/g, '');
}

function normalizeVercelEnvironmentName(value = '') {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'prod') return 'production';
  if (normalized === 'preview') return 'preview';
  if (normalized === 'dev') return 'development';
  if (normalized.startsWith('preview ')) return 'preview';
  if (normalized.startsWith('preview(')) return 'preview';
  if (normalized.startsWith('preview/')) return 'preview';
  if (normalized.startsWith('preview:')) return 'preview';
  if (normalized.startsWith('production ')) return 'production';
  if (normalized.startsWith('production(')) return 'production';
  if (normalized.startsWith('development ')) return 'development';
  if (normalized.startsWith('development(')) return 'development';
  if (normalized === 'production' || normalized === 'development') return normalized;
  return normalized;
}

function normalizeGitBranchName(value = '') {
  return String(value || '').trim().replace(/^refs\/heads\//, '').toLowerCase();
}

function isProductionGitBranch(branch, productionBranch = 'main') {
  const normalizedBranch = normalizeGitBranchName(branch);
  const normalizedProductionBranch = normalizeGitBranchName(productionBranch || 'main');
  if (!normalizedBranch) return false;
  return normalizedBranch === normalizedProductionBranch
    || ['main', 'master', 'production', 'prod'].includes(normalizedBranch);
}

export function parseVercelEnvListOutput(output = '') {
  const entries = [];
  const lines = stripAnsi(output).split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('>') || line.startsWith('-') || line.startsWith('Common next commands')) continue;
    if (/^(name|Vercel CLI|Retrieving project)/i.test(line)) continue;
    const columns = line.split(/\s{2,}/).map(item => item.trim()).filter(Boolean);
    if (columns.length < 3) continue;
    const [name, valueState, environmentColumn] = columns;
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) continue;
    if (!/encrypted|plain|system|secret/i.test(valueState)) continue;
    const environments = environmentColumn
      .split(',')
      .map(normalizeVercelEnvironmentName)
      .filter(Boolean);
    if (!environments.length) continue;
    entries.push({
      name,
      valueState: valueState.toLowerCase(),
      environments,
    });
  }

  return entries;
}

function remoteEntriesHaveName(entries = [], names = [], environment) {
  const wantedEnvironment = normalizeVercelEnvironmentName(environment);
  for (const entry of entries) {
    if (!names.includes(entry.name)) continue;
    if (entry.environments.map(normalizeVercelEnvironmentName).includes(wantedEnvironment)) {
      return entry.name;
    }
  }
  return null;
}

function createRemoteEnvSpecAudit(spec, entries, environments) {
  const names = [spec.name, ...(spec.aliases || [])];
  const environmentPresence = environments.map(environment => {
    const matchedName = remoteEntriesHaveName(entries, names, environment);
    return {
      environment,
      present: Boolean(matchedName),
      matchedName,
    };
  });
  const presentInAllEnvironments = environmentPresence.every(item => item.present);
  return {
    name: spec.name,
    group: spec.group,
    aliases: spec.aliases || [],
    required: Boolean(spec.required),
    recommended: Boolean(spec.recommended),
    sensitive: Boolean(spec.sensitive),
    environments: environmentPresence,
    presentInAllEnvironments,
    status: presentInAllEnvironments ? 'present_unverified' : spec.required ? 'missing' : 'recommended',
  };
}

export function createVercelRemoteEnvAudit(input = {}) {
  const project = input.project || 'author-os';
  const environments = (input.environments || ['production', 'preview']).map(normalizeVercelEnvironmentName);
  const entries = Array.isArray(input.entries)
    ? input.entries.map(entry => ({
        ...entry,
        environments: (entry.environments || []).map(normalizeVercelEnvironmentName),
      }))
    : parseVercelEnvListOutput(input.output || '');
  const specs = input.specs || AUTHOR_OS_PRODUCTION_ENV_CONTRACT;
  const baselinePlan = input.baselinePlan || createVercelEnvBaselinePlan({
    project,
    environments,
    appUrl: input.appUrl,
    env: input.env,
    previewBranch: input.previewBranch,
  });
  const specAudits = specs.map(spec => createRemoteEnvSpecAudit(spec, entries, environments));
  const required = specAudits.filter(spec => spec.required);
  const recommended = specAudits.filter(spec => spec.recommended);
  const missingRequired = required.filter(spec => !spec.presentInAllEnvironments).map(spec => spec.name);
  const missingRecommended = recommended.filter(spec => !spec.presentInAllEnvironments).map(spec => spec.name);
  const baselineNames = [...new Set(baselinePlan.commands.map(command => command.name))];
  const baselinePresence = baselineNames.map(name => {
    const environmentPresence = environments.map(environment => {
      const matchedName = remoteEntriesHaveName(entries, [name], environment);
      return { environment, present: Boolean(matchedName), matchedName };
    });
    return {
      name,
      environments: environmentPresence,
      presentInAllEnvironments: environmentPresence.every(item => item.present),
    };
  });
  const missingBaseline = baselinePresence.filter(item => !item.presentInAllEnvironments).map(item => item.name);
  const presentBaseline = baselinePresence.filter(item => item.presentInAllEnvironments).map(item => item.name);
  const environmentSummaries = Object.fromEntries(environments.map(environment => {
    const missingRequiredForEnvironment = required
      .filter(spec => !(spec.environments || []).find(item => item.environment === environment)?.present)
      .map(spec => spec.name);
    const missingRecommendedForEnvironment = recommended
      .filter(spec => !(spec.environments || []).find(item => item.environment === environment)?.present)
      .map(spec => spec.name);
    const missingBaselineForEnvironment = baselinePresence
      .filter(item => !(item.environments || []).find(envItem => envItem.environment === environment)?.present)
      .map(item => item.name);
    return [environment, {
      status: missingRequiredForEnvironment.length ? 'blocked' : 'needs_value_validation',
      requiredPresentCount: required.length - missingRequiredForEnvironment.length,
      requiredCount: required.length,
      recommendedPresentCount: recommended.length - missingRecommendedForEnvironment.length,
      recommendedCount: recommended.length,
      baselinePresentCount: baselinePresence.length - missingBaselineForEnvironment.length,
      baselineNameCount: baselinePresence.length,
      missingRequiredCount: missingRequiredForEnvironment.length,
      missingRecommendedCount: missingRecommendedForEnvironment.length,
      missingBaselineCount: missingBaselineForEnvironment.length,
      missingRequired: missingRequiredForEnvironment,
      missingRecommended: missingRecommendedForEnvironment,
      missingBaseline: missingBaselineForEnvironment,
    }];
  }));

  return {
    project,
    environments,
    generatedAt: new Date().toISOString(),
    status: missingRequired.length ? 'blocked' : 'needs_value_validation',
    entryCount: entries.length,
    entries,
    summary: {
      requiredPresentCount: required.length - missingRequired.length,
      requiredCount: required.length,
      recommendedPresentCount: recommended.length - missingRecommended.length,
      recommendedCount: recommended.length,
      baselinePresentCount: presentBaseline.length,
      baselineNameCount: baselinePresence.length,
      missingRequiredCount: missingRequired.length,
      missingRecommendedCount: missingRecommended.length,
      missingBaselineCount: missingBaseline.length,
    },
    environmentSummaries,
    missingRequired,
    missingRecommended,
    baseline: {
      present: presentBaseline,
      missing: missingBaseline,
      entries: baselinePresence,
    },
    specs: specAudits,
    note: 'Vercel env listing proves name/environment presence only. Values are encrypted and must still be validated through pulled env files, provider dashboards, migration checks, and live readiness gates.',
  };
}

function scrubSetupEnvSpec(spec) {
  return {
    name: spec.name,
    group: spec.group,
    aliases: spec.aliases || [],
    required: Boolean(spec.required),
    recommended: Boolean(spec.recommended),
    sensitive: Boolean(spec.sensitive),
    configured: Boolean(spec.configured),
    configuredName: spec.configuredName,
    status: spec.status,
    valueState: spec.valueState,
    expected: spec.expected || null,
    description: spec.description,
  };
}

function resolveSetupEnvStatus(envContract, names = []) {
  const wanted = new Set(names);
  const specs = envContract.specs.filter(spec => wanted.has(spec.name) || (spec.aliases || []).some(alias => wanted.has(alias)));
  const missingRequired = specs.filter(spec => spec.required && spec.status !== 'pass').map(spec => spec.name);
  const missingRecommended = specs.filter(spec => spec.recommended && spec.status !== 'pass').map(spec => spec.name);
  const wrongValue = specs.filter(spec => spec.status === 'wrong_value').map(spec => spec.name);
  const status = missingRequired.length || wrongValue.some(name => missingRequired.includes(name))
    ? 'blocked'
    : missingRecommended.length || wrongValue.length
      ? 'needs_review'
      : 'pass';

  return {
    status,
    requiredReadyCount: specs.filter(spec => spec.required && spec.status === 'pass').length,
    requiredCount: specs.filter(spec => spec.required).length,
    recommendedReadyCount: specs.filter(spec => spec.recommended && spec.status === 'pass').length,
    recommendedCount: specs.filter(spec => spec.recommended).length,
    missingRequired,
    missingRecommended,
    specs: specs.map(scrubSetupEnvSpec),
  };
}

function createSetupConnector(input) {
  const readiness = resolveSetupEnvStatus(input.envContract, input.env || []);
  const status = input.required === false && readiness.status === 'blocked'
    ? 'needs_review'
    : readiness.status;
  return {
    id: input.id,
    label: input.label,
    provider: input.provider,
    required: input.required !== false,
    status,
    purpose: input.purpose,
    setupSteps: input.setupSteps || [],
    env: input.env || [],
    missingRequired: readiness.missingRequired,
    missingRecommended: readiness.missingRecommended,
    readiness,
    proof: input.proof || [],
    evidence: input.evidence || [],
  };
}

export function createProductionSetupContract(input = {}) {
  const env = input.env || {};
  const project = input.project || 'author-os';
  const environments = input.environments || ['production', 'preview'];
  const previewBranch = input.previewBranch || '';
  const envContract = input.envContract || createProductionEnvContract(env);
  const cloud = input.cloud || createCloudReadinessChecklist(env);
  const launch = input.launch || createProductionLaunchChecklist(env);
  const commandPlan = createVercelEnvCommandPlan({ project, environments, previewBranch });
  const appUrl = launch.appUrl || env.NEXT_PUBLIC_APP_URL || null;
  const baselinePlan = createVercelEnvBaselinePlan({ project, environments, env, appUrl, previewBranch });
  const previewBranchArg = previewBranch ? ` --preview-branch ${previewBranch}` : '';
  const remoteEnvAuditPlan = {
    command: `author-os cloud-env --vercel --audit --project ${project} --environments ${environments.join(',')}${appUrl ? ` --app-url ${appUrl}` : ''}`,
    note: 'Use after applying baseline or manual provider values. It verifies remote Vercel name/environment presence only; encrypted values still require pulled env validation and provider proof.',
  };

  const connectors = [
    createSetupConnector({
      id: 'runtime-safety',
      label: 'Runtime safety',
      provider: 'AuthorOS hosted runtime',
      purpose: 'Disable demo data, require verified auth, and select the production Postgres adapter before paid authors enter the cockpit.',
      envContract,
      env: [
        'AUTHOROS_DEMO_MODE',
        'AUTHOROS_REQUIRE_AUTH',
        'AUTHOROS_PROJECT_ADAPTER',
        'AUTHOROS_ALLOW_TRUSTED_AUTH_HEADERS',
        'AUTHOROS_DEFAULT_PLAN',
        'AUTHOROS_DEFAULT_AUTH_ROLE',
      ],
      setupSteps: [
        'Set demo mode off in Vercel production and preview environments.',
        'Require auth before tenant context is trusted.',
        'Keep trusted header auth disabled unless a reviewed gateway injects identity.',
      ],
      proof: ['GET /api/system/readiness', 'GET /ops'],
      evidence: ['author-os cloud-readiness --require-ready --env-file .env.local'],
    }),
    createSetupConnector({
      id: 'identity',
      label: 'Identity and workspace auth',
      provider: 'Clerk',
      purpose: 'Resolve user, organization, role, and workspace context before any manuscript or billing data is served.',
      envContract,
      env: [
        'AUTHOROS_AUTH_PROVIDER',
        'CLERK_SECRET_KEY',
        'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY',
        'NEXT_PUBLIC_CLERK_SIGN_IN_URL',
        'NEXT_PUBLIC_CLERK_SIGN_UP_URL',
      ],
      setupSteps: [
        'Create or select the Clerk application for Author Cockpit.',
        'Configure sign-in and sign-up routes.',
        'Confirm organization or solo workspace mapping in preview.',
      ],
      proof: ['GET /sign-in', 'GET /api/projects'],
      evidence: ['node scripts/verify-live-cockpit.mjs <preview-url> --expect-production'],
    }),
    createSetupConnector({
      id: 'mcp-oauth-discovery',
      label: 'Hosted MCP OAuth discovery',
      provider: 'OAuth 2.0 Protected Resource Metadata',
      purpose: 'Let Codex, Claude, and other MCP clients discover the protected AuthorOS resource, authorization server, and least-privilege scopes.',
      envContract,
      env: [
        'AUTHOROS_MCP_AUTHORIZATION_SERVER_URL',
        'NEXT_PUBLIC_APP_URL',
      ],
      setupSteps: [
        'Configure the OAuth authorization server URL that will issue audience-bound tokens for hosted MCP.',
        'Verify the protected-resource document exposes /api/mcp as the resource with AuthorOS scopes.',
        'Confirm unauthenticated MCP execution returns a WWW-Authenticate header with resource_metadata.',
      ],
      proof: ['GET /.well-known/oauth-protected-resource', 'POST /api/mcp 401 WWW-Authenticate'],
      evidence: ['node scripts/verify-live-cockpit.mjs <preview-url> --expect-production'],
    }),
    createSetupConnector({
      id: 'data-plane',
      label: 'Tenant data plane',
      provider: 'Vercel Marketplace Postgres',
      purpose: 'Persist project graphs, workspaces, memberships, normalized agent audit records, billing events, and service intakes under RLS.',
      envContract,
      env: [
        'POSTGRES_URL',
        'DATABASE_URL',
        'AUTHOROS_DB_MIGRATION_VERSION',
        'AUTHOROS_MIGRATION_APPLIED_BY',
        'AUTHOROS_PG_POOL_MAX',
        'AUTHOROS_PG_IDLE_TIMEOUT_MS',
      ],
      setupSteps: [
        'Attach Marketplace Postgres to the Vercel project.',
        'Run the checked-in migration against the target database.',
        'Verify the migration ledger is current before promotion.',
      ],
      proof: ['author_schema_migrations', 'GET /api/projects'],
      evidence: ['author-os cloud-migrate --status --require-current --env-file .env.local'],
    }),
    createSetupConnector({
      id: 'asset-plane',
      label: 'Private asset plane',
      provider: 'Vercel Blob',
      purpose: 'Store portraits, cover comps, reference files, generated media, rights metadata, variants, and used-in links.',
      envContract,
      env: ['BLOB_READ_WRITE_TOKEN'],
      setupSteps: [
        'Attach Vercel Blob to the project.',
        'Keep binary uploads private by default.',
        'Use metadata-only records for external assets when rights are documented elsewhere.',
      ],
      proof: ['GET /api/projects/:id/assets', 'POST /api/projects/:id/assets'],
      evidence: ['node scripts/smoke-hosted-cockpit.mjs'],
    }),
    createSetupConnector({
      id: 'billing',
      label: 'Billing and entitlements',
      provider: 'Stripe',
      purpose: 'Sell local lifetime, cloud subscriptions, packs, concierge setup, and service sprints without granting access before webhook entitlements land.',
      envContract,
      env: [
        'STRIPE_SECRET_KEY',
        'STRIPE_WEBHOOK_SECRET',
        'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
        'STRIPE_BILLING_PORTAL_CONFIGURATION',
        'STRIPE_PRICE_PRO_LOCAL',
        'STRIPE_PRICE_CLOUD_CREATOR',
        'STRIPE_PRICE_CLOUD_STUDIO',
        'STRIPE_PRICE_AGENCY_SMALL_PRESS',
        'STRIPE_PRICE_FOUNDER_LIFETIME_LOCAL',
        'STRIPE_PRICE_FOUNDRY_PACK',
        'STRIPE_PRICE_CONCIERGE_SETUP',
        'STRIPE_PRICE_AGENTIC_SERVICE_SPRINT',
      ],
      setupSteps: [
        'Create recurring and launch offer prices in Stripe.',
        'Configure the webhook endpoint and signing secret.',
        'Verify checkout-created events do not grant access until webhook completion.',
      ],
      proof: ['GET /billing', 'POST /api/billing/stripe/checkout', 'POST /api/billing/stripe/webhook'],
      evidence: ['GET /api/billing/status'],
    }),
    createSetupConnector({
      id: 'managed-ai',
      label: 'Managed AI routing',
      provider: 'Vercel AI Gateway',
      purpose: 'Route extraction, continuity, prose, visual, and operations work through dynamic deployment config while logging model, route, cost, prompt scope, and approval state.',
      envContract,
      env: [
        'AI_GATEWAY_API_KEY',
        'VERCEL_AI_GATEWAY_API_KEY',
        'AUTHOROS_MODEL_EXTRACTOR',
        'AUTHOROS_MODEL_CONTINUITY',
        'AUTHOROS_MODEL_PROSE',
        'AUTHOROS_MODEL_VISUAL',
        'AUTHOROS_MODEL_OPERATIONS',
        'AUTHOROS_AI_PROVIDER_ORDER',
        'AUTHOROS_AI_FALLBACK_MODELS',
        'AUTHOROS_AI_MAX_INPUT_TOKENS',
        'AUTHOROS_AI_MAX_OUTPUT_TOKENS',
      ],
      setupSteps: [
        'Enable AI Gateway or OIDC for the Vercel project.',
        'Set route model ids from deployment config instead of source code.',
        'Smoke a managed agent run and inspect AgentRun plus CreditLedger output.',
      ],
      proof: ['POST /api/projects/:id/agent-runs', 'POST /api/mcp'],
      evidence: ['node scripts/smoke-hosted-cockpit.mjs'],
    }),
    createSetupConnector({
      id: 'observability',
      label: 'Observability and activation analytics',
      provider: 'Sentry and PostHog',
      required: false,
      purpose: 'Catch production errors, track activation funnels, and measure offer conversion before paid traffic.',
      envContract,
      env: ['SENTRY_DSN', 'NEXT_PUBLIC_POSTHOG_KEY', 'NEXT_PUBLIC_POSTHOG_HOST'],
      setupSteps: [
        'Create Sentry and PostHog projects for Author Cockpit.',
        'Add browser and server runtime keys to Vercel.',
        'Confirm events before paid launch traffic.',
      ],
      proof: ['Sentry issue stream', 'PostHog activation dashboard'],
      evidence: ['node scripts/verify-live-cockpit.mjs <preview-url> --require-ready'],
    }),
    createSetupConnector({
      id: 'preview-automation-access',
      label: 'Protected preview automation access',
      provider: 'Vercel Deployment Protection',
      required: false,
      purpose: 'Let CI, Codex, and operator scripts verify protected Vercel previews without weakening public deployment protection.',
      envContract,
      env: ['AUTHOROS_VERCEL_PROTECTION_BYPASS', 'VERCEL_AUTOMATION_BYPASS_SECRET'],
      setupSteps: [
        'Create a Vercel Protection Bypass for Automation secret for the AuthorOS project.',
        'Store it as AUTHOROS_VERCEL_PROTECTION_BYPASS or VERCEL_AUTOMATION_BYPASS_SECRET in the operator/CI environment, not in source.',
        'Rerun live verification against the protected preview before promotion.',
      ],
      proof: ['Vercel Deployment Protection settings', 'node scripts/verify-live-cockpit.mjs <preview-url> --expect-production --require-ready'],
      evidence: ['author-os production-evidence --live-url <preview-url> --vercel-bypass-secret $AUTHOROS_VERCEL_PROTECTION_BYPASS --require-ready'],
    }),
  ];

  const proofEndpoints = [
    { method: 'GET', path: '/api/system/readiness', purpose: 'Cloud and strict launch readiness.' },
    { method: 'GET', path: '/api/system/setup-contract', purpose: 'Sanitized production setup contract for agents and operators.' },
    { method: 'GET', path: '/api/system/launch-plan', purpose: 'Promotion ledger, blocker actions, and proof commands.' },
    { method: 'GET', path: '/api/mcp', purpose: 'Hosted MCP manifest and agent discovery.' },
    { method: 'GET', path: '/.well-known/oauth-protected-resource', purpose: 'MCP protected-resource metadata.' },
    { method: 'GET', path: '/sign-in', purpose: 'Auth surface availability.' },
    { method: 'GET', path: '/setup', purpose: 'Human-readable setup command room.' },
    { method: 'GET', path: '/ops', purpose: 'Launch operations ledger.' },
    { method: 'GET', path: '/billing', purpose: 'Billing and entitlement command deck.' },
  ];

  const operatorSequence = [
    {
      id: 'local-gates',
      label: 'Local gates',
      command: 'npm run ci:local',
      outcome: 'Core graph, cloud, MCP, build, and built-server smoke pass before cloud work.',
    },
    {
      id: 'env-contract',
      label: 'Environment contract',
      command: `author-os cloud-env --vercel --baseline --project ${project} --environments ${environments.join(',')}${appUrl ? ` --app-url ${appUrl}` : ''}${previewBranchArg}`,
      outcome: 'Safe non-secret baseline values are applied first; provider secrets and price/database values remain redacted operator inputs.',
    },
    {
      id: 'remote-env-audit',
      label: 'Remote env audit',
      command: remoteEnvAuditPlan.command,
      outcome: 'Vercel project state proves required names are present in the intended environments before value-level readiness gates run.',
    },
    {
      id: 'database',
      label: 'Database migration',
      command: 'author-os cloud-migrate --status --require-current --env-file .env.local',
      outcome: 'Migration ledger is current and RLS tables exist.',
    },
    {
      id: 'preview',
      label: 'Preview verification',
      command: 'node scripts/verify-live-cockpit.mjs <preview-url> --expect-production --require-ready',
      outcome: 'Live preview proves runtime, setup, launch, MCP, auth, billing, and ops surfaces.',
    },
    {
      id: 'promotion',
      label: 'Production promotion',
      command: 'author-os launch-plan --check-db --preview-verified --require-ready --env-file .env.local',
      outcome: 'Promote only the already-verified preview artifact.',
    },
  ];

  const requiredBlocked = connectors.filter(connector => connector.required && connector.status === 'blocked');
  const reviewConnectors = connectors.filter(connector => connector.status === 'needs_review');
  const status = requiredBlocked.length || launch.status === 'blocked' || envContract.status === 'blocked'
    ? 'blocked'
    : reviewConnectors.length || launch.status === 'needs_review' || envContract.status === 'needs_review'
      ? 'needs_review'
      : 'ready';

  return {
    status,
    generatedAt: new Date().toISOString(),
    project,
    environments,
    appUrl,
    summary: {
      connectorCount: connectors.length,
      blockedConnectorCount: requiredBlocked.length,
      reviewConnectorCount: reviewConnectors.length,
      requiredEnvReadyCount: envContract.requiredReadyCount,
      requiredEnvCount: envContract.requiredCount,
      recommendedEnvReadyCount: envContract.recommendedReadyCount,
      recommendedEnvCount: envContract.recommendedCount,
      commandCount: commandPlan.commandCount,
      baselineCommandCount: baselinePlan.commandCount,
      manualEnvCommandCount: baselinePlan.manualCommandCount,
      remoteEnvAuditCommandCount: 1,
      proofEndpointCount: proofEndpoints.length,
    },
    nextAction: requiredBlocked[0]?.setupSteps?.[0]
      || reviewConnectors[0]?.setupSteps?.[0]
      || 'Run preview verification and promote only the verified artifact.',
    connectors,
    envContract: {
      ...envContract,
      specs: envContract.specs.map(scrubSetupEnvSpec),
    },
    cloud,
    launch,
    commandPlan,
    baselinePlan,
    remoteEnvAuditPlan,
    proofEndpoints,
    operatorSequence,
  };
}

function normalizeMigrationGate(migration = null, env = {}) {
  if (!isProductionEnvValueReady(env, 'POSTGRES_URL')) {
    return {
      status: 'blocked',
      label: 'Hosted database not configured',
      detail: 'No POSTGRES_URL or DATABASE_URL is available for migration verification.',
      nextAction: 'Attach Vercel Marketplace Postgres, then run author-os cloud-migrate --status --env-file .env.local.',
    };
  }

  const plan = migration?.plan || migration || null;
  const planStatus = plan?.status || migration?.status || 'not_checked';
  if (planStatus === 'current') {
    return {
      status: 'pass',
      label: 'Database migration current',
      detail: `Migration ledger is current at ${plan.latestVersion || env.AUTHOROS_DB_MIGRATION_VERSION || 'declared version'}.`,
      nextAction: 'Keep author-os cloud-migrate --status --require-current in promotion gates.',
    };
  }
  if (planStatus === 'pending') {
    return {
      status: 'blocked',
      label: 'Database migration pending',
      detail: `${plan.pending?.length || 1} migration(s) still need to run.`,
      nextAction: 'Run author-os cloud-migrate --apply --env-file .env.local, then verify --status --require-current.',
    };
  }
  if (planStatus === 'checksum_mismatch') {
    return {
      status: 'blocked',
      label: 'Database migration checksum mismatch',
      detail: 'The migration ledger does not match the checked-in migration SQL.',
      nextAction: 'Stop promotion, inspect author_schema_migrations, and reconcile the migration history manually.',
    };
  }

  return {
    status: 'needs_review',
    label: 'Database migration not checked',
    detail: 'A database URL exists, but the migration ledger has not been inspected in this launch plan.',
    nextAction: 'Run author-os launch-plan --check-db --env-file .env.local or author-os cloud-migrate --status --require-current.',
  };
}

function createLaunchAction(input) {
  return {
    id: input.id,
    stage: input.stage,
    status: input.status || 'blocked',
    label: input.label,
    command: input.command || null,
    nextAction: input.nextAction || '',
    evidence: input.evidence || [],
  };
}

export function createLaunchOperationsPlan(input = {}) {
  const env = input.env || {};
  const project = input.project || 'author-os';
  const envFile = input.envFile || '.env.local';
  const previewBranch = input.previewBranch || '';
  const envContract = input.envContract || createProductionEnvContract(env);
  const cloud = input.cloud || createCloudReadinessChecklist(env);
  const launch = input.launch || createProductionLaunchChecklist(env);
  const migrationGate = normalizeMigrationGate(input.migration, env);
  const appUrl = launch.appUrl || env.NEXT_PUBLIC_APP_URL || null;
  const baselinePlan = createVercelEnvBaselinePlan({ project, environments: ['production', 'preview'], env, appUrl, previewBranch });
  const previewBranchArg = previewBranch ? ` --preview-branch ${previewBranch}` : '';
  const previewVerified = Boolean(input.previewVerified);
  const actions = [];

  const stages = [
    {
      id: 'environment',
      label: 'Production environment contract',
      status: envContract.status === 'ready' ? 'pass' : envContract.status,
      detail: `${envContract.requiredReadyCount}/${envContract.requiredCount} required and ${envContract.recommendedReadyCount}/${envContract.recommendedCount} recommended values ready.`,
    },
    {
      id: 'cloud-dependencies',
      label: 'Hosted cloud dependencies',
      status: cloud.status === 'ready' ? 'pass' : 'blocked',
      detail: `${cloud.checks.filter(check => check.status === 'pass').length}/${cloud.checks.length} dependency groups configured.`,
    },
    {
      id: 'migration',
      label: migrationGate.label,
      status: migrationGate.status,
      detail: migrationGate.detail,
    },
    {
      id: 'launch-readiness',
      label: 'Strict launch readiness',
      status: launch.status === 'ready' ? 'pass' : launch.status,
      detail: `${launch.blockers.length} blocker(s), ${launch.warnings.length} warning(s).`,
    },
    {
      id: 'preview-verification',
      label: 'Preview and smoke verification',
      status: launch.status === 'ready' && migrationGate.status === 'pass'
        ? previewVerified ? 'pass' : 'needs_review'
        : 'blocked',
      detail: previewVerified
        ? 'A validated Vercel preview has been acknowledged for this launch plan.'
        : 'A validated Vercel preview URL is required before production promotion.',
    },
  ];

  if (envContract.status !== 'ready') {
    if (baselinePlan.commandCount) {
      actions.push(createLaunchAction({
        id: 'apply-safe-env-baseline',
        stage: 'environment',
        status: 'needs_review',
        label: 'Apply safe non-secret Vercel baseline',
        command: `author-os cloud-env --vercel --baseline --project ${project} --environments production,preview${appUrl ? ` --app-url ${appUrl}` : ''}${previewBranchArg}`,
        nextAction: `${baselinePlan.baselineNameCount} deterministic non-secret value(s) can be applied before adding provider secrets.`,
        evidence: ['author-os cloud-env --vercel --baseline --json'],
      }));
    }
    actions.push(createLaunchAction({
      id: 'audit-remote-env-presence',
      stage: 'environment',
      status: 'needs_review',
      label: 'Audit remote Vercel env presence',
      command: `author-os cloud-env --vercel --audit --project ${project} --environments production,preview${appUrl ? ` --app-url ${appUrl}` : ''}`,
      nextAction: 'Confirm the Vercel project has required names in the intended environments before pulling and validating actual values.',
      evidence: ['author-os cloud-env --vercel --audit --json'],
    }));
    actions.push(createLaunchAction({
      id: 'configure-production-env',
      stage: 'environment',
      status: envContract.missingRequired.length ? 'blocked' : 'needs_review',
      label: 'Configure production and preview environment values',
      command: `author-os cloud-env --vercel --project ${project} --environments production,preview${previewBranchArg}`,
      nextAction: envContract.missingRequired.length
        ? `Add missing required values: ${envContract.missingRequired.join(', ')}.`
        : `Add recommended launch values: ${envContract.missingRecommended.join(', ')}.`,
      evidence: ['author-os cloud-env --require-ready --env-file .env.local'],
    }));
  }

  for (const check of cloud.checks.filter(item => item.status !== 'pass')) {
    actions.push(createLaunchAction({
      id: `configure-${check.id}`,
      stage: 'cloud-dependencies',
      label: check.label,
      nextAction: `Configure ${check.env.join(' or ')} in Vercel.`,
      evidence: ['author-os cloud-readiness --json --env-file .env.local'],
    }));
  }

  if (migrationGate.status !== 'pass') {
    actions.push(createLaunchAction({
      id: 'verify-database-migration',
      stage: 'migration',
      status: migrationGate.status,
      label: migrationGate.label,
      command: `author-os cloud-migrate --status --require-current --env-file ${envFile}`,
      nextAction: migrationGate.nextAction,
      evidence: ['author-os cloud-migrate --status --require-current --env-file .env.local'],
    }));
  }

  for (const check of launch.checks.filter(item => item.status !== 'pass')) {
    actions.push(createLaunchAction({
      id: `resolve-${check.id}`,
      stage: 'launch-readiness',
      status: check.severity === 'warning' ? 'needs_review' : 'blocked',
      label: check.label,
      nextAction: check.nextAction,
      evidence: ['author-os cloud-readiness --require-ready --env-file .env.local'],
    }));
  }

  if (launch.status === 'ready' && migrationGate.status === 'pass' && !previewVerified) {
    actions.push(createLaunchAction({
      id: 'deploy-preview',
      stage: 'preview-verification',
      status: 'needs_review',
      label: 'Deploy and inspect a Vercel preview',
      command: 'vercel deploy --prebuilt',
      nextAction: 'Verify the live preview URL, system readiness, auth, MCP, project creation, and cockpit smoke before promotion. If deployment protection is enabled, use AUTHOROS_VERCEL_PROTECTION_BYPASS or VERCEL_AUTOMATION_BYPASS_SECRET.',
      evidence: [
        'npm run ci:local',
        'node scripts/smoke-hosted-cockpit.mjs',
        'node scripts/verify-live-cockpit.mjs <preview-url> --expect-production --require-ready',
        'author-os production-evidence --live-url <preview-url> --require-ready',
      ],
    }));
  }

  const blocked = stages.some(stage => stage.status === 'blocked') || actions.some(action => action.status === 'blocked');
  const review = stages.some(stage => stage.status === 'needs_review') || actions.some(action => action.status === 'needs_review');
  const status = blocked ? 'blocked' : review ? 'needs_review' : 'ready';

  return {
    status,
    generatedAt: new Date().toISOString(),
    project,
    appUrl,
    summary: {
      blockerCount: actions.filter(action => action.status === 'blocked').length,
      reviewCount: actions.filter(action => action.status === 'needs_review').length,
      stageCount: stages.length,
      actionCount: actions.length,
      baselineCommandCount: baselinePlan.commandCount,
      manualEnvCommandCount: baselinePlan.manualCommandCount,
    },
    nextAction: actions[0]?.nextAction || 'All launch gates are ready; promote only a verified preview artifact.',
    stages,
    actions,
    proofCommands: [
      'npm run ci:local',
      `author-os cloud-env --require-ready --env-file ${envFile}`,
      `author-os cloud-migrate --status --require-current --env-file ${envFile}`,
      `author-os cloud-readiness --require-ready --env-file ${envFile}`,
      'node scripts/smoke-hosted-cockpit.mjs',
      'node scripts/verify-live-cockpit.mjs <preview-url> --expect-production --require-ready',
    ],
    envContract,
    baselinePlan,
    cloud,
    launch,
    migration: migrationGate,
  };
}

function createProductionEvidenceCheck(input) {
  return {
    id: input.id,
    label: input.label,
    status: input.status,
    severity: input.severity || 'blocker',
    detail: input.detail || '',
    nextAction: input.nextAction || '',
  };
}

function classifyProductionEvidence(checks) {
  if (checks.some(check => check.status === 'blocked' && check.severity !== 'warning')) return 'blocked';
  if (checks.some(check => check.status !== 'pass')) return 'needs_review';
  return 'ready';
}

function summarizeProductionEvidenceEnvContract(contract) {
  return {
    status: contract.status,
    requiredReadyCount: contract.requiredReadyCount,
    requiredCount: contract.requiredCount,
    recommendedReadyCount: contract.recommendedReadyCount,
    recommendedCount: contract.recommendedCount,
    missingRequired: contract.missingRequired || [],
    missingRecommended: contract.missingRecommended || [],
    placeholderRequired: contract.placeholderRequired || [],
    invalidRequired: contract.invalidRequired || [],
  };
}

function summarizeProductionEvidenceSetupContract(contract) {
  return {
    status: contract.status,
    project: contract.project,
    environments: contract.environments || [],
    summary: contract.summary || {},
    blockedConnectors: (contract.connectors || [])
      .filter(connector => connector.status === 'blocked')
      .map(connector => ({
        id: connector.id,
        label: connector.label,
        provider: connector.provider,
        missingRequired: connector.missingRequired || [],
      })),
    reviewConnectors: (contract.connectors || [])
      .filter(connector => connector.status === 'review' || connector.status === 'needs_review')
      .map(connector => ({
        id: connector.id,
        label: connector.label,
        provider: connector.provider,
        missingRecommended: connector.missingRecommended || [],
      })),
    proofEndpointCount: (contract.proofEndpoints || []).length,
    nextAction: contract.nextAction || null,
  };
}

function summarizeProductionEvidenceLaunchPlan(plan) {
  return {
    status: plan.status,
    project: plan.project,
    appUrl: plan.appUrl || null,
    summary: plan.summary || {},
    stageStatus: (plan.stages || []).map(stage => ({
      id: stage.id,
      status: stage.status,
      detail: stage.detail,
    })),
    topActions: (plan.actions || []).slice(0, 12).map(action => ({
      id: action.id,
      stage: action.stage,
      status: action.status,
      label: action.label,
      nextAction: action.nextAction,
      command: action.command || null,
    })),
    migration: plan.migration || null,
    nextAction: plan.nextAction || null,
  };
}

function createProductionOperatorAction(input = {}) {
  return {
    id: input.id,
    phase: input.phase || 'production',
    priority: input.priority || 'P2',
    status: input.status || 'blocked',
    label: input.label,
    reason: input.reason || '',
    command: input.command || null,
    evidence: input.evidence || [],
    missing: input.missing || [],
    blockedBy: input.blockedBy || [],
  };
}

function pushProductionOperatorAction(actions, input = {}) {
  if (!input.id || actions.some(action => action.id === input.id)) return;
  actions.push(createProductionOperatorAction(input));
}

function previewBranchSuffix(previewBranch) {
  return previewBranch ? ` --preview-branch ${previewBranch}` : '';
}

function isOpenProductionOperatorSource(action) {
  return Boolean(action) && !['pass', 'ready', 'completed'].includes(action.status);
}

function createProductionOperatorNextActions(input = {}) {
  const actions = [];
  const envContract = input.envContract || {};
  const setupContract = input.setupContract || {};
  const launchPlan = input.launchPlan || {};
  const cloud = input.cloud || {};
  const launch = input.launch || {};
  const deployment = input.deployment || {};
  const runtime = input.runtime || {};
  const project = input.project || 'author-os';
  const environments = input.environments || ['production', 'preview'];
  const envFile = input.envFile || '.env.local';
  const previewBranch = input.previewBranch || '';
  const previewArg = previewBranchSuffix(previewBranch);
  const environmentArg = environments.join(',');
  const appUrl = launchPlan.appUrl || launch.appUrl || '';
  const appUrlArg = appUrl ? ` --app-url ${appUrl}` : '';
  const baselineAction = (launchPlan.actions || []).find(action => action.id === 'apply-safe-env-baseline');
  const auditAction = (launchPlan.actions || []).find(action => action.id === 'audit-remote-env-presence');
  const configureEnvAction = (launchPlan.actions || []).find(action => action.id === 'configure-production-env');

  if (isOpenProductionOperatorSource(baselineAction) || (envContract.status !== 'ready' && launchPlan.baselinePlan?.previewBranchRequired)) {
    pushProductionOperatorAction(actions, {
      id: 'apply-safe-env-baseline',
      phase: 'environment',
      priority: 'P0',
      status: baselineAction?.status || 'needs_review',
      label: 'Apply deterministic non-secret Vercel baseline',
      reason: baselineAction?.nextAction || `${launchPlan.baselinePlan?.baselineNameCount || 0} safe baseline value(s) can be applied before provider secrets.`,
      command: baselineAction?.command || `author-os cloud-env --vercel --baseline --project ${project} --environments ${environmentArg}${appUrlArg}${previewArg}`,
      evidence: baselineAction?.evidence || ['author-os cloud-env --vercel --audit --json'],
      missing: launchPlan.baselinePlan?.commands?.filter(command => command.requiresPreviewBranch).map(command => command.name) || [],
    });
  }

  if (isOpenProductionOperatorSource(auditAction) || envContract.status !== 'ready' || setupContract.status !== 'ready' || launchPlan.status !== 'ready') {
    pushProductionOperatorAction(actions, {
      id: 'audit-remote-env-presence',
      phase: 'environment',
      priority: 'P1',
      status: auditAction?.status || 'needs_review',
      label: 'Audit remote Vercel env name presence',
      reason: auditAction?.nextAction || 'Remote Vercel env name/environment presence must be checked before value-level readiness is trusted.',
      command: auditAction?.command || `author-os cloud-env --vercel --audit --project ${project} --environments ${environmentArg}${appUrlArg}`,
      evidence: auditAction?.evidence || ['author-os cloud-env --vercel --audit --json'],
    });
  }

  if (envContract.status && envContract.status !== 'ready') {
    pushProductionOperatorAction(actions, {
      id: 'populate-and-validate-env-values',
      phase: 'environment',
      priority: 'P0',
      label: 'Populate and validate production env values',
      reason: `${envContract.requiredReadyCount || 0}/${envContract.requiredCount || 0} required env values are ready.`,
      command: `vercel env pull ${envFile} --yes && author-os cloud-env --require-ready --env-file ${envFile}`,
      evidence: ['author-os cloud-env --require-ready --env-file .env.local'],
      missing: envContract.missingRequired || [],
      blockedBy: configureEnvAction?.id ? [configureEnvAction.id] : [],
    });
  }

  if (setupContract.status && setupContract.status !== 'ready') {
    pushProductionOperatorAction(actions, {
      id: 'resolve-setup-connectors',
      phase: 'providers',
      priority: 'P0',
      label: 'Resolve blocked provider connectors',
      reason: `${setupContract.summary?.blockedConnectorCount ?? 0} setup connector(s) remain blocked.`,
      command: `author-os setup-contract --require-ready --env-file ${envFile}${previewArg}`,
      evidence: ['author-os setup-contract --require-ready --env-file .env.local'],
      missing: (setupContract.connectors || [])
        .filter(connector => connector.status === 'blocked')
        .map(connector => connector.id),
    });
  }

  if (launchPlan.migration?.status && launchPlan.migration.status !== 'pass') {
    pushProductionOperatorAction(actions, {
      id: 'attach-postgres-and-run-migrations',
      phase: 'database',
      priority: 'P0',
      label: 'Attach Postgres and verify migrations',
      reason: launchPlan.migration.detail || 'Database migration evidence is not current.',
      command: `author-os cloud-migrate --status --require-current --env-file ${envFile}`,
      evidence: ['author_schema_migrations', 'author-os cloud-migrate --status --require-current --env-file .env.local'],
    });
  }

  const protectedPreviewNeedsBypass = (launch.warnings || []).includes('protected-preview-bypass')
    || (setupContract.connectors || []).some(connector => connector.id === 'preview-automation-access' && connector.status !== 'pass');
  if (protectedPreviewNeedsBypass) {
    pushProductionOperatorAction(actions, {
      id: 'configure-protected-preview-bypass',
      phase: 'preview',
      priority: 'P0',
      status: 'needs_review',
      label: 'Configure protected preview automation access',
      reason: 'Preview verification needs a Vercel Protection Bypass for Automation when deployment protection is enabled.',
      command: 'node scripts/verify-live-cockpit.mjs <preview-url> --expect-production --require-ready --vercel-bypass-secret $AUTHOROS_VERCEL_PROTECTION_BYPASS',
      evidence: ['Vercel Protection Bypass for Automation', 'node scripts/verify-live-cockpit.mjs <preview-url> --expect-production --require-ready'],
    });
  }

  const previewIsVerified = launchPlan.stages?.find(stage => stage.id === 'preview-verification')?.status === 'pass'
    || Boolean(input.previewVerified);
  if (!previewIsVerified) {
    pushProductionOperatorAction(actions, {
      id: 'verify-live-preview',
      phase: 'preview',
      priority: 'P1',
      status: 'needs_review',
      label: 'Verify a live Vercel preview',
      reason: 'A validated live preview is required before production promotion.',
      command: 'node scripts/verify-live-cockpit.mjs <preview-url> --expect-production --require-ready',
      evidence: ['author-os production-evidence --live-url <preview-url> --remote-env-audit --require-ready --save'],
    });
  }

  if (launchPlan.status && launchPlan.status !== 'ready') {
    pushProductionOperatorAction(actions, {
      id: 'clear-launch-plan-blockers',
      phase: 'promotion',
      priority: 'P1',
      status: launchPlan.status,
      label: 'Clear launch-plan blockers before promotion',
      reason: `${launchPlan.summary?.blockerCount ?? 0} launch blocker(s) and ${launchPlan.summary?.reviewCount ?? 0} review item(s) remain.`,
      command: `author-os launch-plan --check-db --preview-verified --require-ready --env-file ${envFile}${previewArg}`,
      evidence: ['author-os launch-plan --check-db --preview-verified --require-ready --env-file .env.local'],
      missing: (launchPlan.actions || []).slice(0, 8).map(action => action.id),
    });
  }

  if ((deployment.environment !== 'production' && deployment.target !== 'production') || runtime.projectAdapter === 'demo' || runtime.auth?.required !== true) {
    pushProductionOperatorAction(actions, {
      id: 'promote-verified-preview',
      phase: 'promotion',
      priority: 'P2',
      status: deployment.environment === 'production' || deployment.target === 'production' ? 'needs_review' : 'blocked',
      label: 'Promote only a verified preview artifact',
      reason: `deployment=${deployment.environment || 'unknown'} target=${deployment.target || 'unknown'} adapter=${runtime.projectAdapter || 'unknown'} auth.required=${runtime.auth?.required ?? 'unknown'}.`,
      command: 'vercel promote <verified-preview-url>',
      evidence: ['author-os production-evidence --require-ready --live-url <preview-url> --save'],
    });
  }

  if (cloud.status && cloud.status !== 'ready') {
    pushProductionOperatorAction(actions, {
      id: 'rerun-cloud-readiness',
      phase: 'promotion',
      priority: 'P2',
      status: 'needs_review',
      label: 'Rerun strict cloud readiness',
      reason: `Cloud dependency status is ${cloud.status}.`,
      command: `author-os cloud-readiness --require-ready --env-file ${envFile}`,
      evidence: ['author-os cloud-readiness --require-ready --env-file .env.local'],
      missing: (cloud.checks || []).filter(check => check.status !== 'pass').map(check => check.id),
    });
  }

  return actions.sort((left, right) => {
    const priorityRank = { P0: 0, P1: 1, P2: 2, P3: 3 };
    const phaseRank = { environment: 0, providers: 1, database: 2, preview: 3, promotion: 4, production: 5 };
    return (priorityRank[left.priority] ?? 9) - (priorityRank[right.priority] ?? 9)
      || (phaseRank[left.phase] ?? 9) - (phaseRank[right.phase] ?? 9)
      || left.id.localeCompare(right.id);
  });
}

function createDeploymentEvidence(env = {}, override = {}) {
  const deploymentUrl = override.url
    || env.VERCEL_URL
    || env.NEXT_PUBLIC_VERCEL_URL
    || null;
  const productionUrl = override.productionUrl
    || env.VERCEL_PROJECT_PRODUCTION_URL
    || null;
  return {
    provider: 'vercel',
    environment: override.environment || env.VERCEL_ENV || env.NODE_ENV || 'local',
    target: override.target || env.VERCEL_TARGET_ENV || env.VERCEL_ENV || null,
    projectId: override.projectId || env.VERCEL_PROJECT_ID || null,
    projectName: override.projectName || env.VERCEL_PROJECT_NAME || null,
    deploymentUrl: deploymentUrl
      ? normalizeHttpsOrLocalOrigin(deploymentUrl) || normalizeHttpsOrLocalOrigin(`https://${deploymentUrl}`)
      : null,
    productionUrl: productionUrl
      ? normalizeHttpsOrLocalOrigin(productionUrl) || normalizeHttpsOrLocalOrigin(`https://${productionUrl}`)
      : null,
    git: {
      commitSha: override.commitSha || env.VERCEL_GIT_COMMIT_SHA || null,
      commitRef: override.commitRef || env.VERCEL_GIT_COMMIT_REF || null,
      repoOwner: override.repoOwner || env.VERCEL_GIT_REPO_OWNER || null,
      repoSlug: override.repoSlug || env.VERCEL_GIT_REPO_SLUG || null,
    },
  };
}

export function createProductionEvidenceReport(input = {}) {
  const env = input.env || {};
  const project = input.project || env.VERCEL_PROJECT_ID || 'author-os';
  const environments = input.environments || ['production', 'preview'];
  const previewBranch = input.previewBranch || '';
  const envFile = input.envFile || '.env.local';
  const envContract = input.envContract || createProductionEnvContract(env);
  const cloud = input.cloud || createCloudReadinessChecklist(env);
  const launch = input.launch || createProductionLaunchChecklist(env);
  const setupContract = input.setupContract || createProductionSetupContract({
    env,
    project,
    environments,
    envContract,
    cloud,
    launch,
    previewBranch,
  });
  const launchPlan = input.launchPlan || createLaunchOperationsPlan({
    env,
    project,
    envFile,
    envContract,
    cloud,
    launch,
    migration: input.migration,
    previewVerified: input.previewVerified,
    previewBranch,
  });
  const deployment = createDeploymentEvidence(env, input.deployment || {});
  const runtime = input.runtime || null;
  const requireProductionTarget = Boolean(input.requireProductionTarget);
  const expectProduction = Boolean(input.expectProduction || requireProductionTarget);
  const checks = [];

  checks.push(createProductionEvidenceCheck({
    id: 'env-contract',
    label: 'Production environment contract is ready',
    status: envContract.status === 'ready' ? 'pass' : 'blocked',
    detail: `${envContract.requiredReadyCount}/${envContract.requiredCount} required values ready.`,
    nextAction: 'Populate all required Vercel environment values with non-placeholder production values.',
  }));
  checks.push(createProductionEvidenceCheck({
    id: 'setup-contract',
    label: 'Production setup contract is ready',
    status: setupContract.status === 'ready' ? 'pass' : 'blocked',
    detail: `${setupContract.summary?.blockedConnectorCount ?? 'unknown'} blocked connector(s).`,
    nextAction: setupContract.nextAction || 'Resolve blocked connectors before launch.',
  }));
  checks.push(createProductionEvidenceCheck({
    id: 'cloud-readiness',
    label: 'Hosted cloud dependencies are configured',
    status: cloud.status === 'ready' ? 'pass' : 'blocked',
    detail: `${cloud.checks.filter(check => check.status === 'pass').length}/${cloud.checks.length} dependency groups configured.`,
    nextAction: 'Configure Clerk, Postgres, Blob, Stripe, AI Gateway, app URL, and hosted MCP OAuth values.',
  }));
  checks.push(createProductionEvidenceCheck({
    id: 'launch-readiness',
    label: 'Strict production launch readiness is ready',
    status: launch.status === 'ready' ? 'pass' : 'blocked',
    detail: `${launch.blockers.length} blocker(s), ${launch.warnings.length} warning(s).`,
    nextAction: launch.checks.find(check => launch.blockers.includes(check.id))?.nextAction || 'Resolve launch blockers before promotion.',
  }));
  checks.push(createProductionEvidenceCheck({
    id: 'launch-plan',
    label: 'Promotion launch plan is ready',
    status: launchPlan.status === 'ready' ? 'pass' : launchPlan.status === 'needs_review' ? 'needs_review' : 'blocked',
    detail: `${launchPlan.summary?.blockerCount ?? 'unknown'} blocker(s), ${launchPlan.summary?.reviewCount ?? 'unknown'} review item(s).`,
    nextAction: launchPlan.nextAction || 'Run the preview verification and migration gates before promotion.',
  }));

  if (runtime) {
    const productionRuntimeReady = runtime.projectAdapter !== 'demo'
      && runtime.projectAdapter !== 'unconfigured'
      && runtime.auth?.required === true;
    checks.push(createProductionEvidenceCheck({
      id: 'runtime-production-mode',
      label: 'Runtime is not serving demo author data',
      status: productionRuntimeReady ? 'pass' : expectProduction ? 'blocked' : 'needs_review',
      severity: expectProduction ? 'blocker' : 'warning',
      detail: `adapter=${runtime.projectAdapter || 'missing'} auth.required=${runtime.auth?.required ?? 'missing'}.`,
      nextAction: 'Set AUTHOROS_DEMO_MODE=false, AUTHOROS_REQUIRE_AUTH=true, and AUTHOROS_PROJECT_ADAPTER=postgres before production traffic.',
    }));
  }

  checks.push(createProductionEvidenceCheck({
    id: 'deployment-context',
    label: 'Deployment context is production targeted',
    status: deployment.environment === 'production' || deployment.target === 'production'
      ? 'pass'
      : requireProductionTarget ? 'blocked' : 'needs_review',
    severity: requireProductionTarget ? 'blocker' : 'warning',
    detail: `environment=${deployment.environment || 'missing'} target=${deployment.target || 'missing'}.`,
    nextAction: 'Promote only a verified preview artifact to the production target.',
  }));

  const status = classifyProductionEvidence(checks);
  const operatorNextActions = createProductionOperatorNextActions({
    envContract,
    setupContract,
    launchPlan,
    cloud,
    launch,
    deployment,
    runtime: runtime || {},
    project,
    environments,
    envFile,
    previewBranch,
    previewVerified: input.previewVerified,
  });

  return {
    service: 'arcanea-author-cockpit',
    kind: 'hosted-production-evidence',
    status,
    generatedAt: input.generatedAt || new Date().toISOString(),
    project,
    summary: {
      checkCount: checks.length,
      blockerCount: checks.filter(check => check.status === 'blocked' && check.severity !== 'warning').length,
      warningCount: checks.filter(check => check.status !== 'pass' && check.severity === 'warning').length,
      reviewCount: checks.filter(check => check.status === 'needs_review').length,
      operatorNextActionCount: operatorNextActions.length,
    },
    evidence: {
      envContract: summarizeProductionEvidenceEnvContract(envContract),
      setupContract: summarizeProductionEvidenceSetupContract(setupContract),
      cloudReadiness: {
        status: cloud.status,
        demoMode: cloud.demoMode,
        checks: cloud.checks,
      },
      launchReadiness: {
        status: launch.status,
        environment: launch.environment,
        demoMode: launch.demoMode,
        appUrl: launch.appUrl || null,
        blockers: launch.blockers,
        warnings: launch.warnings,
      },
      launchPlan: summarizeProductionEvidenceLaunchPlan(launchPlan),
      runtime,
      deployment,
    },
    operatorNextActions,
    checks,
  };
}

export function createCloudReadinessChecklist(env = {}) {
  const checks = [
    { id: 'auth', label: 'Clerk auth configured', status: areProductionEnvValuesReady(env, ['AUTHOROS_AUTH_PROVIDER', 'CLERK_SECRET_KEY', 'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY']) ? 'pass' : 'needs_config', env: ['AUTHOROS_AUTH_PROVIDER', 'CLERK_SECRET_KEY', 'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY'] },
    { id: 'mcp-oauth', label: 'Hosted MCP OAuth metadata configured', status: areProductionEnvValuesReady(env, ['AUTHOROS_MCP_AUTHORIZATION_SERVER_URL', 'NEXT_PUBLIC_APP_URL']) ? 'pass' : 'needs_config', env: ['AUTHOROS_MCP_AUTHORIZATION_SERVER_URL', 'NEXT_PUBLIC_APP_URL'] },
    { id: 'postgres', label: 'Vercel Marketplace Postgres configured', status: isProductionEnvValueReady(env, 'POSTGRES_URL') ? 'pass' : 'needs_config', env: ['POSTGRES_URL', 'DATABASE_URL'] },
    { id: 'blob', label: 'Vercel Blob configured', status: isProductionEnvValueReady(env, 'BLOB_READ_WRITE_TOKEN') ? 'pass' : 'needs_config', env: ['BLOB_READ_WRITE_TOKEN'] },
    { id: 'stripe', label: 'Stripe billing configured', status: isProductionEnvValueReady(env, 'STRIPE_SECRET_KEY') ? 'pass' : 'needs_config', env: ['STRIPE_SECRET_KEY'] },
    { id: 'stripe-webhook', label: 'Stripe webhook verification configured', status: isProductionEnvValueReady(env, 'STRIPE_WEBHOOK_SECRET') ? 'pass' : 'needs_config', env: ['STRIPE_WEBHOOK_SECRET'] },
    { id: 'ai-gateway', label: 'AI Gateway configured', status: isAnyProductionEnvValueReady(env, ['AI_GATEWAY_API_KEY', 'VERCEL_AI_GATEWAY_API_KEY']) ? 'pass' : 'needs_config', env: ['AI_GATEWAY_API_KEY', 'VERCEL_AI_GATEWAY_API_KEY'] },
    { id: 'app-url', label: 'Canonical app URL configured', status: isProductionEnvValueReady(env, 'NEXT_PUBLIC_APP_URL') || (env.VERCEL_PROJECT_PRODUCTION_URL && !isPlaceholderEnvValue('VERCEL_PROJECT_PRODUCTION_URL', env.VERCEL_PROJECT_PRODUCTION_URL)) ? 'pass' : 'needs_config', env: ['NEXT_PUBLIC_APP_URL', 'VERCEL_PROJECT_PRODUCTION_URL'] },
  ];
  return {
    status: checks.every(check => check.status === 'pass') ? 'ready' : 'needs_config',
    demoMode: isAuthorOsDemoMode(env),
    checks,
  };
}

export function createProductionLaunchChecklist(env = {}, options = {}) {
  const migrationVersion = options.migrationVersion || '001_author_os_cloud';
  const recurringPriceEnv = [
    'STRIPE_PRICE_PRO_LOCAL',
    'STRIPE_PRICE_CLOUD_CREATOR',
    'STRIPE_PRICE_CLOUD_STUDIO',
    'STRIPE_PRICE_AGENCY_SMALL_PRESS',
  ];
  const launchPriceEnv = [
    'STRIPE_PRICE_FOUNDER_LIFETIME_LOCAL',
    'STRIPE_PRICE_FOUNDRY_PACK',
    'STRIPE_PRICE_CONCIERGE_SETUP',
    'STRIPE_PRICE_AGENTIC_SERVICE_SPRINT',
  ];
  const appUrl = env.NEXT_PUBLIC_APP_URL || (env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${env.VERCEL_PROJECT_PRODUCTION_URL}` : '');
  const appUrlIsHttps = /^https:\/\/[^ ]+\.[^ ]+/.test(appUrl) && !isPlaceholderEnvValue('NEXT_PUBLIC_APP_URL', appUrl);

  const checks = [
    createReadinessCheck({
      id: 'demo-mode-disabled',
      label: 'Demo mode disabled for production',
      status: envFlag(env, 'AUTHOROS_DEMO_MODE', 'false') ? 'pass' : 'blocked',
      env: ['AUTHOROS_DEMO_MODE'],
      detail: 'Production must never serve the sample project adapter as the author data plane.',
      nextAction: 'Set AUTHOROS_DEMO_MODE=false in Vercel production.',
    }),
    createReadinessCheck({
      id: 'auth-required',
      label: 'Authentication required',
      status: envFlag(env, 'AUTHOROS_REQUIRE_AUTH', 'true') ? 'pass' : 'blocked',
      env: ['AUTHOROS_REQUIRE_AUTH'],
      detail: 'Hosted author workspaces require authenticated user and workspace context.',
      nextAction: 'Set AUTHOROS_REQUIRE_AUTH=true and wire the auth provider.',
    }),
    createReadinessCheck({
      id: 'clerk-provider',
      label: 'Clerk provider selected and keyed',
      status: areProductionEnvValuesReady(env, ['AUTHOROS_AUTH_PROVIDER', 'CLERK_SECRET_KEY', 'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY']) ? 'pass' : 'needs_config',
      env: ['AUTHOROS_AUTH_PROVIDER', 'CLERK_SECRET_KEY', 'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY'],
      nextAction: 'Set AUTHOROS_AUTH_PROVIDER=clerk and add Clerk secret plus publishable keys to the Vercel project.',
    }),
    createReadinessCheck({
      id: 'clerk-routes',
      label: 'Clerk sign-in and sign-up URLs configured',
      status: areProductionEnvValuesReady(env, ['NEXT_PUBLIC_CLERK_SIGN_IN_URL', 'NEXT_PUBLIC_CLERK_SIGN_UP_URL']) ? 'pass' : 'needs_config',
      env: ['NEXT_PUBLIC_CLERK_SIGN_IN_URL', 'NEXT_PUBLIC_CLERK_SIGN_UP_URL'],
      nextAction: 'Configure Clerk sign-in/sign-up URLs or hosted Clerk route paths before public launch.',
    }),
    createReadinessCheck({
      id: 'trusted-header-auth',
      label: 'Trusted header auth is disabled by default',
      status: envFlag(env, 'AUTHOROS_ALLOW_TRUSTED_AUTH_HEADERS', 'true') ? 'warn' : 'pass',
      severity: 'warning',
      env: ['AUTHOROS_ALLOW_TRUSTED_AUTH_HEADERS'],
      detail: 'Enable only behind a reviewed gateway that strips client-supplied identity headers and injects verified tenant context.',
      nextAction: 'Leave unset/false for Clerk-native deployments.',
    }),
    createReadinessCheck({
      id: 'mcp-oauth-discovery',
      label: 'Hosted MCP protected-resource metadata configured',
      status: areProductionEnvValuesReady(env, ['AUTHOROS_MCP_AUTHORIZATION_SERVER_URL', 'NEXT_PUBLIC_APP_URL']) ? 'pass' : 'needs_config',
      env: ['AUTHOROS_MCP_AUTHORIZATION_SERVER_URL', 'NEXT_PUBLIC_APP_URL'],
      detail: 'HTTP MCP clients need OAuth protected-resource metadata to discover authorization servers and request least-privilege scopes.',
      nextAction: 'Set AUTHOROS_MCP_AUTHORIZATION_SERVER_URL to the OAuth issuer/authorization server used for hosted MCP tokens.',
    }),
    createReadinessCheck({
      id: 'postgres-adapter',
      label: 'Hosted project adapter uses Postgres',
      status: env.AUTHOROS_PROJECT_ADAPTER === 'postgres' ? 'pass' : 'blocked',
      env: ['AUTHOROS_PROJECT_ADAPTER'],
      detail: 'Demo adapter is allowed locally only. Production must use tenant-scoped persistence.',
      nextAction: 'Set AUTHOROS_PROJECT_ADAPTER=postgres after wiring the Vercel Marketplace Postgres adapter.',
    }),
    createReadinessCheck({
      id: 'postgres-url',
      label: 'Marketplace Postgres URL configured',
      status: isProductionEnvValueReady(env, 'POSTGRES_URL') ? 'pass' : 'needs_config',
      env: ['POSTGRES_URL', 'DATABASE_URL'],
      nextAction: 'Attach a Vercel Marketplace Postgres database, preferably Neon for the first hosted rollout.',
    }),
    createReadinessCheck({
      id: 'db-migration',
      label: 'Database migration version declared',
      status: env.AUTHOROS_DB_MIGRATION_VERSION === migrationVersion ? 'pass' : 'needs_config',
      env: ['AUTHOROS_DB_MIGRATION_VERSION'],
      detail: `Expected ${migrationVersion}.`,
      nextAction: 'Run author-os cloud-migrate --apply, verify --status --require-current, then set AUTHOROS_DB_MIGRATION_VERSION.',
    }),
    createReadinessCheck({
      id: 'blob-private-assets',
      label: 'Private asset storage configured',
      status: isProductionEnvValueReady(env, 'BLOB_READ_WRITE_TOKEN') ? 'pass' : 'needs_config',
      env: ['BLOB_READ_WRITE_TOKEN'],
      nextAction: 'Attach Vercel Blob for portraits, covers, references, and generated assets.',
    }),
    createReadinessCheck({
      id: 'stripe-core',
      label: 'Stripe core billing configured',
      status: areProductionEnvValuesReady(env, ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY']) ? 'pass' : 'needs_config',
      env: ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY'],
      nextAction: 'Add Stripe secret, publishable, and webhook secret values.',
    }),
    createReadinessCheck({
      id: 'stripe-recurring-prices',
      label: 'Recurring offer price IDs configured',
      status: areProductionEnvValuesReady(env, recurringPriceEnv) ? 'pass' : 'needs_config',
      env: recurringPriceEnv,
      nextAction: 'Create Stripe prices for Pro Local, Cloud Creator, Cloud Studio, and Agency/Small Press.',
    }),
    createReadinessCheck({
      id: 'stripe-launch-prices',
      label: 'Launch pack, founder, and concierge price IDs configured',
      status: areProductionEnvValuesReady(env, launchPriceEnv) ? 'pass' : 'warn',
      severity: 'warning',
      env: launchPriceEnv,
      nextAction: 'Add Foundry Pack, lifetime, concierge, and service sprint Stripe prices before selling those offers.',
    }),
    createReadinessCheck({
      id: 'ai-gateway',
      label: 'AI Gateway configured',
      status: isAnyProductionEnvValueReady(env, ['AI_GATEWAY_API_KEY', 'VERCEL_AI_GATEWAY_API_KEY']) ? 'pass' : 'needs_config',
      env: ['AI_GATEWAY_API_KEY', 'VERCEL_AI_GATEWAY_API_KEY'],
      nextAction: 'Add the Vercel AI Gateway key used by managed agent runs.',
    }),
    createReadinessCheck({
      id: 'canonical-url',
      label: 'Canonical HTTPS app URL configured',
      status: appUrlIsHttps ? 'pass' : 'needs_config',
      env: ['NEXT_PUBLIC_APP_URL', 'VERCEL_PROJECT_PRODUCTION_URL'],
      detail: appUrlIsHttps ? 'Canonical URL is HTTPS.' : appUrl ? 'App URL present but not a valid HTTPS production URL.' : 'No app URL found.',
      nextAction: 'Set NEXT_PUBLIC_APP_URL to the production Author Cockpit URL.',
    }),
    createReadinessCheck({
      id: 'observability',
      label: 'Sentry and PostHog configured',
      status: areProductionEnvValuesReady(env, ['SENTRY_DSN', 'NEXT_PUBLIC_POSTHOG_KEY']) ? 'pass' : 'warn',
      severity: 'warning',
      env: ['SENTRY_DSN', 'NEXT_PUBLIC_POSTHOG_KEY', 'NEXT_PUBLIC_POSTHOG_HOST'],
      nextAction: 'Add Sentry and PostHog before public launch analytics or paid traffic.',
    }),
    createReadinessCheck({
      id: 'protected-preview-bypass',
      label: 'Protected preview automation bypass configured',
      status: isAnyProductionEnvValueReady(env, ['AUTHOROS_VERCEL_PROTECTION_BYPASS', 'VERCEL_AUTOMATION_BYPASS_SECRET']) ? 'pass' : 'warn',
      severity: 'warning',
      env: ['AUTHOROS_VERCEL_PROTECTION_BYPASS', 'VERCEL_AUTOMATION_BYPASS_SECRET'],
      detail: 'Needed when Vercel deployment protection is enabled on previews; keep it outside source control.',
      nextAction: 'Create a Vercel Protection Bypass for Automation secret and rerun live verification with the header-based bypass.',
    }),
  ];

  const blockers = checks.filter(check => check.severity !== 'warning' && check.status !== 'pass');
  const warnings = checks.filter(check => check.severity === 'warning' && check.status !== 'pass');

  return {
    status: blockers.length ? 'blocked' : warnings.length ? 'needs_review' : 'ready',
    generatedAt: new Date().toISOString(),
    environment: env.VERCEL_ENV || env.NODE_ENV || 'local',
    migrationVersion,
    demoMode: isAuthorOsDemoMode(env),
    appUrl: appUrl || null,
    blockers: blockers.map(check => check.id),
    warnings: warnings.map(check => check.id),
    checks,
  };
}

export function createBlobAssetAdapter({ put, remove }) {
  if (typeof put !== 'function') throw new Error('createBlobAssetAdapter requires a put function.');
  return {
    async uploadAsset({ pathname, body, contentType, access = 'private' }) {
      const blob = await put(pathname, body, {
        access,
        contentType,
      });
      return {
        id: `asset_${Date.now().toString(36)}`,
        type: contentType || 'application/octet-stream',
        title: pathname.split('/').pop(),
        source: blob.url,
        rights: 'user-provided',
        path: blob.pathname || pathname,
        blobUrl: blob.url,
        contentType: contentType || 'application/octet-stream',
        access,
        byteSize: typeof body?.byteLength === 'number' ? body.byteLength : Buffer.byteLength(String(body || '')),
        usedIn: [],
        variants: [],
      };
    },
    async deleteAsset(pathname) {
      if (typeof remove !== 'function') return { deleted: false, reason: 'remove adapter not configured' };
      await remove(pathname);
      return { deleted: true };
    },
  };
}

export function createEntitlementSnapshot(offerId = 'open-core', overrides = {}) {
  return createCoreEntitlementSnapshot(offerId, overrides);
}

export function createWorkflowRunContract(input = {}) {
  return {
    id: input.id || `workflow_${Date.now().toString(36)}`,
    runtime: 'vercel-workflows',
    purpose: input.purpose || 'outline-draft-critique-revise-export',
    durable: true,
    observable: true,
    humanPausePoints: input.humanPausePoints || ['before_apply_revision', 'before_export', 'before_publish'],
    steps: input.steps || [
      'collect_scope',
      'retrieve_project_context',
      'run_agent',
      'record_cost',
      'request_approval',
      'write_artifact',
    ],
  };
}

export function createSandboxJobContract(input = {}) {
  return {
    id: input.id || `sandbox_${Date.now().toString(36)}`,
    runtime: 'vercel-sandbox',
    purpose: input.purpose || 'safe-export-or-plugin-execution',
    networkPolicy: input.networkPolicy || 'deny-all-after-setup',
    timeoutMs: input.timeoutMs || 300000,
    secretsPolicy: 'never pass broad secrets into user or generated code',
    outputs: input.outputs || ['markdown', 'docx', 'epub', 'pdf', 'logs'],
  };
}

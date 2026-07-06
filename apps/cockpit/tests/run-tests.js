import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { getAuthRedirectConfig, normalizeWorkspaceRedirect } from '../lib/auth-redirects.js';

assert.equal(normalizeWorkspaceRedirect(''), '/projects');
assert.equal(normalizeWorkspaceRedirect('/projects?tab=recent'), '/projects?tab=recent');
assert.equal(
  normalizeWorkspaceRedirect('https://author.arcanea.ai/projects?welcome=1', {
    NEXT_PUBLIC_APP_URL: 'https://author.arcanea.ai',
  }),
  '/projects?welcome=1',
);
assert.equal(
  normalizeWorkspaceRedirect('https://attacker.example/steal', {
    NEXT_PUBLIC_APP_URL: 'https://author.arcanea.ai',
  }),
  '/projects',
);
assert.equal(normalizeWorkspaceRedirect('//attacker.example/steal'), '/projects');

const redirects = getAuthRedirectConfig({
  NEXT_PUBLIC_APP_URL: 'https://author.arcanea.ai',
  NEXT_PUBLIC_AUTHOROS_AFTER_SIGN_IN_URL: '/projects',
  NEXT_PUBLIC_AUTHOROS_AFTER_SIGN_UP_URL: 'https://author.arcanea.ai/projects?new=1',
});
assert.equal(redirects.signInFallbackRedirectUrl, '/projects');
assert.equal(redirects.signUpFallbackRedirectUrl, '/projects?new=1');

const appDir = path.resolve('apps/cockpit/app');
const productionSurfaceFiles = [
  'page.jsx',
  'billing/page.jsx',
  'ops/page.jsx',
  'projects/page.jsx',
  'setup/page.jsx',
  'sign-in/[[...sign-in]]/page.jsx',
  'sign-up/[[...sign-up]]/page.jsx',
];

for (const file of productionSurfaceFiles) {
  const source = fs.readFileSync(path.join(appDir, file), 'utf8');
  assert.equal(
    source.includes('projects/prj_luminous_archive/cockpit'),
    false,
    `${file} must not route production users into the sample cockpit`,
  );
}

const projectCreateSource = fs.readFileSync(path.join(appDir, 'projects/ProjectCreatePanel.jsx'), 'utf8');
assert.ok(projectCreateSource.includes('const [template, setTemplate]'), 'seed intake should expose starter templates');
assert.ok(projectCreateSource.includes('const [premise, setPremise]'), 'seed intake should capture premise context');
assert.ok(projectCreateSource.includes('activationSummary'), 'seed creation should display activation cockpit stats');
assert.ok(projectCreateSource.includes('Starter cockpit created'), 'seed creation should frame starter output as cockpit state');

const projectsPageSource = fs.readFileSync(path.join(appDir, 'projects/page.jsx'), 'utf8');
assert.ok(projectsPageSource.includes('PackInstallPanel'), 'workspace should expose the pack installer surface');
assert.ok(projectsPageSource.includes('service.listPacks'), 'workspace should load the hosted pack registry');
assert.ok(projectsPageSource.includes('installedPackCount'), 'workspace project cards should show installed pack state');
assert.ok(projectsPageSource.includes('readWorkspaceContext'), 'workspace should catch auth and tenant setup failures');
assert.ok(projectsPageSource.includes('Workspace access required'), 'workspace should explain missing auth or workspace context');
assert.ok(projectsPageSource.includes('readProjectListing'), 'workspace should catch project listing setup failures');
assert.ok(projectsPageSource.includes('Storage setup required'), 'workspace should explain missing storage instead of crashing');

const packInstallSource = fs.readFileSync(path.join(appDir, 'projects/PackInstallPanel.jsx'), 'utf8');
assert.ok(packInstallSource.includes("'use client'"), 'pack installer should be interactive client UI');
assert.ok(
  packInstallSource.includes('fetch(`/api/projects/${encodeURIComponent(projectId)}/packs`'),
  'pack installer should call the tenant-scoped project pack route',
);
assert.ok(packInstallSource.includes('packAccess?.allowed'), 'pack installer should respect entitlement access');
assert.ok(packInstallSource.includes('activationSummary'), 'pack installer should surface post-install activation state');

const cockpitSource = fs.readFileSync(path.join(appDir, 'projects/[id]/cockpit/page.jsx'), 'utf8');
assert.ok(cockpitSource.includes('context.installedPacks'), 'cockpit should read installed pack context');
assert.ok(cockpitSource.includes('data-installed-packs'), 'cockpit should expose installed pack telemetry');

const mcpRouteSource = fs.readFileSync(path.join(appDir, 'api/mcp/route.js'), 'utf8');
assert.ok(mcpRouteSource.includes("message.method === 'initialize'"), 'hosted MCP should support JSON-RPC initialize');
assert.ok(mcpRouteSource.includes("message.method === 'tools/list'"), 'hosted MCP should support JSON-RPC tools/list');
assert.ok(mcpRouteSource.includes("message.method !== 'tools/call'"), 'hosted MCP should route JSON-RPC tools/call');
assert.ok(mcpRouteSource.includes('createMcpToolCallResult'), 'hosted MCP should return MCP tool-call content envelopes');
assert.ok(mcpRouteSource.includes("'authoros/scope'"), 'hosted MCP tool list should expose AuthorOS scope metadata');
assert.ok(mcpRouteSource.includes('error.jsonRpcResponse'), 'hosted MCP JSON-RPC auth errors should keep JSON-RPC error bodies');
assert.ok(mcpRouteSource.includes('www-authenticate'), 'hosted MCP auth errors should include WWW-Authenticate discovery');
assert.ok(mcpRouteSource.includes("message.method === 'resources/templates/list'"), 'hosted MCP should expose resource templates');
assert.ok(mcpRouteSource.includes("message.method === 'resources/read'"), 'hosted MCP should read project resources');
assert.ok(mcpRouteSource.includes("message.method === 'prompts/get'"), 'hosted MCP should return workflow prompt templates');
assert.ok(mcpRouteSource.includes('uriTemplate: `authoros://projects/{projectId}/${kind}`'), 'hosted MCP should advertise project resource templates');
assert.ok(mcpRouteSource.includes('list_packs'), 'hosted MCP should expose pack registry discovery');
assert.ok(mcpRouteSource.includes('install_pack'), 'hosted MCP should expose pack installation');

const packRegistryRouteSource = fs.readFileSync(path.join(appDir, 'api/packs/route.js'), 'utf8');
assert.ok(packRegistryRouteSource.includes('listPacks'), 'hosted API should expose pack registry');
const projectPackRouteSource = fs.readFileSync(path.join(appDir, 'api/projects/[id]/packs/route.js'), 'utf8');
assert.ok(projectPackRouteSource.includes('installPack'), 'hosted API should install packs into project graphs');

const setupPageSource = fs.readFileSync(path.join(appDir, 'setup/page.jsx'), 'utf8');
assert.ok(setupPageSource.includes('baselinePlan'), 'setup surface should expose the safe baseline env plan');
assert.ok(setupPageSource.includes('Safe Baseline'), 'setup surface should label deterministic non-secret env commands');
assert.ok(setupPageSource.includes('powershellCommand'), 'setup command rows should render apply-ready baseline commands');
assert.ok(setupPageSource.includes('remoteEnvAuditPlan'), 'setup surface should expose remote Vercel env audit evidence');

const opsPageSource = fs.readFileSync(path.join(appDir, 'ops/page.jsx'), 'utf8');
assert.ok(opsPageSource.includes('getHostedProductionEvidence'), 'ops surface should load hosted production evidence');
assert.ok(opsPageSource.includes('operatorNextActions'), 'ops surface should expose the production operator queue');
assert.ok(opsPageSource.includes('data-operator-next-action'), 'ops surface should make queued actions inspectable');
assert.ok(opsPageSource.includes('Operator Next Actions'), 'ops surface should label the production operator queue');
assert.ok(opsPageSource.includes('Production Evidence'), 'ops surface should label the hosted production evidence ledger');
assert.ok(opsPageSource.includes('data-production-evidence-ledger'), 'ops surface should render the production evidence ledger');
assert.ok(opsPageSource.includes('data-production-evidence-check'), 'ops surface should make failed production checks inspectable');

const clientConfigRouteSource = fs.readFileSync(path.join(appDir, 'api/mcp/client-config/route.js'), 'utf8');
assert.ok(clientConfigRouteSource.includes('buildAuthorOsMcpClientConfig'), 'hosted MCP should expose install-ready client config');
assert.ok(clientConfigRouteSource.includes('cache-control'), 'hosted MCP client config should avoid stale endpoint metadata');

const { GET: getMcpClientConfig } = await import('../app/api/mcp/client-config/route.js');
const clientConfigResponse = await getMcpClientConfig(new Request('https://author.example.com/api/mcp/client-config?host=codex&mode=hosted&tokenEnv=AUTHOROS_TEST_TOKEN'));
const clientConfig = await clientConfigResponse.json();
assert.equal(clientConfig.kind, 'author-os-mcp-client-config');
assert.equal(clientConfig.host, 'codex');
assert.equal(clientConfig.mode, 'hosted');
assert.equal(clientConfig.mcpServers['author-os'], undefined);
assert.equal(clientConfig.mcpServers['author-os-cloud'].url, 'https://author.example.com/api/mcp');
assert.equal(clientConfig.mcpServers['author-os-cloud'].headers.Authorization, 'Bearer ${AUTHOROS_TEST_TOKEN}');
assert.equal(
  clientConfig.mcpServers['author-os-cloud'].oauth.protectedResourceMetadataUrl,
  'https://author.example.com/.well-known/oauth-protected-resource',
);

console.log('Cockpit tests passed.');

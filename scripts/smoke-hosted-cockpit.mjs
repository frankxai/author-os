#!/usr/bin/env node

import { spawn, spawnSync } from 'node:child_process';

const port = Number(process.env.AUTHOROS_SMOKE_PORT || 3220);
const baseUrl = `http://127.0.0.1:${port}`;
const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const timeoutMs = Number(process.env.AUTHOROS_SMOKE_TIMEOUT_MS || 60000);
const isWindows = process.platform === 'win32';

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error(`Invalid AUTHOROS_SMOKE_PORT: ${process.env.AUTHOROS_SMOKE_PORT}`);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function stopProcessTree(child) {
  if (!child || child.exitCode !== null) return;
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
  } else {
    child.kill('SIGTERM');
  }
  await sleep(500);
}

async function fetchJson(pathname, options = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    ...options,
    headers: {
      'content-type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!response.ok) {
    throw new Error(`${pathname} returned ${response.status}: ${text.slice(0, 300)}`);
  }
  return { status: response.status, body };
}

async function fetchOk(pathname) {
  const response = await fetch(`${baseUrl}${pathname}`);
  if (!response.ok) throw new Error(`${pathname} returned ${response.status}`);
  return response.status;
}

async function fetchText(pathname) {
  const response = await fetch(`${baseUrl}${pathname}`);
  const text = await response.text();
  if (!response.ok) throw new Error(`${pathname} returned ${response.status}: ${text.slice(0, 300)}`);
  return { status: response.status, text };
}

function sameEndpointOrigin(actualUrl, expectedOrigin) {
  try {
    const actual = new URL(actualUrl);
    const expected = new URL(expectedOrigin);
    const actualHost = actual.hostname === '127.0.0.1' ? 'localhost' : actual.hostname;
    const expectedHost = expected.hostname === '127.0.0.1' ? 'localhost' : expected.hostname;
    return actual.protocol === expected.protocol
      && actualHost === expectedHost
      && actual.port === expected.port;
  } catch {
    return false;
  }
}

const serverArgs = ['--filter', '@author-os/cockpit', 'exec', 'next', 'start', '-p', String(port)];
const command = isWindows ? 'cmd.exe' : pnpm;
const args = isWindows ? ['/d', '/s', '/c', `${pnpm} ${serverArgs.join(' ')}`] : serverArgs;

const child = spawn(command, args, {
  cwd: process.cwd(),
  env: {
    ...process.env,
    AUTHOROS_DEMO_MODE: 'true',
    AUTHOROS_REQUIRE_AUTH: 'false',
    AUTHOROS_PROJECT_ADAPTER: 'demo',
    NEXT_TELEMETRY_DISABLED: '1',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
  windowsHide: true,
});

let stderr = '';
child.stderr.on('data', chunk => {
  stderr += chunk.toString();
});

try {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(`${baseUrl}/api/system/readiness`);
      if (response.ok) break;
    } catch {
      await sleep(500);
      continue;
    }
    await sleep(500);
  }

  const readiness = await fetchJson('/api/system/readiness');
  const setupContract = await fetchJson('/api/system/setup-contract');
  const launchPlan = await fetchJson('/api/system/launch-plan');
  const productionEvidence = await fetchJson('/api/system/production-evidence');
  const oauthResource = await fetchJson('/.well-known/oauth-protected-resource');
  const context = await fetchJson('/api/projects/prj_luminous_archive/context');
  const assets = await fetchJson('/api/projects/prj_luminous_archive/assets?limit=5');
  const assetIntake = await fetchJson('/api/projects/prj_luminous_archive/assets', {
    method: 'POST',
    body: JSON.stringify({
      title: 'Smoke visual reference',
      type: 'moodboard',
      filename: 'smoke-reference.txt',
      contentType: 'text/plain',
      contentBase64: Buffer.from('smoke asset bytes').toString('base64'),
      rights: 'operator-verified',
      usedIn: ['ent_archive'],
      tags: ['smoke', 'asset'],
      provenance: {
        sourceTool: 'hosted-smoke',
      },
    }),
  });
  const created = await fetchJson('/api/projects', {
    method: 'POST',
    body: JSON.stringify({
      title: 'Smoke Novel',
      genre: ['mystery'],
      targetWords: 65000,
      template: 'mystery-thriller',
      premise: 'A smoke-test archivist finds tomorrow in yesterday records.',
      audience: 'mystery readers who like literary puzzles',
    }),
  });
  if (created.body.activationSummary?.mode !== 'starter') {
    throw new Error(`starter project activation summary missing: ${JSON.stringify(created.body.activationSummary)}`);
  }
  if (Number(created.body.activationSummary.sceneCount || 0) < 3 || Number(created.body.activationSummary.taskCount || 0) < 4) {
    throw new Error(`starter project did not create enough cockpit state: ${JSON.stringify(created.body.activationSummary)}`);
  }
  const packRegistry = await fetchJson('/api/packs');
  const projectPackInstall = await fetchJson(`/api/projects/${created.body.project.id}/packs`, {
    method: 'POST',
    body: JSON.stringify({
      packId: 'authoros-foundry-pack',
    }),
  });
  if (projectPackInstall.body.installed?.length !== 6 || projectPackInstall.body.noProseGenerated !== true) {
    throw new Error(`project pack install failed: ${JSON.stringify(projectPackInstall.body)}`);
  }
  const importedProject = await fetchJson('/api/projects', {
    method: 'POST',
    body: JSON.stringify({
      title: 'Smoke Imported Manuscript',
      genre: ['fantasy'],
      targetWords: 72000,
      sourceName: 'smoke-import.md',
      manuscriptText: [
        '# Smoke Imported Manuscript',
        '',
        '## Chapter One',
        '',
        'The smoke test imports manuscript text into the hosted story graph.',
        '',
        '## Chapter Two',
        '',
        'The imported manuscript keeps author text reviewable before agents touch it.',
      ].join('\n'),
    }),
  });
  const mcpList = await fetchJson('/api/mcp', {
    method: 'POST',
    body: JSON.stringify({ tool: 'list_projects', input: {} }),
  });
  const mcp = await fetchJson('/api/mcp', {
    method: 'POST',
    body: JSON.stringify({ tool: 'read_project_context', input: { projectId: 'prj_luminous_archive' } }),
  });
  const mcpScene = await fetchJson('/api/mcp', {
    method: 'POST',
    body: JSON.stringify({
      tool: 'create_scene',
      input: {
        projectId: 'prj_luminous_archive',
        title: 'Smoke MCP Scene',
        synopsis: 'Created through the hosted MCP smoke test.',
        text: 'The hosted MCP endpoint now creates traceable scenes.',
      },
    }),
  });
  const mcpPackList = await fetchJson('/api/mcp', {
    method: 'POST',
    body: JSON.stringify({ tool: 'list_packs', input: {} }),
  });
  const mcpPackInstall = await fetchJson('/api/mcp', {
    method: 'POST',
    body: JSON.stringify({
      tool: 'install_pack',
      input: {
        projectId: 'prj_luminous_archive',
        packId: 'launch-assets',
      },
    }),
  });
  const mcpInitialize = await fetchJson('/api/mcp', {
    method: 'POST',
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 'init-1',
      method: 'initialize',
      params: {
        clientInfo: {
          name: 'author-os-smoke',
          version: '0.2.0',
        },
      },
    }),
  });
  const mcpTools = await fetchJson('/api/mcp', {
    method: 'POST',
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 'tools-1',
      method: 'tools/list',
    }),
  });
  const mcpContextCall = await fetchJson('/api/mcp', {
    method: 'POST',
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 'context-1',
      method: 'tools/call',
      params: {
        name: 'read_project_context',
        arguments: {
          projectId: 'prj_luminous_archive',
        },
      },
    }),
  });
  const mcpResourceTemplates = await fetchJson('/api/mcp', {
    method: 'POST',
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 'resource-templates-1',
      method: 'resources/templates/list',
    }),
  });
  const mcpResources = await fetchJson('/api/mcp', {
    method: 'POST',
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 'resources-1',
      method: 'resources/list',
    }),
  });
  const mcpContextResource = await fetchJson('/api/mcp', {
    method: 'POST',
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 'resource-read-1',
      method: 'resources/read',
      params: {
        uri: 'authoros://projects/prj_luminous_archive/context',
      },
    }),
  });
  const mcpPrompts = await fetchJson('/api/mcp', {
    method: 'POST',
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 'prompts-1',
      method: 'prompts/list',
    }),
  });
  const mcpPrompt = await fetchJson('/api/mcp', {
    method: 'POST',
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 'prompt-1',
      method: 'prompts/get',
      params: {
        name: 'authoros_project_brief',
        arguments: {
          projectId: 'prj_luminous_archive',
        },
      },
    }),
  });
  const managedAiRun = await fetchJson('/api/projects/prj_luminous_archive/agent-runs', {
    method: 'POST',
    body: JSON.stringify({
      taskType: 'revise_scene',
      sceneId: 'sc_01',
      instruction: 'Smoke-test managed AI routing with a reviewable proposal.',
      useManagedAi: true,
    }),
  });
  const cockpitPage = await fetchText('/projects/prj_luminous_archive/cockpit');
  const cockpitStatus = cockpitPage.status;
  const signInStatus = await fetchOk('/sign-in');
  const serviceIntake = await fetchJson('/api/service-intake', {
    method: 'POST',
    body: JSON.stringify({
      email: 'smoke@author-os.local',
      projectTitle: 'Smoke Novel',
      goals: ['verify hosted service intake'],
      requestedServices: ['concierge-setup'],
    }),
  });
  const billingCheckout = await fetchJson('/api/billing/stripe/checkout', {
    method: 'POST',
    body: JSON.stringify({
      offerId: 'cloud-creator',
      email: 'smoke@author-os.local',
      successUrl: '/checkout/success?session_id={CHECKOUT_SESSION_ID}',
      cancelUrl: '/checkout/cancel',
    }),
  });
  const billingWebhook = await fetchJson('/api/billing/stripe/webhook', {
    method: 'POST',
    body: JSON.stringify({
      id: 'evt_smoke_checkout',
      type: 'checkout.session.completed',
      created: 1783210000,
      data: {
        object: {
          id: 'cs_smoke_author',
          object: 'checkout.session',
          customer: 'cus_smoke_author',
          subscription: 'sub_smoke_author',
          client_reference_id: 'wrk_arcanea_demo',
          amount_total: 2900,
          currency: 'usd',
          metadata: {
            workspaceId: 'wrk_arcanea_demo',
            userId: 'demo-user',
            offerId: 'cloud-creator',
          },
        },
      },
    }),
  });
  const billingStatus = await fetchJson('/api/billing/status');
  const billingPortal = await fetchJson('/api/billing/stripe/portal', {
    method: 'POST',
    body: JSON.stringify({
      returnUrl: '/billing',
    }),
  });
  const mcpClientConfig = await fetchJson('/api/mcp/client-config?host=codex&mode=hosted&tokenEnv=AUTHOROS_TEST_TOKEN');
  const projectsPage = await fetchText('/projects');
  const projectsPageStatus = projectsPage.status;
  const billingPageStatus = await fetchOk('/billing');
  const setupPageStatus = await fetchOk('/setup');
  const opsPage = await fetchText('/ops');
  const opsPageStatus = opsPage.status;
  const liveVerify = spawnSync(process.execPath, ['scripts/verify-live-cockpit.mjs', baseUrl, '--allow-http', '--json'], {
    cwd: process.cwd(),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (liveVerify.status !== 0) {
    throw new Error(`live verifier failed: ${liveVerify.stdout || liveVerify.stderr}`);
  }

  const mcpListEnvelope = JSON.parse(mcpList.body.result.content[0].text);
  const mcpEnvelope = JSON.parse(mcp.body.result.content[0].text);
  const mcpSceneEnvelope = JSON.parse(mcpScene.body.result.content[0].text);
  const mcpPackListEnvelope = JSON.parse(mcpPackList.body.result.content[0].text);
  const mcpPackInstallEnvelope = JSON.parse(mcpPackInstall.body.result.content[0].text);
  if (mcpInitialize.body.result?.serverInfo?.name !== 'author-os') {
    throw new Error(`MCP initialize failed: ${JSON.stringify(mcpInitialize.body)}`);
  }
  if (!mcpTools.body.result?.tools?.some(tool => tool.name === 'read_project_context')) {
    throw new Error(`MCP tools/list missing read_project_context: ${JSON.stringify(mcpTools.body)}`);
  }
  if (mcpContextCall.body.result?.structuredContent?.data?.projectId !== 'prj_luminous_archive') {
    throw new Error(`MCP tools/call did not return project context: ${JSON.stringify(mcpContextCall.body)}`);
  }
  if (!mcpResourceTemplates.body.result?.resourceTemplates?.some(template => template.uriTemplate === 'authoros://projects/{projectId}/context')) {
    throw new Error(`MCP resource templates missing project context: ${JSON.stringify(mcpResourceTemplates.body)}`);
  }
  if (!mcpResources.body.result?.resources?.some(resource => resource.uri === 'authoros://projects/prj_luminous_archive/context')) {
    throw new Error(`MCP resources/list missing project context resource: ${JSON.stringify(mcpResources.body)}`);
  }
  const mcpContextResourceEnvelope = JSON.parse(mcpContextResource.body.result.contents[0].text);
  if (mcpContextResourceEnvelope.data.projectId !== 'prj_luminous_archive') {
    throw new Error(`MCP resources/read did not return project context: ${JSON.stringify(mcpContextResource.body)}`);
  }
  if (!mcpPrompts.body.result?.prompts?.some(prompt => prompt.name === 'authoros_project_brief')) {
    throw new Error(`MCP prompts/list missing project brief prompt: ${JSON.stringify(mcpPrompts.body)}`);
  }
  if (!mcpPrompt.body.result?.messages?.[0]?.content?.text?.includes('authoros://projects/prj_luminous_archive/context')) {
    throw new Error(`MCP prompts/get did not include resource guidance: ${JSON.stringify(mcpPrompt.body)}`);
  }
  if (packRegistry.body.registry?.manifest?.id !== 'authoros-foundry-pack') {
    throw new Error(`pack registry missing Foundry Pack: ${JSON.stringify(packRegistry.body)}`);
  }
  if (mcpPackListEnvelope.data.registry.manifest.id !== 'authoros-foundry-pack') {
    throw new Error(`MCP list_packs missing Foundry Pack: ${JSON.stringify(mcpPackList.body)}`);
  }
  if (!mcpPackInstallEnvelope.data.installed.includes('launch-assets')) {
    throw new Error(`MCP install_pack did not install launch-assets: ${JSON.stringify(mcpPackInstall.body)}`);
  }
  const hostedMcpConfigUrl = mcpClientConfig.body.mcpServers?.['author-os-cloud']?.url || '';
  if (!hostedMcpConfigUrl.endsWith('/api/mcp') || !sameEndpointOrigin(hostedMcpConfigUrl, baseUrl)) {
    throw new Error(`MCP client config did not point at hosted endpoint: ${JSON.stringify(mcpClientConfig.body)}`);
  }
  if (mcpClientConfig.body.mcpServers['author-os-cloud'].headers.Authorization !== 'Bearer ${AUTHOROS_TEST_TOKEN}') {
    throw new Error(`MCP client config embedded an unexpected Authorization header: ${JSON.stringify(mcpClientConfig.body)}`);
  }
  if (!projectsPage.text.includes('data-pack-installer') || !projectsPage.text.includes('Foundry Packs') || !projectsPage.text.includes('Full Foundry')) {
    throw new Error('Projects page did not render the Foundry Pack installer surface.');
  }
  if (!projectsPage.text.includes('No prose generation') || !projectsPage.text.includes('Install selected')) {
    throw new Error('Projects page did not render pack trust and install controls.');
  }
  if (!cockpitPage.text.includes('Trust Layer') || !cockpitPage.text.includes('Packs')) {
    throw new Error('Cockpit page did not render pack trust telemetry.');
  }
  if (!opsPage.text.includes('data-production-evidence-ledger') || !opsPage.text.includes('Production Evidence')) {
    throw new Error('Ops page did not render the hosted production evidence ledger.');
  }
  if (!opsPage.text.includes('data-operator-next-action') || !opsPage.text.includes('Operator Next Actions')) {
    throw new Error('Ops page did not render the production operator next-action queue.');
  }
  const liveVerifyStatus = JSON.parse(liveVerify.stdout).status;

  console.log(JSON.stringify({
    readinessStatus: readiness.body.cloud.status,
    setupContractStatus: setupContract.body.setupContract.status,
    setupConnectorCount: setupContract.body.setupContract.summary.connectorCount,
    launchStatus: readiness.body.launch.status,
    launchPlanStatus: launchPlan.body.launchPlan.status,
    productionEvidenceStatus: productionEvidence.body.status,
    productionEvidenceChecks: productionEvidence.body.summary.checkCount,
    oauthResource: oauthResource.body.resource,
    oauthAuthorizationServers: oauthResource.body.authorization_servers.length,
    oauthScopes: oauthResource.body.scopes_supported.length,
    liveVerifyStatus,
    contextProjectId: context.body.projectId,
    assetCount: assets.body.count,
    assetPersistence: assetIntake.body.persistence,
    assetStorage: assetIntake.body.asset.provenance.storage,
    assetId: assetIntake.body.asset.id,
    createdProjectTitle: created.body.project.title,
    createdProjectMode: created.body.activationSummary.mode,
    createdProjectTemplate: created.body.activationSummary.template,
    createdProjectScenes: created.body.activationSummary.sceneCount,
    createdProjectTasks: created.body.activationSummary.taskCount,
    packRegistryCount: packRegistry.body.registry.packs.length,
    projectPackInstalled: projectPackInstall.body.installed.length,
    projectInstalledPackCount: projectPackInstall.body.activationSummary.installedPackCount,
    importedProjectTitle: importedProject.body.project.title,
    importedProjectMode: importedProject.body.importSummary.mode,
    importedProjectScenes: importedProject.body.importSummary.sceneCount,
    mcpStatus: mcpEnvelope.status,
    mcpProjectCount: mcpListEnvelope.data.projects.length,
    mcpContextProjectId: mcpEnvelope.data.projectId,
    mcpCreatedSceneTitle: mcpSceneEnvelope.data.scene.title,
    mcpPackRegistryCount: mcpPackListEnvelope.data.registry.packs.length,
    mcpPackInstalled: mcpPackInstallEnvelope.data.installed.join(','),
    mcpJsonRpcProtocol: mcpInitialize.body.result.protocolVersion,
    mcpJsonRpcToolCount: mcpTools.body.result.tools.length,
    mcpJsonRpcContextProjectId: mcpContextCall.body.result.structuredContent.data.projectId,
    mcpResourceTemplateCount: mcpResourceTemplates.body.result.resourceTemplates.length,
    mcpResourceCount: mcpResources.body.result.resources.length,
    mcpReadResourceProjectId: mcpContextResourceEnvelope.data.projectId,
    mcpPromptCount: mcpPrompts.body.result.prompts.length,
    mcpPromptName: mcpPrompt.body.result.description ? 'authoros_project_brief' : null,
    mcpClientConfigHost: mcpClientConfig.body.host,
    mcpClientConfigMode: mcpClientConfig.body.mode,
    mcpClientConfigUrl: mcpClientConfig.body.mcpServers['author-os-cloud'].url,
    managedAiMode: managedAiRun.body.managedAi.mode,
    managedAiModel: managedAiRun.body.managedAi.model,
    managedAiCreditEntryId: managedAiRun.body.creditLedgerEntry.id,
    serviceIntakePersistence: serviceIntake.body.persistence,
    checkoutMode: billingCheckout.body.mode,
    checkoutOfferId: billingCheckout.body.checkout.offerId,
    checkoutUrl: billingCheckout.body.checkout.url,
    checkoutPersistence: billingCheckout.body.persistence,
    checkoutPersistedEventId: billingCheckout.body.persisted.billingEventId,
    billingPersistence: billingWebhook.body.persistence,
    billingCreditGrantId: billingWebhook.body.persisted.creditGrantId,
    billingStatusPlan: billingStatus.body.billing.plan,
    billingStatusSource: billingStatus.body.billing.source,
    billingHasStripeCustomer: billingStatus.body.billing.hasStripeCustomer,
    billingPortalMode: billingPortal.body.mode,
    billingPortalUrl: billingPortal.body.portal.url,
    billingPortalPersistedEventId: billingPortal.body.persisted.billingEventId,
    projectsPackInstallerPresent: projectsPage.text.includes('data-pack-installer'),
    projectsPackTrustPresent: projectsPage.text.includes('No prose generation'),
    cockpitPackTrustTelemetry: cockpitPage.text.includes('Packs'),
    projectsPageStatus,
    billingPageStatus,
    setupPageStatus,
    opsProductionEvidenceLedgerPresent: opsPage.text.includes('data-production-evidence-ledger'),
    opsOperatorQueuePresent: opsPage.text.includes('data-operator-next-action'),
    opsPageStatus,
    cockpitStatus,
    signInStatus,
  }, null, 2));
} catch (error) {
  console.error(error.message);
  if (stderr.trim()) console.error(stderr.trim());
  process.exitCode = 1;
} finally {
  await stopProcessTree(child);
}

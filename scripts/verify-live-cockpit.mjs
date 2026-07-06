#!/usr/bin/env node

const args = process.argv.slice(2);
const valueFlags = new Set(['--timeout-ms', '--vercel-bypass-secret', '--vercel-set-bypass-cookie']);
const positional = getPositionalArgs(args);
const baseUrlInput = positional[0] || process.env.AUTHOROS_VERIFY_URL || process.env.NEXT_PUBLIC_APP_URL || '';
const timeoutMs = Number(getFlagValue('--timeout-ms', process.env.AUTHOROS_VERIFY_TIMEOUT_MS || 30000));
const wantsJson = hasFlag('--json');
const requireReady = hasFlag('--require-ready');
const requirePromotable = hasFlag('--require-promotable');
const expectProduction = hasFlag('--expect-production');
const allowHttp = hasFlag('--allow-http');
const vercelBypassSecret = getFlagValue('--vercel-bypass-secret')
  || process.env.AUTHOROS_VERCEL_PROTECTION_BYPASS
  || process.env.VERCEL_AUTOMATION_BYPASS_SECRET
  || process.env.VERCEL_PROTECTION_BYPASS_SECRET
  || '';
const useVercelBypassQuery = hasFlag('--vercel-bypass-query');
const vercelSetBypassCookie = getFlagValue('--vercel-set-bypass-cookie', process.env.AUTHOROS_VERCEL_SET_BYPASS_COOKIE || '');
const cookieJar = new Map();

function hasFlag(flag) {
  return args.includes(flag);
}

function getFlagValue(flag, fallback = null) {
  const inlinePrefix = `${flag}=`;
  const inline = args.find(arg => arg.startsWith(inlinePrefix));
  if (inline) return inline.slice(inlinePrefix.length);
  const index = args.indexOf(flag);
  if (index === -1 || index + 1 >= args.length) return fallback;
  return args[index + 1];
}

function getPositionalArgs(argv) {
  const positionalArgs = [];
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg.startsWith('--')) {
      const flag = arg.includes('=') ? arg.slice(0, arg.indexOf('=')) : arg;
      if (!arg.includes('=') && valueFlags.has(flag)) index += 1;
      continue;
    }
    positionalArgs.push(arg);
  }
  return positionalArgs;
}

function normalizeBaseUrl(value) {
  if (!value) throw new Error('Usage: node scripts/verify-live-cockpit.mjs <https://app-url> [--require-ready]');
  const url = new URL(value.startsWith('http') ? value : `https://${value}`);
  url.pathname = '';
  url.hash = '';
  const isLocal = ['localhost', '127.0.0.1', '::1'].includes(url.hostname);
  if (url.protocol !== 'https:' && !isLocal && !allowHttp) {
    throw new Error(`Refusing non-HTTPS live verification URL: ${url.origin}. Pass --allow-http only for isolated test targets.`);
  }
  return {
    origin: url.origin,
    inheritedQuery: url.search,
  };
}

function buildEndpointUrl(baseUrl, pathname, inheritedQuery = '', options = {}) {
  const url = new URL(pathname, baseUrl);
  if (inheritedQuery) {
    const inheritedParams = new URLSearchParams(inheritedQuery);
    for (const [key, value] of inheritedParams.entries()) {
      if (!url.searchParams.has(key)) url.searchParams.set(key, value);
    }
  }
  if (options.vercelBypassSecret && options.useVercelBypassQuery) {
    url.searchParams.set('x-vercel-protection-bypass', options.vercelBypassSecret);
    if (options.vercelSetBypassCookie) {
      url.searchParams.set('x-vercel-set-bypass-cookie', options.vercelSetBypassCookie);
    }
  }
  return url.toString();
}

function rememberCookies(response) {
  const rawCookies = typeof response.headers.getSetCookie === 'function'
    ? response.headers.getSetCookie()
    : response.headers.get('set-cookie')
      ? [response.headers.get('set-cookie')]
      : [];
  for (const rawCookie of rawCookies) {
    const cookie = String(rawCookie || '').split(';')[0];
    const separator = cookie.indexOf('=');
    if (separator <= 0) continue;
    cookieJar.set(cookie.slice(0, separator), cookie.slice(separator + 1));
  }
}

function renderCookieHeader() {
  return Array.from(cookieJar.entries())
    .map(([name, value]) => `${name}=${value}`)
    .join('; ');
}

function createVerificationHeaders(extraHeaders = {}) {
  const headers = {
    'accept': 'application/json,text/html;q=0.9,*/*;q=0.8',
    ...extraHeaders,
  };
  if (vercelBypassSecret && !useVercelBypassQuery) {
    headers['x-vercel-protection-bypass'] = vercelBypassSecret;
    if (vercelSetBypassCookie) {
      headers['x-vercel-set-bypass-cookie'] = vercelSetBypassCookie;
    }
  }
  if (!headers.cookie && cookieJar.size) {
    headers.cookie = renderCookieHeader();
  }
  return headers;
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: createVerificationHeaders(options.headers || {}),
    });
    rememberCookies(response);
    return response;
  } finally {
    clearTimeout(timeout);
  }
}

async function warmVercelShareAccess(baseUrl, inheritedQuery) {
  if (!String(inheritedQuery || '').includes('_vercel_share=')) return null;
  const response = await fetchWithTimeout(buildEndpointUrl(baseUrl, '/', inheritedQuery), {
    redirect: 'manual',
    headers: {
      accept: 'text/html,application/json;q=0.9,*/*;q=0.8',
    },
  });
  const location = response.headers.get('location');
  if (location && response.status >= 300 && response.status < 400) {
    const redirected = new URL(location, baseUrl);
    if (redirected.origin === baseUrl) {
      await fetchWithTimeout(redirected.toString(), {
        headers: {
          accept: 'text/html,application/json;q=0.9,*/*;q=0.8',
        },
      }).catch(() => {});
    }
  }
  return {
    status: response.status,
    cookieCount: cookieJar.size,
  };
}

async function readEndpoint(baseUrl, pathname, options = {}) {
  const response = await fetchWithTimeout(buildEndpointUrl(baseUrl, pathname, options.inheritedQuery, {
    vercelBypassSecret,
    useVercelBypassQuery,
    vercelSetBypassCookie,
  }), options);
  const text = await response.text();
  let body = text;
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = text;
    }
  }
  return {
    pathname,
    url: response.url,
    ok: response.ok,
    status: response.status,
    redirected: response.redirected,
    contentType,
    body,
    textPreview: typeof body === 'string' ? body.slice(0, 240) : null,
  };
}

async function postJsonEndpoint(baseUrl, pathname, payload, options = {}) {
  const response = await fetchWithTimeout(buildEndpointUrl(baseUrl, pathname, options.inheritedQuery, {
    vercelBypassSecret,
    useVercelBypassQuery,
    vercelSetBypassCookie,
  }), {
    method: 'POST',
    headers: {
      accept: 'application/json,text/html;q=0.9,*/*;q=0.8',
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const text = await response.text();
  let body = text;
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = text;
    }
  }
  return {
    pathname,
    url: response.url,
    ok: response.ok,
    status: response.status,
    contentType,
    body,
    textPreview: typeof body === 'string' ? body.slice(0, 240) : null,
  };
}

function addCheck(checks, id, label, pass, detail, severity = 'blocker') {
  checks.push({
    id,
    label,
    status: pass ? 'pass' : severity === 'warning' ? 'warn' : 'blocked',
    detail,
    severity,
  });
}

function addSkippedCheck(checks, id, label, detail) {
  checks.push({
    id,
    label,
    status: 'skipped',
    detail,
    severity: 'info',
  });
}

function addProtectedAwareCheck(checks, id, label, protectionBlocked, pass, detail, severity = 'blocker') {
  if (protectionBlocked) {
    addSkippedCheck(
      checks,
      id,
      label,
      'Skipped because Vercel deployment protection or SSO returned an interstitial before the AuthorOS app contract could be inspected.',
    );
    return;
  }
  addCheck(checks, id, label, pass, detail, severity);
}

function getNested(object, path) {
  return path.split('.').reduce((value, key) => value?.[key], object);
}

function endpointBody(endpoint) {
  return endpoint?.body && typeof endpoint.body === 'object' ? endpoint.body : {};
}

function isLikelyVercelProtection(endpoint) {
  const preview = String(endpoint?.textPreview || endpoint?.body || '').toLowerCase();
  const finalUrl = String(endpoint?.url || '').toLowerCase();
  const contentType = String(endpoint?.contentType || '').toLowerCase();
  const routeShouldBeMachineReadable = String(endpoint?.pathname || '').startsWith('/api/')
    || String(endpoint?.pathname || '').startsWith('/.well-known/');
  return finalUrl.includes('vercel.com/sso-api')
    || (contentType.includes('text/html') && preview.includes('data-dpl-id') && preview.includes('dash'))
    || preview.includes('vercel authentication')
    || preview.includes('deployment protection')
    || preview.includes('sso-api')
    || (contentType.includes('text/html') && preview.includes('vercel'))
    || (routeShouldBeMachineReadable && contentType.includes('text/html') && (preview.includes('<!doctype') || preview.includes('<html')));
}

function isJsonEndpoint(endpoint) {
  return String(endpoint?.contentType || '').toLowerCase().includes('application/json')
    && endpoint?.body
    && typeof endpoint.body === 'object';
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

async function main() {
  const normalizedUrl = normalizeBaseUrl(baseUrlInput);
  const baseUrl = normalizedUrl.origin;
  const inheritedQuery = normalizedUrl.inheritedQuery;
  const endpoints = {};
  const checks = [];
  const shareAccess = await warmVercelShareAccess(baseUrl, inheritedQuery);

  const endpointSpecs = [
    ['readiness', '/api/system/readiness'],
    ['setupContract', '/api/system/setup-contract'],
    ['launchPlan', '/api/system/launch-plan'],
    ['productionEvidence', '/api/system/production-evidence'],
    ['packRegistry', '/api/packs'],
    ['mcpManifest', '/api/mcp'],
    ['mcpClientConfig', '/api/mcp/client-config?host=codex&mode=hosted&tokenEnv=AUTHOROS_VERIFY_TOKEN'],
    ['oauthResource', '/.well-known/oauth-protected-resource'],
    ['signIn', '/sign-in'],
    ['projects', '/projects'],
    ['setup', '/setup'],
    ['billing', '/billing'],
    ['ops', '/ops'],
  ];

  for (const [key, pathname] of endpointSpecs) {
    endpoints[key] = await readEndpoint(baseUrl, pathname, { inheritedQuery });
  }

  endpoints.mcpInitialize = await postJsonEndpoint(baseUrl, '/api/mcp', {
    jsonrpc: '2.0',
    id: 'verify-init',
    method: 'initialize',
    params: {
      clientInfo: {
        name: 'author-os-live-verifier',
        version: '0.2.0',
      },
    },
  }, { inheritedQuery });
  endpoints.mcpToolsList = await postJsonEndpoint(baseUrl, '/api/mcp', {
    jsonrpc: '2.0',
    id: 'verify-tools',
    method: 'tools/list',
  }, { inheritedQuery });
  endpoints.mcpResourceTemplates = await postJsonEndpoint(baseUrl, '/api/mcp', {
    jsonrpc: '2.0',
    id: 'verify-resource-templates',
    method: 'resources/templates/list',
  }, { inheritedQuery });
  endpoints.mcpPromptsList = await postJsonEndpoint(baseUrl, '/api/mcp', {
    jsonrpc: '2.0',
    id: 'verify-prompts',
    method: 'prompts/list',
  }, { inheritedQuery });

  const protectedEndpoints = Object.values(endpoints).filter(isLikelyVercelProtection);
  const protectionBlocked = protectedEndpoints.length > 0;
  addCheck(
    checks,
    'vercel-deployment-protection',
    'Vercel preview is accessible to API verifier',
    !protectionBlocked,
    protectionBlocked
      ? `${protectedEndpoints.length} endpoint(s) returned Vercel deployment protection or SSO HTML instead of app JSON. Configure Protection Bypass for Automation, set VERCEL_AUTOMATION_BYPASS_SECRET or AUTHOROS_VERCEL_PROTECTION_BYPASS, then rerun with the default header mode or --vercel-bypass-query if headers are unavailable.`
      : 'No deployment-protection interstitial detected.',
  );

  addProtectedAwareCheck(checks, 'readiness-endpoint', 'System readiness endpoint responds', protectionBlocked, endpoints.readiness.ok, `/api/system/readiness returned ${endpoints.readiness.status}.`);
  addProtectedAwareCheck(checks, 'setup-contract-endpoint', 'Setup contract endpoint responds', protectionBlocked, endpoints.setupContract.ok, `/api/system/setup-contract returned ${endpoints.setupContract.status}.`);
  addProtectedAwareCheck(checks, 'launch-plan-endpoint', 'Launch plan endpoint responds', protectionBlocked, endpoints.launchPlan.ok, `/api/system/launch-plan returned ${endpoints.launchPlan.status}.`);
  addProtectedAwareCheck(checks, 'production-evidence-endpoint', 'Production evidence endpoint responds', protectionBlocked, endpoints.productionEvidence.ok, `/api/system/production-evidence returned ${endpoints.productionEvidence.status}.`);
  addProtectedAwareCheck(checks, 'pack-registry-endpoint', 'Pack registry endpoint responds', protectionBlocked, endpoints.packRegistry.ok, `/api/packs returned ${endpoints.packRegistry.status}.`);
  addProtectedAwareCheck(checks, 'mcp-manifest-endpoint', 'MCP discovery endpoint responds', protectionBlocked, endpoints.mcpManifest.ok, `/api/mcp returned ${endpoints.mcpManifest.status}.`);
  addProtectedAwareCheck(checks, 'mcp-client-config-endpoint', 'MCP client config endpoint responds', protectionBlocked, endpoints.mcpClientConfig.ok, `/api/mcp/client-config returned ${endpoints.mcpClientConfig.status}.`);
  addProtectedAwareCheck(checks, 'oauth-resource-endpoint', 'OAuth protected resource metadata responds', protectionBlocked, endpoints.oauthResource.ok, `/.well-known/oauth-protected-resource returned ${endpoints.oauthResource.status}.`);
  addProtectedAwareCheck(checks, 'sign-in-endpoint', 'Sign-in surface responds', protectionBlocked, endpoints.signIn.ok, `/sign-in returned ${endpoints.signIn.status}.`, 'warning');
  addProtectedAwareCheck(checks, 'projects-surface-endpoint', 'Workspace project surface responds', protectionBlocked, endpoints.projects.ok, `/projects returned ${endpoints.projects.status}.`, 'warning');
  addProtectedAwareCheck(checks, 'setup-surface-endpoint', 'Setup contract surface responds', protectionBlocked, endpoints.setup.ok, `/setup returned ${endpoints.setup.status}.`, 'warning');
  addProtectedAwareCheck(checks, 'billing-surface-endpoint', 'Billing command deck responds', protectionBlocked, endpoints.billing.ok, `/billing returned ${endpoints.billing.status}.`, 'warning');
  addProtectedAwareCheck(checks, 'ops-surface-endpoint', 'Production launch ops responds', protectionBlocked, endpoints.ops.ok, `/ops returned ${endpoints.ops.status}.`, 'warning');

  const apiEndpoints = [endpoints.readiness, endpoints.setupContract, endpoints.launchPlan, endpoints.productionEvidence, endpoints.packRegistry, endpoints.mcpManifest, endpoints.mcpClientConfig];
  const nonJsonApiEndpoints = apiEndpoints.filter(endpoint => !isJsonEndpoint(endpoint));
  addProtectedAwareCheck(
    checks,
    'api-json-endpoints',
    'Live API endpoints return JSON',
    protectionBlocked,
    nonJsonApiEndpoints.length === 0,
    nonJsonApiEndpoints.length
      ? `${nonJsonApiEndpoints.length} API endpoint(s) returned non-JSON content. This usually means Vercel deployment protection, an auth interstitial, or an output/routing configuration issue.`
      : 'All API verification endpoints returned JSON.',
  );

  const readiness = endpointBody(endpoints.readiness);
  const setupContractEnvelope = endpointBody(endpoints.setupContract);
  const setupContract = setupContractEnvelope.setupContract || {};
  const launchPlanEnvelope = endpointBody(endpoints.launchPlan);
  const launchPlan = launchPlanEnvelope.launchPlan || {};
  const productionEvidence = endpointBody(endpoints.productionEvidence);
  const packRegistry = endpointBody(endpoints.packRegistry);
  const mcp = endpointBody(endpoints.mcpManifest);
  const mcpClientConfig = endpointBody(endpoints.mcpClientConfig);
  const oauth = endpointBody(endpoints.oauthResource);
  const mcpInitialize = endpointBody(endpoints.mcpInitialize);
  const mcpToolsList = endpointBody(endpoints.mcpToolsList);
  const mcpResourceTemplates = endpointBody(endpoints.mcpResourceTemplates);
  const mcpPromptsList = endpointBody(endpoints.mcpPromptsList);

  addProtectedAwareCheck(
    checks,
    'readiness-shape',
    'Readiness payload has cloud and launch sections',
    protectionBlocked,
    Boolean(readiness.cloud && readiness.launch),
    `cloud=${Boolean(readiness.cloud)} launch=${Boolean(readiness.launch)}.`,
  );
  addProtectedAwareCheck(
    checks,
    'setup-contract-shape',
    'Setup contract payload has connectors and proof endpoints',
    protectionBlocked,
    Array.isArray(setupContract.connectors) && Array.isArray(setupContract.proofEndpoints),
    `connectors=${setupContract.connectors?.length || 0} proofEndpoints=${setupContract.proofEndpoints?.length || 0}.`,
  );
  const remoteEnvAuditPlan = setupContract.remoteEnvAuditPlan || {};
  addProtectedAwareCheck(
    checks,
    'setup-contract-remote-env-audit',
    'Setup contract exposes remote Vercel env audit evidence',
    protectionBlocked,
    Boolean(
      remoteEnvAuditPlan.command?.includes('cloud-env --vercel --audit')
        && remoteEnvAuditPlan.note?.toLowerCase().includes('presence')
    ),
    `command=${remoteEnvAuditPlan.command ? 'present' : 'missing'} note=${remoteEnvAuditPlan.note ? 'present' : 'missing'}.`,
  );
  addProtectedAwareCheck(
    checks,
    'launch-plan-shape',
    'Launch plan payload has stages and actions',
    protectionBlocked,
    Array.isArray(launchPlan.stages) && Array.isArray(launchPlan.actions),
    `stages=${launchPlan.stages?.length || 0} actions=${launchPlan.actions?.length || 0}.`,
  );
  addProtectedAwareCheck(
    checks,
    'production-evidence-shape',
    'Production evidence payload has status, checks, and evidence sections',
    protectionBlocked,
    Boolean(productionEvidence.kind === 'hosted-production-evidence' && productionEvidence.status && productionEvidence.evidence && Array.isArray(productionEvidence.checks)),
    `kind=${productionEvidence.kind || 'missing'} status=${productionEvidence.status || 'missing'} checks=${productionEvidence.checks?.length || 0}.`,
  );
  addProtectedAwareCheck(
    checks,
    'pack-registry-shape',
    'Pack registry exposes the Foundry Pack catalog',
    protectionBlocked,
    packRegistry.registry?.manifest?.id === 'authoros-foundry-pack' && Array.isArray(packRegistry.registry?.packs) && packRegistry.registry.packs.length >= 6,
    `manifest=${packRegistry.registry?.manifest?.id || 'missing'} packs=${packRegistry.registry?.packs?.length || 0}.`,
  );
  addProtectedAwareCheck(
    checks,
    'mcp-tools-shape',
    'MCP manifest exposes tools',
    protectionBlocked,
    Array.isArray(mcp.tools) && mcp.tools.length > 0,
    `tools=${mcp.tools?.length || 0}.`,
  );
  addProtectedAwareCheck(
    checks,
    'mcp-pack-tools-shape',
    'MCP manifest exposes pack discovery and install tools',
    protectionBlocked,
    Array.isArray(mcp.tools) && ['list_packs', 'install_pack'].every(name => mcp.tools.some(tool => tool.name === name)),
    `packTools=${Array.isArray(mcp.tools) ? mcp.tools.filter(tool => ['list_packs', 'install_pack'].includes(tool.name)).map(tool => tool.name).join(',') : 'missing'}.`,
  );
  addProtectedAwareCheck(
    checks,
    'mcp-client-config-shape',
    'MCP client config is install-ready and token-safe',
    protectionBlocked,
    mcpClientConfig.kind === 'author-os-mcp-client-config'
      && String(mcpClientConfig.mcpServers?.['author-os-cloud']?.url || '').endsWith('/api/mcp')
      && sameEndpointOrigin(mcpClientConfig.mcpServers?.['author-os-cloud']?.url, baseUrl)
      && mcpClientConfig.mcpServers?.['author-os-cloud']?.headers?.Authorization === 'Bearer ${AUTHOROS_VERIFY_TOKEN}',
    `kind=${mcpClientConfig.kind || 'missing'} url=${mcpClientConfig.mcpServers?.['author-os-cloud']?.url || 'missing'} auth=${mcpClientConfig.mcpServers?.['author-os-cloud']?.headers?.Authorization || 'missing'}.`,
  );
  addProtectedAwareCheck(
    checks,
    'mcp-jsonrpc-initialize',
    'MCP JSON-RPC initialize responds',
    protectionBlocked,
    endpoints.mcpInitialize.ok && mcpInitialize.result?.serverInfo?.name === 'author-os',
    `status=${endpoints.mcpInitialize.status} server=${mcpInitialize.result?.serverInfo?.name || 'missing'} protocol=${mcpInitialize.result?.protocolVersion || 'missing'}.`,
  );
  addProtectedAwareCheck(
    checks,
    'mcp-jsonrpc-tools-list',
    'MCP JSON-RPC tools/list exposes AuthorOS tools',
    protectionBlocked,
    endpoints.mcpToolsList.ok && Array.isArray(mcpToolsList.result?.tools) && mcpToolsList.result.tools.some(tool => tool.name === 'read_project_context'),
    `status=${endpoints.mcpToolsList.status} tools=${mcpToolsList.result?.tools?.length || 0}.`,
  );
  addProtectedAwareCheck(
    checks,
    'mcp-jsonrpc-pack-tools',
    'MCP JSON-RPC tools/list exposes pack discovery and install tools',
    protectionBlocked,
    endpoints.mcpToolsList.ok && Array.isArray(mcpToolsList.result?.tools) && ['list_packs', 'install_pack'].every(name => mcpToolsList.result.tools.some(tool => tool.name === name)),
    `status=${endpoints.mcpToolsList.status} packTools=${Array.isArray(mcpToolsList.result?.tools) ? mcpToolsList.result.tools.filter(tool => ['list_packs', 'install_pack'].includes(tool.name)).map(tool => tool.name).join(',') : 'missing'}.`,
  );
  addProtectedAwareCheck(
    checks,
    'mcp-jsonrpc-tool-metadata',
    'MCP JSON-RPC tools include scope metadata',
    protectionBlocked,
    Array.isArray(mcpToolsList.result?.tools) && mcpToolsList.result.tools.some(tool => tool._meta?.['authoros/scope'] && tool._meta?.['authoros/requiredRole']),
    `metadataTools=${Array.isArray(mcpToolsList.result?.tools) ? mcpToolsList.result.tools.filter(tool => tool._meta?.['authoros/scope']).length : 0}.`,
  );
  addProtectedAwareCheck(
    checks,
    'mcp-jsonrpc-resource-templates',
    'MCP JSON-RPC resource templates expose AuthorOS project context',
    protectionBlocked,
    endpoints.mcpResourceTemplates.ok && Array.isArray(mcpResourceTemplates.result?.resourceTemplates) && mcpResourceTemplates.result.resourceTemplates.some(template => template.uriTemplate === 'authoros://projects/{projectId}/context'),
    `status=${endpoints.mcpResourceTemplates.status} resourceTemplates=${mcpResourceTemplates.result?.resourceTemplates?.length || 0}.`,
  );
  addProtectedAwareCheck(
    checks,
    'mcp-jsonrpc-prompts-list',
    'MCP JSON-RPC prompts/list exposes AuthorOS workflows',
    protectionBlocked,
    endpoints.mcpPromptsList.ok && Array.isArray(mcpPromptsList.result?.prompts) && mcpPromptsList.result.prompts.some(prompt => prompt.name === 'authoros_project_brief'),
    `status=${endpoints.mcpPromptsList.status} prompts=${mcpPromptsList.result?.prompts?.length || 0}.`,
  );
  addProtectedAwareCheck(
    checks,
    'oauth-resource-shape',
    'OAuth metadata names a protected resource',
    protectionBlocked,
    Boolean(oauth.resource || oauth.protected_resource) && Array.isArray(oauth.authorization_servers) && oauth.authorization_servers.length > 0,
    `resource=${oauth.resource || oauth.protected_resource || 'missing'} authorizationServers=${oauth.authorization_servers?.length || 0}.`,
  );
  addProtectedAwareCheck(
    checks,
    'oauth-resource-mcp-endpoint',
    'OAuth metadata identifies the hosted MCP endpoint',
    protectionBlocked,
    String(oauth.resource || oauth.protected_resource || '').endsWith('/api/mcp') && String(oauth.mcp_endpoint || '').endsWith('/api/mcp'),
    `resource=${oauth.resource || oauth.protected_resource || 'missing'} mcp_endpoint=${oauth.mcp_endpoint || 'missing'}.`,
  );
  addProtectedAwareCheck(
    checks,
    'oauth-resource-scopes',
    'OAuth metadata exposes AuthorOS MCP scopes',
    protectionBlocked,
    Array.isArray(oauth.scopes_supported) && ['authoros:read', 'authoros:write', 'authoros:agents', 'authoros:export'].every(scope => oauth.scopes_supported.includes(scope)),
    `scopes=${Array.isArray(oauth.scopes_supported) ? oauth.scopes_supported.join(',') : 'missing'}.`,
  );

  const launchReady = readiness.launch?.status === 'ready';
  const setupContractBlockers = Number(setupContract.summary?.blockedConnectorCount ?? 999);
  const launchPlanBlockers = Number(launchPlan.summary?.blockerCount ?? 999);
  const launchPlanReviews = Number(launchPlan.summary?.reviewCount ?? 999);
  const productionEvidenceBlockers = Number(productionEvidence.summary?.blockerCount ?? 999);
  const productionEvidenceReviews = Number(productionEvidence.summary?.reviewCount ?? 999);
  const noLaunchPlanBlockers = launchPlanBlockers === 0;
  const promotable = launchPlan.status === 'ready';

  addProtectedAwareCheck(
    checks,
    'strict-launch-ready',
    'Strict launch readiness is ready',
    protectionBlocked,
    launchReady,
    `launch.status=${readiness.launch?.status || 'missing'}.`,
    requireReady ? 'blocker' : 'warning',
  );
  addProtectedAwareCheck(
    checks,
    'setup-contract-no-blockers',
    'Setup contract has no blocked connectors',
    protectionBlocked,
    setupContractBlockers === 0,
    `blockedConnectors=${setupContractBlockers}.`,
    requireReady ? 'blocker' : 'warning',
  );
  addProtectedAwareCheck(
    checks,
    'launch-plan-no-blockers',
    'Launch plan has no blockers',
    protectionBlocked,
    noLaunchPlanBlockers,
    `blockers=${launchPlanBlockers} reviews=${launchPlanReviews}.`,
    requireReady ? 'blocker' : 'warning',
  );
  addProtectedAwareCheck(
    checks,
    'launch-plan-promotable',
    'Launch plan is promotable',
    protectionBlocked,
    promotable,
    `launchPlan.status=${launchPlan.status || 'missing'}.`,
    requirePromotable ? 'blocker' : 'warning',
  );
  addProtectedAwareCheck(
    checks,
    'hosted-production-evidence-no-blockers',
    'Hosted production evidence has no blockers',
    protectionBlocked,
    productionEvidenceBlockers === 0,
    `productionEvidence.status=${productionEvidence.status || 'missing'} blockers=${productionEvidenceBlockers} reviews=${productionEvidenceReviews}.`,
    requireReady ? 'blocker' : 'warning',
  );

  if (expectProduction) {
    const runtime = readiness.runtime || launchPlanEnvelope.runtime || {};
    addProtectedAwareCheck(
      checks,
      'production-demo-disabled',
      'Production does not serve demo runtime',
      protectionBlocked,
      readiness.launch?.demoMode === false && runtime.projectAdapter !== 'demo',
      `demoMode=${readiness.launch?.demoMode} adapter=${runtime.projectAdapter || 'missing'}.`,
    );
    addProtectedAwareCheck(
      checks,
      'production-auth-required',
      'Production requires auth',
      protectionBlocked,
      getNested(runtime, 'auth.required') === true,
      `auth.required=${getNested(runtime, 'auth.required')}.`,
    );
  }

  const blocked = checks.filter(check => check.status === 'blocked');
  const warnings = checks.filter(check => check.status === 'warn');
  const skipped = checks.filter(check => check.status === 'skipped');
  const report = {
    status: blocked.length ? 'blocked' : warnings.length ? 'needs_review' : 'ready',
    generatedAt: new Date().toISOString(),
    baseUrl,
    requireReady,
    requirePromotable,
    expectProduction,
    vercelProtection: {
      bypassProvided: Boolean(vercelBypassSecret),
      bypassMode: vercelBypassSecret ? useVercelBypassQuery ? 'query' : 'header' : shareAccess ? 'temporary_share' : 'none',
      setBypassCookie: vercelSetBypassCookie || null,
      temporaryShareCookie: shareAccess ? shareAccess.cookieCount > 0 : false,
      protectedEndpointCount: protectedEndpoints.length,
      protectedEndpoints: protectedEndpoints.map(endpoint => endpoint.pathname),
    },
    summary: {
      checkCount: checks.length,
      blockerCount: blocked.length,
      warningCount: warnings.length,
      skippedCount: skipped.length,
    },
    readiness: {
      cloudStatus: readiness.cloud?.status || null,
      launchStatus: readiness.launch?.status || null,
      demoMode: readiness.launch?.demoMode ?? null,
      runtime: readiness.runtime || null,
    },
    setupContract: {
      status: setupContract.status || null,
      blockedConnectorCount: setupContract.summary?.blockedConnectorCount ?? null,
      reviewConnectorCount: setupContract.summary?.reviewConnectorCount ?? null,
      connectorCount: setupContract.summary?.connectorCount ?? null,
      remoteEnvAuditPlan: {
        present: Boolean(remoteEnvAuditPlan.command),
        command: remoteEnvAuditPlan.command || null,
        note: remoteEnvAuditPlan.note || null,
      },
      nextAction: setupContract.nextAction || null,
    },
    launchPlan: {
      status: launchPlan.status || null,
      blockerCount: launchPlan.summary?.blockerCount ?? null,
      reviewCount: launchPlan.summary?.reviewCount ?? null,
      nextAction: launchPlan.nextAction || null,
    },
    productionEvidence: {
      status: productionEvidence.status || null,
      blockerCount: productionEvidence.summary?.blockerCount ?? null,
      warningCount: productionEvidence.summary?.warningCount ?? null,
      reviewCount: productionEvidence.summary?.reviewCount ?? null,
    },
    packs: {
      manifestId: packRegistry.registry?.manifest?.id || null,
      packCount: Array.isArray(packRegistry.registry?.packs) ? packRegistry.registry.packs.length : 0,
      registryVersion: packRegistry.registry?.version || null,
    },
    mcp: {
      toolCount: Array.isArray(mcp.tools) ? mcp.tools.length : 0,
      jsonRpcToolCount: Array.isArray(mcpToolsList.result?.tools) ? mcpToolsList.result.tools.length : 0,
      jsonRpcProtocol: mcpInitialize.result?.protocolVersion || null,
      resourceTemplateCount: Array.isArray(mcpResourceTemplates.result?.resourceTemplates) ? mcpResourceTemplates.result.resourceTemplates.length : 0,
      promptCount: Array.isArray(mcpPromptsList.result?.prompts) ? mcpPromptsList.result.prompts.length : 0,
      clientConfigMode: mcpClientConfig.mode || null,
      clientConfigHost: mcpClientConfig.host || null,
      clientConfigUrl: mcpClientConfig.mcpServers?.['author-os-cloud']?.url || null,
      server: mcp.server || mcp.name || null,
    },
    checks,
  };

  if (wantsJson) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(`AuthorOS live verification: ${report.status}`);
    console.log(`  URL: ${report.baseUrl}`);
    console.log(`  Readiness: ${report.readiness.launchStatus || 'missing'}`);
    console.log(`  Launch plan: ${report.launchPlan.status || 'missing'} (${report.launchPlan.blockerCount ?? 'unknown'} blocker(s))`);
    console.log(`  Production evidence: ${report.productionEvidence.status || 'missing'} (${report.productionEvidence.blockerCount ?? 'unknown'} blocker(s))`);
    console.log(`  Packs: ${report.packs.packCount} (${report.packs.manifestId || 'missing'})`);
    console.log(`  MCP tools: ${report.mcp.toolCount}`);
    for (const check of checks) {
      const marker = check.status === 'pass' ? 'PASS' : check.status === 'warn' ? 'WARN' : check.status === 'skipped' ? 'SKIP' : 'BLOCK';
      console.log(`  ${marker.padEnd(5)} ${check.label}: ${check.detail}`);
    }
  }

  if (report.status === 'blocked') process.exit(1);
}

main().catch(error => {
  const report = {
    status: 'blocked',
    generatedAt: new Date().toISOString(),
    error: {
      code: error.name || 'LIVE_VERIFY_FAILED',
      message: error.message,
    },
  };
  if (wantsJson) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.error(`AuthorOS live verification failed: ${error.message}`);
  }
  process.exit(1);
});

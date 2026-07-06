const DEFAULT_VERSION = '0.2.0';
const DEFAULT_HOSTED_ENDPOINT = 'https://your-author-cockpit.example.com/api/mcp';
const DEFAULT_OAUTH_SCOPES = ['authoros:read', 'authoros:write', 'authoros:agents', 'authoros:export'];

export function normalizeMcpEndpoint(value) {
  if (!value) return DEFAULT_HOSTED_ENDPOINT;
  try {
    const url = new URL(String(value).startsWith('http') ? String(value) : `https://${value}`);
    if (!url.pathname || url.pathname === '/') url.pathname = '/api/mcp';
    if (!url.pathname.endsWith('/api/mcp')) url.pathname = `${url.pathname.replace(/\/$/, '')}/api/mcp`;
    url.search = '';
    url.hash = '';
    return url.toString();
  } catch {
    return DEFAULT_HOSTED_ENDPOINT;
  }
}

export function mcpOriginFromEndpoint(endpoint) {
  try {
    return new URL(endpoint).origin;
  } catch {
    return new URL(DEFAULT_HOSTED_ENDPOINT).origin;
  }
}

function normalizeMode(mode) {
  return ['local', 'hosted', 'both'].includes(mode) ? mode : 'both';
}

function createLocalServer(input = {}) {
  const command = input.localCommand || 'author-os-mcp';
  const args = Array.isArray(input.localArgs) ? input.localArgs : ['--stdio-lite'];
  return {
    command,
    args,
    env: {
      AUTHOR_OS_ROOT: input.localRoot || '.',
      ...(input.localEnv || {}),
    },
  };
}

function createHostedServer(input = {}) {
  const hostedEndpoint = normalizeMcpEndpoint(input.hostedUrl || input.url);
  const hostedOrigin = mcpOriginFromEndpoint(hostedEndpoint);
  const tokenEnv = input.tokenEnv || 'AUTHOROS_MCP_TOKEN';
  return {
    transport: 'streamable-http',
    url: hostedEndpoint,
    headers: {
      Authorization: `Bearer \${${tokenEnv}}`,
    },
    oauth: {
      protectedResourceMetadataUrl: `${hostedOrigin}/.well-known/oauth-protected-resource`,
      scopes: input.scopes || DEFAULT_OAUTH_SCOPES,
    },
  };
}

export function buildAuthorOsMcpClientConfig(input = {}) {
  const mode = normalizeMode(input.mode);
  const host = input.host || 'generic';
  const tokenEnv = input.tokenEnv || 'AUTHOROS_MCP_TOKEN';
  const hostedEndpoint = normalizeMcpEndpoint(input.hostedUrl || input.url);
  const mcpServers = {};
  if (mode === 'local' || mode === 'both') mcpServers[input.localName || 'author-os'] = createLocalServer(input);
  if (mode === 'hosted' || mode === 'both') mcpServers[input.hostedName || 'author-os-cloud'] = createHostedServer({
    ...input,
    hostedUrl: hostedEndpoint,
    tokenEnv,
  });

  const output = {
    kind: 'author-os-mcp-client-config',
    version: input.version || DEFAULT_VERSION,
    generatedAt: input.generatedAt || new Date().toISOString(),
    host,
    mode,
    mcpServers,
    usage: {
      local: 'Use the local stdio server for open-core projects and file-backed writing sessions.',
      hosted: `Set ${tokenEnv} in your agent host secret/env store before using hosted Author Cockpit MCP.`,
      security: 'This config intentionally references token env var names and never embeds token values.',
    },
  };
  if (host === 'claude' || host === 'codex') {
    output.install = {
      target: host,
      copy: 'Copy the mcpServers object into the host MCP settings, or save this file and import it if your host supports config import.',
    };
  }
  return {
    host,
    mode,
    localRoot: input.localRoot || '.',
    hostedEndpoint,
    output,
  };
}

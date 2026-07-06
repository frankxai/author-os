import { buildAuthorOsMcpClientConfig } from '@author-os/mcp/client-config';

function readParam(url, name, fallback = undefined) {
  const value = url.searchParams.get(name);
  return value === null || value === '' ? fallback : value;
}

export async function GET(request) {
  const url = new URL(request.url);
  const hostedUrl = new URL('/api/mcp', url.origin).toString();
  const config = buildAuthorOsMcpClientConfig({
    mode: readParam(url, 'mode', 'hosted'),
    host: readParam(url, 'host', 'generic'),
    hostedUrl,
    tokenEnv: readParam(url, 'tokenEnv', readParam(url, 'token-env', 'AUTHOROS_MCP_TOKEN')),
    localRoot: readParam(url, 'root', '.'),
    localCommand: readParam(url, 'localCommand', 'author-os-mcp'),
    localArgs: ['--stdio-lite'],
  });

  return Response.json(config.output, {
    headers: {
      'cache-control': 'no-store',
    },
  });
}

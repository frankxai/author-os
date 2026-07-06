#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const verifierSource = fs.readFileSync(path.resolve('scripts/verify-live-cockpit.mjs'), 'utf8');
const evidenceSource = fs.readFileSync(path.resolve('scripts/collect-production-evidence.mjs'), 'utf8');

assert.ok(
  verifierSource.includes('warmVercelShareAccess'),
  'live verifier should warm temporary Vercel share URLs before endpoint checks',
);
assert.ok(
  verifierSource.includes('postJsonEndpoint'),
  'live verifier should be able to POST JSON-RPC checks to hosted MCP',
);
assert.ok(
  verifierSource.includes("method: 'initialize'"),
  'live verifier should check the MCP JSON-RPC initialize handshake',
);
assert.ok(
  verifierSource.includes("method: 'tools/list'"),
  'live verifier should check MCP JSON-RPC tool discovery',
);
assert.ok(
  verifierSource.includes('mcp-jsonrpc-tool-metadata'),
  'live verifier should check hosted AuthorOS scope metadata in JSON-RPC tools/list',
);
assert.ok(
  verifierSource.includes('mcp-jsonrpc-resource-templates'),
  'live verifier should check hosted AuthorOS MCP resource templates',
);
assert.ok(
  verifierSource.includes('mcp-jsonrpc-prompts-list'),
  'live verifier should check hosted AuthorOS MCP prompts/list',
);
assert.ok(
  verifierSource.includes('/api/mcp/client-config'),
  'live verifier should check hosted MCP client config availability',
);
assert.ok(
  verifierSource.includes('/api/packs'),
  'live verifier should check hosted pack registry availability',
);
assert.ok(
  verifierSource.includes('pack-registry-shape'),
  'live verifier should verify the Foundry Pack registry shape',
);
assert.ok(
  verifierSource.includes('setup-contract-remote-env-audit'),
  'live verifier should verify the remote Vercel env audit evidence plan',
);
assert.ok(
  verifierSource.includes('mcp-jsonrpc-pack-tools'),
  'live verifier should check pack tools through MCP JSON-RPC discovery',
);
assert.ok(
  verifierSource.includes("['list_packs', 'install_pack']"),
  'live verifier should require pack discovery and install tools in MCP manifests',
);
assert.ok(
  verifierSource.includes('mcp-client-config-shape'),
  'live verifier should verify hosted MCP client config shape and token-env safety',
);
assert.ok(
  verifierSource.includes('new URLSearchParams(inheritedQuery)'),
  'live verifier should merge temporary share query params without replacing endpoint query params',
);
assert.ok(
  verifierSource.includes('_vercel_share='),
  'live verifier should detect Vercel temporary share query URLs',
);
assert.ok(
  verifierSource.includes('rememberCookies(response)'),
  'live verifier should persist protected-preview cookies across endpoint checks',
);
assert.ok(
  verifierSource.includes('temporary_share'),
  'live verifier report should distinguish temporary share access from long-lived bypass secrets',
);
assert.ok(
  verifierSource.includes('x-vercel-protection-bypass'),
  'live verifier should retain the automation bypass header path',
);
assert.ok(
  verifierSource.includes('addProtectedAwareCheck'),
  'live verifier should gate dependent contract checks when deployment protection blocks app JSON',
);
assert.ok(
  verifierSource.includes("status: 'skipped'"),
  'live verifier should mark dependent protected-preview checks as skipped instead of unrelated blockers',
);
assert.ok(
  verifierSource.includes('protectedEndpointCount'),
  'live verifier should report how many endpoints were hidden behind deployment protection',
);
assert.ok(
  verifierSource.includes('skippedCount'),
  'live verifier summary should expose skipped checks for operator evidence',
);
assert.ok(
  evidenceSource.includes('sanitizeLiveUrl'),
  'production evidence should sanitize live URLs before saving reports',
);
assert.ok(
  evidenceSource.includes("url.searchParams.delete('_vercel_share')"),
  'production evidence should remove temporary Vercel share tokens from saved reports',
);
assert.ok(
  evidenceSource.includes('redactSensitiveUrlToken'),
  'production evidence should redact sensitive URL tokens from command evidence',
);
assert.ok(
  evidenceSource.includes('skippedChecks'),
  'production evidence should preserve skipped live-verification checks in sanitized reports',
);

console.log('Live verifier static tests passed.');

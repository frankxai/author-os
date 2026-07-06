#!/usr/bin/env node

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const repoRoot = path.resolve('.');
const secretValue = 'do-not-print-this-token-value';

function runConfig(args = []) {
  const result = spawnSync(process.execPath, ['bin/author.js', 'mcp', '--client-config', '--json', ...args], {
    cwd: repoRoot,
    encoding: 'utf8',
    env: {
      ...process.env,
      AUTHOROS_MCP_TOKEN: secretValue,
    },
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(result.stdout.includes(secretValue), false, 'MCP client config must not print token values');
  return JSON.parse(result.stdout);
}

const local = runConfig(['--mode', 'local', '--root', repoRoot, '--host', 'claude']);
assert.equal(local.kind, 'author-os-mcp-client-config');
assert.equal(local.mode, 'local');
assert.ok(local.mcpServers['author-os']);
assert.equal(local.mcpServers['author-os'].command, 'node');
assert.ok(local.mcpServers['author-os'].args.some(arg => arg.endsWith(path.join('packages', 'mcp', 'bin', 'author-os-mcp.js'))));
assert.equal(local.mcpServers['author-os'].env.AUTHOR_OS_ROOT, repoRoot);
assert.equal(local.mcpServers['author-os-cloud'], undefined);
assert.equal(local.install.target, 'claude');

const hosted = runConfig([
  '--mode',
  'hosted',
  '--url',
  'https://author.example.com',
  '--token-env',
  'AUTHOROS_TEST_TOKEN',
  '--host',
  'codex',
]);
assert.equal(hosted.mode, 'hosted');
assert.equal(hosted.mcpServers['author-os'], undefined);
assert.equal(hosted.mcpServers['author-os-cloud'].transport, 'streamable-http');
assert.equal(hosted.mcpServers['author-os-cloud'].url, 'https://author.example.com/api/mcp');
assert.equal(hosted.mcpServers['author-os-cloud'].headers.Authorization, 'Bearer ${AUTHOROS_TEST_TOKEN}');
assert.equal(
  hosted.mcpServers['author-os-cloud'].oauth.protectedResourceMetadataUrl,
  'https://author.example.com/.well-known/oauth-protected-resource',
);
assert.equal(hosted.install.target, 'codex');

const both = runConfig(['--mode', 'both', '--url', 'author.example.com/cockpit']);
assert.ok(both.mcpServers['author-os']);
assert.ok(both.mcpServers['author-os-cloud']);
assert.equal(both.mcpServers['author-os-cloud'].url, 'https://author.example.com/cockpit/api/mcp');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'author-os-mcp-config-'));
try {
  const savePath = path.join(tempDir, 'client-config.json');
  const saved = runConfig(['--mode', 'local', '--save', savePath]);
  const savedFile = JSON.parse(fs.readFileSync(savePath, 'utf8'));
  assert.deepEqual(savedFile.mcpServers, saved.mcpServers);
} finally {
  fs.rmSync(tempDir, { recursive: true, force: true });
}

console.log('MCP client config tests passed.');

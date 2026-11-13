import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { buildAuthorOsMcpClientConfig } from '../src/client-config.js';
import { buildMcpToolManifest } from '../src/tools.js';

const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));
const serverPath = path.join(repoRoot, 'packages', 'mcp', 'bin', 'author-os-mcp.js');
const requestOptions = { timeout: 5000 };
const testRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'author-os-native-mcp-'));
const manuscriptRoot = path.join(testRoot, 'manuscript with spaces');
const hostCwd = path.join(testRoot, 'host');
const prose = 'The copper bell rang once across the frozen lake.';
fs.mkdirSync(manuscriptRoot);
fs.mkdirSync(hostCwd);
fs.writeFileSync(path.join(manuscriptRoot, 'authoros.json'), JSON.stringify({ title: 'Native MCP Book' }));

async function withClient(config, check) {
  const client = new Client({ name: 'author-os-stdio-test', version: '1.0.0' });
  const transport = new StdioClientTransport({ ...config, cwd: hostCwd, stderr: 'pipe' });
  const closed = new Promise(resolve => { transport.onclose = resolve; });
  let stderr = '';
  transport.stderr.on('data', data => { stderr += data.toString(); });
  try {
    await client.connect(transport, requestOptions);
    assert.equal(client.getServerVersion().name, 'author-os');
    assert.ok(client.getServerCapabilities().tools);
    await check(client);
    assert.equal(stderr, '', 'Native stdio must not emit harness diagnostics');
  } finally {
    await client.close();
    await transport.close();
    let closeTimer;
    try {
      await Promise.race([
        closed,
        new Promise((resolve, reject) => { closeTimer = setTimeout(() => reject(new Error('MCP child did not close')), 5000); }),
      ]);
    } finally {
      clearTimeout(closeTimer);
    }
    assert.equal(transport.pid, null);
  }
}

try {
  const generated = spawnSync(process.execPath, [
    path.join(repoRoot, 'bin', 'author.js'), 'mcp', '--client-config', '--json',
    '--mode', 'local', '--root', manuscriptRoot,
  ], { cwd: repoRoot, encoding: 'utf8', timeout: 5000 });
  assert.equal(generated.status, 0, generated.stderr);
  const config = JSON.parse(generated.stdout).mcpServers['author-os'];

  await withClient(config, async client => {
    const tools = await client.listTools(undefined, requestOptions);
    assert.deepEqual(tools.tools.map(tool => tool.name).sort(), buildMcpToolManifest().tools.map(tool => tool.name).sort());
    const call = (name, args) => client.callTool({ name, arguments: args }, undefined, requestOptions);
    const created = await call('create_scene', { title: 'The bell', chapterId: 'missing-chapter', text: prose });
    assert.notEqual(created.isError, true);
    assert.equal(JSON.parse(created.content[0].text).success, true);

    const exported = await call('export_book', { format: 'markdown' });
    assert.notEqual(exported.isError, true);
    const exportedFile = JSON.parse(exported.content[0].text).file;
    assert.equal(path.relative(manuscriptRoot, exportedFile), path.join('output', 'book.md'));
    const markdown = fs.readFileSync(exportedFile, 'utf8');
    assert.equal(markdown.split(prose).length - 1, 1);
    assert.equal(fs.existsSync(path.join(hostCwd, '.authoros')), false);

    const graphFile = path.join(manuscriptRoot, '.authoros', 'project.graph.json');
    const savedGraph = fs.readFileSync(graphFile, 'utf8');
    const damagedGraph = '{"project":';
    fs.writeFileSync(graphFile, damagedGraph);
    const refused = await call('export_book', { format: 'markdown' });
    assert.equal(refused.isError, true, 'A refused export must be visible as an MCP tool error');
    assert.equal(JSON.parse(refused.content[0].text).error.code, 'MARKDOWN_EXPORT_REFUSED');
    assert.equal(fs.readFileSync(graphFile, 'utf8'), damagedGraph);
    assert.equal(fs.readFileSync(exportedFile, 'utf8'), markdown);

    fs.writeFileSync(graphFile, savedGraph);
    const resumed = await call('export_book', { format: 'markdown' });
    assert.notEqual(resumed.isError, true);
    const resumedMarkdown = fs.readFileSync(JSON.parse(resumed.content[0].text).file, 'utf8');
    assert.match(resumedMarkdown, /^# Native MCP Book\n/);
    assert.equal(resumedMarkdown.split(prose).length - 1, 1);

    const overrideRoot = path.join(testRoot, 'explicit root');
    fs.mkdirSync(overrideRoot);
    fs.writeFileSync(path.join(overrideRoot, 'authoros.json'), JSON.stringify({ title: 'Explicit root book' }));
    const override = await call('list_projects', { root: overrideRoot });
    assert.equal(JSON.parse(override.content[0].text).projects[0].title, 'Explicit root book');
  });

  assert.deepEqual(buildAuthorOsMcpClientConfig({ mode: 'local' }).output.mcpServers['author-os'].args, ['--stdio']);
  await withClient({ command: process.execPath, args: [serverPath], env: { AUTHOR_OS_ROOT: manuscriptRoot } }, async client => {
    const result = await client.callTool({ name: 'list_projects', arguments: {} }, undefined, requestOptions);
    assert.equal(JSON.parse(result.content[0].text).projects[0].title, 'Native MCP Book');
  });

  const lite = spawnSync(process.execPath, [serverPath, '--stdio-lite'], {
    input: `${JSON.stringify({ id: 'lite-probe', tool: 'tools/list' })}\n`,
    cwd: hostCwd, encoding: 'utf8', timeout: 5000,
  });
  assert.equal(lite.status, 0, lite.stderr);
  assert.equal(JSON.parse(lite.stdout).id, 'lite-probe');
  assert.equal(JSON.parse(lite.stdout).result.name, 'author-os');
} finally {
  fs.rmSync(testRoot, { recursive: true, force: true });
}

console.log('Native MCP stdio tests passed.');

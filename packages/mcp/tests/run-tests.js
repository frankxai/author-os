import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildAuthorOsMcpClientConfig } from '../src/client-config.js';
import { buildMcpToolManifest, callAuthorOsTool } from '../src/tools.js';
import { readAuthorProject } from '../../local/src/index.js';

const manifest = buildMcpToolManifest();
assert.equal(manifest.name, 'author-os');
assert.ok(manifest.tools.some(tool => tool.name === 'read_project_context'));
assert.ok(manifest.tools.some(tool => tool.name === 'run_continuity_check'));
assert.ok(manifest.tools.some(tool => tool.name === 'export_book'));
assert.ok(manifest.tools.some(tool => tool.name === 'read_publishing_readiness'));
assert.ok(manifest.tools.some(tool => tool.name === 'list_packs'));
assert.ok(manifest.tools.some(tool => tool.name === 'install_pack'));

const clientConfig = buildAuthorOsMcpClientConfig({
  mode: 'both',
  host: 'codex',
  localCommand: 'node',
  localArgs: ['packages/mcp/bin/author-os-mcp.js', '--stdio-lite'],
  localRoot: '/author-workspace',
  hostedUrl: 'author.example.com',
  tokenEnv: 'AUTHOROS_TEST_TOKEN',
});
assert.equal(clientConfig.output.kind, 'author-os-mcp-client-config');
assert.equal(clientConfig.output.install.target, 'codex');
assert.equal(clientConfig.output.mcpServers['author-os'].env.AUTHOR_OS_ROOT, '/author-workspace');
assert.equal(clientConfig.output.mcpServers['author-os-cloud'].url, 'https://author.example.com/api/mcp');
assert.equal(clientConfig.output.mcpServers['author-os-cloud'].headers.Authorization, 'Bearer ${AUTHOROS_TEST_TOKEN}');
assert.equal(
  clientConfig.output.mcpServers['author-os-cloud'].oauth.protectedResourceMetadataUrl,
  'https://author.example.com/.well-known/oauth-protected-resource',
);

const unknown = await callAuthorOsTool('__missing__', {});
assert.equal(unknown.content[0].type, 'text');
assert.ok(unknown.content[0].text.includes('UNKNOWN_TOOL'));

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'author-os-mcp-'));
try {
  fs.writeFileSync(path.join(root, 'authoros.json'), JSON.stringify({
    title: 'MCP Test Book',
    stage: 'drafting',
    targetWords: 1000,
  }, null, 2));

  const created = JSON.parse((await callAuthorOsTool('create_scene', {
    root,
    title: 'A Persisted Scene',
    synopsis: 'A scene made through MCP.',
    text: 'The agent wrote a traceable scene.',
  })).content[0].text);
  assert.equal(created.success, true);
  assert.ok(created.run.id);

  const runStatus = JSON.parse((await callAuthorOsTool('get_run_status', {
    root,
    runId: created.run.id,
  })).content[0].text);
  assert.equal(runStatus.found, true);

  const revised = JSON.parse((await callAuthorOsTool('revise_scene', {
    root,
    sceneId: created.scene.id,
    instruction: 'Make the image more tactile.',
    estimatedCostUsd: 0.2,
    includedCreditUsd: 0.05,
  })).content[0].text);
  assert.equal(revised.success, true);
  assert.equal(revised.suggestion.approvalState, 'requested');
  assert.equal(revised.creditLedgerEntry.billableUsd, 0.15);

  const exported = JSON.parse((await callAuthorOsTool('export_book', {
    root,
    format: 'markdown',
  })).content[0].text);
  assert.equal(exported.format, 'markdown');
  assert.ok(exported.export.id);

  const readiness = JSON.parse((await callAuthorOsTool('read_publishing_readiness', { root })).content[0].text);
  assert.ok(['needs_review', 'ready'].includes(readiness.status));
  assert.equal(readiness.creditSummary.entryCount, 1);

  const packs = JSON.parse((await callAuthorOsTool('list_packs', { root })).content[0].text);
  assert.equal(packs.manifest.id, 'authoros-foundry-pack');
  const packInstall = JSON.parse((await callAuthorOsTool('install_pack', {
    root,
    packId: 'launch-assets',
  })).content[0].text);
  assert.equal(packInstall.success, true);
  assert.deepEqual(packInstall.installed, ['launch-assets']);
  assert.equal(packInstall.noProseGenerated, true);

  // Test extract_codex_entities
  const extracted = JSON.parse((await callAuthorOsTool('extract_codex_entities', {
    root,
    text: 'In @[The High Citadel], @Elena spoke with #SunGate.',
  })).content[0].text);
  assert.equal(extracted.extractedTags.length, 3);

  // Test create_character_diamond
  const diamond = JSON.parse((await callAuthorOsTool('create_character_diamond', {
    name: 'Elena',
    desire: 'Cure the fading magic',
    need: 'Accept mortality',
    lie: 'She alone must carry the burden',
    wound: 'Failed her mentor',
  })).content[0].text);
  assert.equal(diamond.success, true);
  assert.equal(diamond.diamond.name, 'Elena');

  // Test anti_slop_lint
  const slopLint = JSON.parse((await callAuthorOsTool('anti_slop_lint', {
    text: 'A testament to their bravery, she felt the tapestry of fate begin to shake.',
  })).content[0].text);
  assert.equal(slopLint.success, true);
  assert.ok(slopLint.report.cliches.length >= 2);

  // Test run_seven_pass_revision
  const sevenPass = JSON.parse((await callAuthorOsTool('run_seven_pass_revision', {
    root,
    sceneId: created.scene.id,
  })).content[0].text);
  assert.equal(sevenPass.success, true);
  assert.equal(sevenPass.report.passes.length, 7);

  // Test format_notion_blocks
  const notionRes = JSON.parse((await callAuthorOsTool('format_notion_blocks', {
    root,
    sceneId: created.scene.id,
  })).content[0].text);
  assert.equal(notionRes.success, true);
  assert.ok(notionRes.blockCount >= 2);

  // Test export_epub_manifest
  const epubRes = JSON.parse((await callAuthorOsTool('export_epub_manifest', { root })).content[0].text);
  assert.equal(epubRes.success, false); // This fixture has scenes but no chapter spine.
  assert.equal(epubRes.error.code, 'EPUB_EXPORT_REFUSED');
  assert.match(epubRes.error.message, /chapters/);

  // Test describe_sensory_expansion
  const sensoryRes = JSON.parse((await callAuthorOsTool('describe_sensory_expansion', {
    focus: 'The Bronze Door',
    genre: 'mythic-fantasy',
  })).content[0].text);
  assert.equal(sensoryRes.success, true);
  assert.equal(sensoryRes.focus, 'The Bronze Door');
  assert.ok(sensoryRes.expansion.sight.length > 0);

  const project = readAuthorProject(root);
  assert.equal(project.agentRuns.length, 2);
  assert.equal(project.suggestions.length, 1);
  assert.equal(project.exports.length, 1);
  assert.ok(project.installedPacks.some(pack => pack.packId === 'launch-assets'));
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}

console.log('MCP tests passed.');

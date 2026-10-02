import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { exportLocalProject } from '../src/index.js';
import { callAuthorOsTool } from '../../mcp/src/tools.js';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'author-epub-test-'));
const graph = { project: { id: 'test', title: 'A reader’s return', author: 'Test author' },
  books: [{ id: 'one' }], chapters: [{ id: 'one', title: 'Home', order: 1 }],
  scenes: [{ id: 'one', chapterId: 'one', order: 1, text: '*Home*, at last. & Ω' }] };
const graphFile = path.join(root, 'authoros.graph.json');
fs.writeFileSync(graphFile, JSON.stringify(graph));
try {
  const original = fs.readFileSync(graphFile);
  const first = exportLocalProject(root, 'epub');
  const bytes = fs.readFileSync(first.file);
  const receipt = JSON.parse(fs.readFileSync(first.receiptFile));
  assert.equal(receipt.checksum, first.checksum);
  assert.equal(receipt.approvalState, 'requested');
  assert.deepEqual(fs.readFileSync(graphFile), original);
  assert.equal(exportLocalProject(root, 'epub').file, first.file);
  assert.deepEqual(fs.readFileSync(first.file), bytes);
  const mcp = JSON.parse((await callAuthorOsTool('export_book', { root, format: 'epub' })).content[0].text);
  assert.equal(mcp.file, first.file);
  assert.equal(mcp.checksum, first.checksum);
  fs.writeFileSync(first.file, 'human replacement');
  assert.throws(() => exportLocalProject(root, 'epub'), /Existing edition differs/);
  assert.equal(fs.readFileSync(first.file, 'utf8'), 'human replacement');
  fs.writeFileSync(first.file, bytes);
  fs.unlinkSync(first.receiptFile); // Simulate interruption after complete EPUB, before receipt.
  assert.equal(exportLocalProject(root, 'epub').file, first.file);
  assert.ok(fs.existsSync(first.receiptFile));
  assert.deepEqual(fs.readFileSync(first.file), bytes);

  graph.scenes[0].text += '\n\nShe opens the door.';
  fs.writeFileSync(graphFile, JSON.stringify(graph));
  const revised = exportLocalProject(root, 'epub');
  assert.notEqual(revised.file, first.file);
  assert.notEqual(revised.sourceSha256, first.sourceSha256);
  assert.deepEqual(fs.readFileSync(first.file), bytes);
  assert.ok(fs.readdirSync(path.join(root, 'output')).every(name => !name.endsWith('.tmp')));
  const cli = spawnSync(process.execPath, [fileURLToPath(new URL('../../../bin/author.js', import.meta.url)), 'export', 'epub'], { cwd: root, encoding: 'utf8', timeout: 10000 });
  assert.equal(cli.status, 0, cli.stderr);
  assert.match(cli.stdout, /book-[a-f0-9]{64}\.epub/);
  assert.equal(fs.readdirSync(path.join(root, 'output')).length, 4);
  const filesRoot = path.join(root, 'files-project');
  fs.mkdirSync(path.join(filesRoot, 'chapters'), { recursive: true });
  fs.writeFileSync(path.join(filesRoot, 'authoros.json'), JSON.stringify({ title: 'The paper road', author: 'Original author', language: 'fr' }));
  const chapterFile = path.join(filesRoot, 'chapters', '01-home.md');
  fs.writeFileSync(chapterFile, '# Retour\n\n*Bonjour*, Ω & 雨.');
  const untouched = fs.readFileSync(chapterFile);
  const filesExport = exportLocalProject(filesRoot, 'epub');
  assert.equal(exportLocalProject(filesRoot, 'epub').checksum, filesExport.checksum);
  const filesBytes = fs.readFileSync(filesExport.file).toString('utf8');
  assert.match(filesBytes, /<dc:creator>Original author<\/dc:creator>/);
  assert.match(filesBytes, /<dc:language>fr<\/dc:language>/);
  assert.deepEqual(fs.readFileSync(chapterFile), untouched);
  assert.equal(fs.existsSync(path.join(filesRoot, '.authoros')), false);
  const linkedRoot = path.join(root, 'linked-project');
  fs.mkdirSync(linkedRoot);
  fs.writeFileSync(path.join(linkedRoot, 'authoros.graph.json'), JSON.stringify(graph));
  fs.symlinkSync(path.join(filesRoot, 'output'), path.join(linkedRoot, 'output'), 'junction');
  assert.throws(() => exportLocalProject(linkedRoot, 'epub'), /must not be a link/);
  assert.equal(fs.readdirSync(path.join(filesRoot, 'output')).length, 2);
  fs.writeFileSync(graphFile, '{broken');
  assert.throws(() => exportLocalProject(root, 'epub'), SyntaxError);
  const refused = JSON.parse((await callAuthorOsTool('export_book', { root, format: 'epub' })).content[0].text);
  assert.equal(refused.error.code, 'EPUB_EXPORT_REFUSED');
  assert.equal(fs.readdirSync(path.join(root, 'output')).length, 4);
  console.log('EPUB local: real CLI, repeat export, source edit, immutable editions, receipt interruption and malformed-source refusal passed.');
} finally {
  // Only this test-created tree, never a repository or caller directory.
  assert.equal(path.dirname(root), fs.realpathSync(os.tmpdir()));
  fs.rmSync(root, { recursive: true });
}

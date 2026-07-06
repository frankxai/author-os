import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildCockpitViewModel, validateProjectGraph } from '../packages/core/src/index.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cli = path.join(repoRoot, 'bin', 'author.js');

function runCli(cwd, args) {
  const result = spawnSync(process.execPath, [cli, ...args], {
    cwd,
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    throw new Error(`author-os ${args.join(' ')} failed\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
  }
  return result;
}

function readGraph(root) {
  return JSON.parse(fs.readFileSync(path.join(root, '.authoros', 'project.graph.json'), 'utf8'));
}

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'author-os-init-'));
const starterRoot = path.join(tempRoot, 'starter');
const blankRoot = path.join(tempRoot, 'blank');
fs.mkdirSync(starterRoot);
fs.mkdirSync(blankRoot);

runCli(starterRoot, [
  'init',
  '--title',
  'CLI Starter Book',
  '--template',
  'mystery-thriller',
  '--genre',
  'mystery, literary thriller',
  '--premise',
  'An archivist finds tomorrow logged in yesterday records.',
  '--audience',
  'mystery readers who like literary puzzles',
]);

const starter = readGraph(starterRoot);
assert.equal(starter.project.title, 'CLI Starter Book');
assert.equal(starter.project.template, 'mystery-thriller');
assert.equal(starter.project.activationMode, 'starter');
assert.equal(starter.chapters.length, 3);
assert.equal(starter.scenes.length, 3);
assert.equal(starter.beats.length, 3);
assert.ok(starter.tasks.some(task => task.id === 'task_seed_continuity'));
assert.ok(starter.assets.some(asset => asset.id === 'asset_starter_brief'));
assert.equal(validateProjectGraph(starter).ok, true);
assert.equal(JSON.parse(fs.readFileSync(path.join(starterRoot, 'authoros.json'), 'utf8')).template, 'mystery-thriller');
assert.ok(buildCockpitViewModel(starter).canvas.nodes.length > 0);

const packList = JSON.parse(runCli(starterRoot, ['packs', '--json']).stdout);
assert.equal(packList.manifest.id, 'authoros-foundry-pack');
assert.equal(packList.packs.length, 6);
const packInstall = JSON.parse(runCli(starterRoot, ['packs', 'install', 'authoros-foundry-pack', '--json']).stdout);
assert.equal(packInstall.noProseGenerated, true);
assert.equal(packInstall.installed.length, 6);
assert.ok(fs.existsSync(path.join(starterRoot, packInstall.receiptFile)));
const packedStarter = readGraph(starterRoot);
assert.equal(packedStarter.installedPacks.length, 6);
assert.ok(packedStarter.tasks.some(task => task.sourcePackId === 'seven-pass-revision'));
assert.ok(packedStarter.assets.some(asset => asset.source === 'authoros-pack'));

runCli(blankRoot, ['init', '--title', 'Blank CLI Book', '--blank']);
const blank = readGraph(blankRoot);
assert.equal(blank.project.title, 'Blank CLI Book');
assert.equal(blank.scenes.length, 0);
assert.equal(blank.tasks.length, 0);
assert.equal(validateProjectGraph(blank).ok, true);

console.log('CLI init tests passed.');

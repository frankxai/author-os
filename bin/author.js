#!/usr/bin/env node

// AuthorOS CLI — the author's command line
// Commands: init, setup, status, cockpit, search, quality, publish, agents

import { execSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildCockpitViewModel,
  buildPackRegistry,
  createEmptyProject,
  createPublishingReadinessReport,
  createStarterProject,
  modelRoutingPolicy,
  offerCatalog,
} from '../packages/core/src/index.js';
import {
  createCloudReadinessChecklist,
  createLaunchOperationsPlan,
  createProductionEnvContract,
  createProductionLaunchChecklist,
  createProductionSetupContract,
  createVercelRemoteEnvAudit,
  createVercelEnvBaselinePlan,
  createVercelEnvCommandPlan,
  createVercelEnvApplyPlan,
  renderProductionEnvExample,
} from '../packages/cloud/src/index.js';
import {
  AUTHOR_OS_CLOUD_MIGRATION_VERSION,
  createCloudMigrationPlan,
  createCloudMigrationRunner,
  loadCloudMigrations,
} from '../packages/cloud/src/migrations.js';
import { buildAuthorOsMcpClientConfig } from '../packages/mcp/src/client-config.js';
import { buildMcpToolManifest } from '../packages/mcp/src/tools.js';
import { exportLocalProject, importManuscript, installLocalPack, readAuthorProject, runLocalContinuity, writeAuthorProject } from '../packages/local/src/index.js';

const VERSION = '0.2.0';
const BRAND = 'AuthorOS';

const args = process.argv.slice(2);
const command = args[0];
const subarg = args[1];

// ── Helpers ──────────────────────────────────────────────────────────

function log(msg) { console.log(msg); }
function err(msg) { console.error(`\x1b[31m${msg}\x1b[0m`); }
function ok(msg) { console.log(`\x1b[32m${msg}\x1b[0m`); }
function dim(msg) { console.log(`\x1b[2m${msg}\x1b[0m`); }
function warn(msg) { console.log(`\x1b[33m${msg}\x1b[0m`); }
function bold(msg) { return `\x1b[1m${msg}\x1b[0m`; }

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function countWords(text) {
  return text.split(/\s+/).filter(Boolean).length;
}

function findMdFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.md'))
    .map(f => path.join(dir, f));
}

function findFilesRecursive(dir, predicate) {
  if (!fs.existsSync(dir)) return [];
  const results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', '.git', 'output'].includes(entry.name)) continue;
      results.push(...findFilesRecursive(fullPath, predicate));
    } else if (predicate(fullPath, entry.name)) {
      results.push(fullPath);
    }
  }
  return results;
}

function readJsonSafe(file) {
  try {
    if (!fs.existsSync(file)) return null;
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch {
    return null;
  }
}

function readFirstHeading(file) {
  if (!fs.existsSync(file)) return null;
  const lines = fs.readFileSync(file, 'utf-8').split('\n');
  const heading = lines.find(line => /^#\s+/.test(line.trim()));
  return heading ? heading.replace(/^#\s+/, '').trim() : null;
}

function formatNumber(value) {
  return new Intl.NumberFormat('en-US').format(value);
}

function hasFlag(flag) {
  return args.includes(flag);
}

function getFlagValue(flag, fallback = null) {
  const index = args.indexOf(flag);
  if (index === -1 || index + 1 >= args.length) return fallback;
  return args[index + 1];
}

function splitCsv(value, fallback = []) {
  if (!value) return fallback;
  return String(value).split(',').map(item => item.trim()).filter(Boolean);
}

function quoteCmdArg(value) {
  const text = String(value);
  if (/^[A-Za-z0-9_./:=,@-]+$/.test(text)) return text;
  return `"${text.replace(/"/g, '\\"')}"`;
}

function runVercelCli(vercelArgs = []) {
  const result = process.platform === 'win32'
    ? spawnSync('cmd.exe', ['/d', '/s', '/c', ['vercel', ...vercelArgs].map(quoteCmdArg).join(' ')], {
        cwd: process.cwd(),
        encoding: 'utf8',
      })
    : spawnSync('vercel', vercelArgs, {
        cwd: process.cwd(),
        encoding: 'utf8',
      });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    const detail = `${result.stdout || ''}${result.stderr || ''}`.trim();
    throw new Error(detail || `vercel ${vercelArgs.join(' ')} failed with status ${result.status}`);
  }
  return `${result.stdout || ''}${result.stderr || ''}`;
}

function runVercelCliWithInput(vercelArgs = [], input = '') {
  const result = process.platform === 'win32'
    ? spawnSync('cmd.exe', ['/d', '/s', '/c', ['vercel', ...vercelArgs].map(quoteCmdArg).join(' ')], {
        cwd: process.cwd(),
        encoding: 'utf8',
        input: `${input}\n`,
      })
    : spawnSync('vercel', vercelArgs, {
        cwd: process.cwd(),
        encoding: 'utf8',
        input: `${input}\n`,
      });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    const detail = `${result.stdout || ''}${result.stderr || ''}`.trim();
    throw new Error(detail || `vercel ${vercelArgs.join(' ')} failed with status ${result.status}`);
  }
  return `${result.stdout || ''}${result.stderr || ''}`;
}

function normalizeNumberFlag(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function getPackageDir() {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
}

function getMcpServerPath() {
  return path.join(getPackageDir(), 'packages', 'mcp', 'bin', 'author-os-mcp.js');
}

function getSkillsDir() {
  return path.join(getPackageDir(), 'skills');
}

function getAuthoringTemplatesDir() {
  return path.join(getPackageDir(), 'templates', 'authoring');
}

function commandExists(cmd) {
  try {
    execSync(`command -v ${cmd} 2>/dev/null || where ${cmd} 2>NUL`, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 5000,
    });
    return true;
  } catch {
    return false;
  }
}

function parseEnvFileValue(rawValue) {
  let value = String(rawValue || '').trim();
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }
  return value.replace(/\\n/g, '\n');
}

function readEnvFile(file) {
  if (!file || !fs.existsSync(file)) return {};
  const env = {};
  const lines = fs.readFileSync(file, 'utf-8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    env[match[1]] = parseEnvFileValue(match[2]);
  }
  return env;
}

function createCloudOpsEnv() {
  const defaultEnvFile = path.join(process.cwd(), '.env.local');
  const envFile = hasFlag('--no-env-file')
    ? null
    : getFlagValue('--env-file', fs.existsSync(defaultEnvFile) ? defaultEnvFile : null);
  return {
    env: {
      ...process.env,
      ...readEnvFile(envFile),
    },
    envFile,
  };
}

function resolveDatabaseUrl(env = {}) {
  return getFlagValue('--url') || env.POSTGRES_URL || env.DATABASE_URL || null;
}

function redactDatabaseUrl(value) {
  if (!value) return null;
  try {
    const url = new URL(value);
    url.username = url.username ? 'redacted' : '';
    url.password = url.password ? 'redacted' : '';
    url.search = '';
    return url.toString();
  } catch {
    return 'configured';
  }
}

function printMigrationPlan(plan) {
  log(`  Status:             ${plan.status}`);
  log(`  Latest version:     ${plan.latestVersion || 'none'}`);
  log(`  Migration count:    ${plan.migrationCount}`);
  log(`  Applied:            ${plan.applied.length}`);
  log(`  Pending:            ${plan.pending.length}`);
  for (const migration of plan.pending) {
    warn(`    pending ${migration.version}: ${migration.description}`);
  }
  for (const mismatch of plan.checksumMismatches) {
    err(`    checksum mismatch ${mismatch.version}`);
  }
}

function sanitizeMigrationForOutput(migration) {
  return {
    version: migration.version,
    filename: migration.filename,
    description: migration.description,
    checksum: migration.checksum,
    appliedAt: migration.appliedAt || migration.applied_at || null,
    status: migration.status || undefined,
  };
}

function sanitizeMigrationPlanForOutput(plan) {
  return {
    status: plan.status,
    latestVersion: plan.latestVersion,
    migrationCount: plan.migrationCount,
    applied: plan.applied.map(sanitizeMigrationForOutput),
    pending: plan.pending.map(sanitizeMigrationForOutput),
    checksumMismatches: plan.checksumMismatches,
  };
}

// ── Commands ─────────────────────────────────────────────────────────

function cmdInit() {
  log(`\n${bold(BRAND)} — Initializing project...\n`);
  const template = getFlagValue('--template')
    || (hasFlag('--romance') ? 'romance-arc'
      : hasFlag('--mystery') || hasFlag('--thriller') ? 'mystery-thriller'
      : hasFlag('--nonfiction') ? 'nonfiction-guide'
      : hasFlag('--series') ? 'series-bible'
      : 'three-act-novel');
  const title = getFlagValue('--title', getFlagValue('--name', 'Untitled'));
  const genre = splitCsv(getFlagValue('--genre'), hasFlag('--nonfiction') ? ['nonfiction'] : []);
  const targetWords = normalizeNumberFlag(getFlagValue('--target-words', getFlagValue('--target')), 80000);
  const premise = getFlagValue('--premise', '');
  const audience = getFlagValue('--audience', '');
  const blank = hasFlag('--blank');
  const force = hasFlag('--force');
  const dirs = ['chapters', 'scenes', 'characters', 'worldbuilding', 'research', 'notes', 'tasks', 'memory', 'reports', 'output'];
  for (const d of dirs) {
    ensureDir(d);
    ok(`  + ${d}/`);
  }

  const files = {
    'authoros.json': JSON.stringify({
      title,
      type: 'book',
      genre,
      stage: 'ideation',
      targetWords,
      template: blank ? null : template,
      premise: premise || null,
      audience: audience || null,
      createdAt: new Date().toISOString()
    }, null, 2) + '\n',
    'outline.md': `# ${title} Outline\n\n## Working Title\n${title}\n\n## Template\n${blank ? 'blank' : template}\n\n## Premise\n${premise}\n\n## Audience\n${audience}\n\n## Act I\n\n\n## Act II\n\n\n## Act III\n\n`,
    'CANON_LOCKED.md': `# Canon Locked\n\nHuman-approved facts only. Agents may read this file, but should not change it without explicit approval.\n\n## Characters\n\n\n## World Rules\n\n\n## Timeline Facts\n\n\n## Style Rules\n\n`,
    'characters/README.md': `# Characters\n\nOne file per character. Include: name, role, arc, voice notes, relationships.\n`,
    'worldbuilding/README.md': `# Worldbuilding\n\nSystems, locations, history, rules of the world.\n`,
    'research/README.md': `# Research\n\nSources, citations, plausibility notes, and fact checks.\n`,
    'chapters/01-chapter.md': `# Chapter 1\n\n`,
    'tasks/queue.json': JSON.stringify({ tasks: [] }, null, 2) + '\n',
    'tasks/agents.json': JSON.stringify({
      agents: [
        { name: 'drafter', role: 'Writes first drafts from outline beats', model: 'claude-sonnet' },
        { name: 'editor', role: 'Revises prose for clarity and voice', model: 'claude-sonnet' },
        { name: 'researcher', role: 'Fills gaps in worldbuilding and facts', model: 'claude-haiku' },
        { name: 'continuity', role: 'Checks for plot holes and timeline errors', model: 'claude-haiku' },
        { name: 'quality', role: 'Runs quality-check.js on all chapters', model: 'local' }
      ]
    }, null, 2) + '\n',
  };

  for (const [file, content] of Object.entries(files)) {
    if (!fs.existsSync(file)) {
      fs.writeFileSync(file, content);
      ok(`  + ${file}`);
    } else {
      dim(`  ~ ${file} (exists, skipped)`);
    }
  }

  const graphFile = path.join('.authoros', 'project.graph.json');
  if (!fs.existsSync(graphFile) || force) {
    const project = blank
      ? createEmptyProject({
          title,
          type: 'book',
          genre,
          stage: 'ideation',
          targetWords,
        })
      : createStarterProject({
          title,
          type: 'book',
          genre,
          stage: 'ideation',
          targetWords,
          template,
          premise,
          audience,
          sourceTool: 'author-os-init',
        });
    const savedGraphFile = writeAuthorProject(process.cwd(), project);
    ok(`  + ${path.relative(process.cwd(), savedGraphFile)}`);
    if (blank) {
      dim('    blank graph: no starter scenes or tasks created');
    } else {
      ok(`    starter cockpit: ${project.chapters.length} chapters / ${project.scenes.length} scenes / ${project.tasks.length} tasks`);
    }
  } else {
    dim(`  ~ ${graphFile} (exists, skipped; use --force to replace)`);
  }

  log(`\n${bold('Done.')} Run author-os cockpit, author-os sync, or edit chapters/01-chapter.md\n`);
}

function cmdStatus() {
  log(`\n${bold(BRAND)} — Project Status\n`);
  const chapDir = 'chapters';
  const files = findMdFiles(chapDir);
  if (files.length === 0) {
    err('  No chapters found. Run `author-os init` first.');
    return;
  }
  let totalWords = 0;
  log('  Chapter                          Words');
  log('  ' + '-'.repeat(44));
  for (const f of files.sort()) {
    const text = fs.readFileSync(f, 'utf-8');
    const wc = countWords(text);
    totalWords += wc;
    const name = path.basename(f).padEnd(34);
    log(`  ${name} ${String(wc).padStart(6)}`);
  }
  log('  ' + '-'.repeat(44));
  log(`  ${'TOTAL'.padEnd(34)} ${String(totalWords).padStart(6)}`);
  log(`  Chapters: ${files.length}`);

  const memIdx = path.join('memory', 'index.json');
  if (fs.existsSync(memIdx)) {
    const idx = JSON.parse(fs.readFileSync(memIdx, 'utf-8'));
    log(`  Memory entries: ${Array.isArray(idx) ? idx.length : Object.keys(idx).length}`);
  } else {
    dim('  Memory index: not found');
  }
  log('');
}

function buildCockpitScan() {
  const cwd = process.cwd();
  const manifest = readJsonSafe('authoros.json') || readJsonSafe('book.json') || {};
  const title = manifest.title || readFirstHeading('outline.md') || path.basename(cwd);

  const dirs = {
    chapters: 'chapters',
    scenes: 'scenes',
    characters: 'characters',
    worldbuilding: 'worldbuilding',
    research: 'research',
    notes: 'notes',
    tasks: 'tasks',
    reports: 'reports',
    output: 'output',
    memory: 'memory',
  };

  const directoryStatus = Object.fromEntries(
    Object.entries(dirs).map(([key, dir]) => [key, fs.existsSync(dir)])
  );

  const chapterFiles = findFilesRecursive(dirs.chapters, f => f.endsWith('.md')).sort();
  const sceneFiles = findFilesRecursive(dirs.scenes, f => f.endsWith('.md')).sort();
  const characterFiles = findFilesRecursive(dirs.characters, f => f.endsWith('.md') || f.endsWith('.json') || f.endsWith('.yaml') || f.endsWith('.yml')).sort();
  const worldFiles = findFilesRecursive(dirs.worldbuilding, f => f.endsWith('.md') || f.endsWith('.json') || f.endsWith('.yaml') || f.endsWith('.yml')).sort();
  const researchFiles = findFilesRecursive(dirs.research, f => f.endsWith('.md') || f.endsWith('.txt') || f.endsWith('.json') || f.endsWith('.yaml') || f.endsWith('.yml')).sort();
  const noteFiles = findFilesRecursive(dirs.notes, f => f.endsWith('.md') || f.endsWith('.txt')).sort();
  const outputFiles = findFilesRecursive(dirs.output, () => true).sort();
  const reportFiles = findFilesRecursive(dirs.reports, () => true).sort();
  const memoryFiles = findFilesRecursive(dirs.memory, (f, name) => /\.(db|sqlite|sqlite3|json)$/i.test(name)).sort();

  const chapters = chapterFiles.map(file => {
    const text = fs.readFileSync(file, 'utf-8');
    const stat = fs.statSync(file);
    return {
      file,
      words: countWords(text),
      heading: readFirstHeading(file),
      modifiedAt: stat.mtime.toISOString(),
    };
  });

  const totalWords = chapters.reduce((sum, chapter) => sum + chapter.words, 0);
  const avgChapterWords = chapters.length ? Math.round(totalWords / chapters.length) : 0;

  const agents = readJsonSafe(path.join('tasks', 'agents.json'));
  const queue = readJsonSafe(path.join('tasks', 'queue.json'));
  const queuedTasks = Array.isArray(queue?.tasks) ? queue.tasks : Array.isArray(queue) ? queue : [];

  const todoRoots = [
    'outline.md',
    'CANON_LOCKED.md',
    'chapters',
    'scenes',
    'characters',
    'worldbuilding',
    'research',
    'notes',
    'tasks',
  ];
  const todoSources = [];
  for (const root of todoRoots) {
    if (!fs.existsSync(root)) continue;
    const stat = fs.statSync(root);
    if (stat.isFile() && root.endsWith('.md')) {
      todoSources.push(root);
    } else if (stat.isDirectory()) {
      todoSources.push(...findFilesRecursive(root, (f, name) => name.endsWith('.md')));
    }
  }
  const todos = [];
  for (const file of todoSources) {
    const rel = path.relative(cwd, path.resolve(file));
    const lines = fs.readFileSync(file, 'utf-8').split('\n');
    lines.forEach((line, index) => {
      const match = line.match(/^\s*-\s+\[\s\]\s+(.+)/);
      if (match) {
        todos.push({ file: rel, line: index + 1, text: match[1].trim() });
      }
    });
  }

  const canonFiles = ['CANON_LOCKED.md', 'canon.md', path.join('worldbuilding', 'CANON_LOCKED.md')]
    .filter(file => fs.existsSync(file));

  const recommendations = [];
  if (!fs.existsSync('authoros.json')) recommendations.push('Create authoros.json to define title, genre, stage, and target word count.');
  if (chapters.length === 0) recommendations.push('Add chapters in chapters/ or run author-os init to create the starter structure.');
  if (canonFiles.length === 0) recommendations.push('Create CANON_LOCKED.md before heavy drafting so agents have a human-approved truth source.');
  if (memoryFiles.length === 0) recommendations.push('Index chapters, characters, and worldbuilding with memory/memsearch-sqlite.py for semantic recall.');
  if (reportFiles.length === 0 && chapters.length > 0) recommendations.push('Run author-os quality on the most important draft chapter and save reports under reports/quality/.');
  if (!agents?.agents?.length) recommendations.push('Define tasks/agents.json so the cockpit can show the author team.');
  if (queuedTasks.length === 0) recommendations.push('Add tasks/queue.json when you want Claude, Codex, or other agents to pick up explicit book tasks.');

  return {
    generatedAt: new Date().toISOString(),
    project: {
      root: cwd,
      title,
      type: manifest.type || 'book',
      genre: manifest.genre || [],
      stage: manifest.stage || 'unknown',
      targetWords: manifest.targetWords || null,
    },
    manuscript: {
      chapters,
      chapterCount: chapters.length,
      sceneFileCount: sceneFiles.length,
      totalWords,
      avgChapterWords,
      targetProgress: manifest.targetWords ? Number((totalWords / manifest.targetWords * 100).toFixed(1)) : null,
    },
    storyBible: {
      characterFileCount: characterFiles.length,
      worldFileCount: worldFiles.length,
      researchFileCount: researchFiles.length,
      noteFileCount: noteFiles.length,
      canonFiles,
    },
    agents: {
      registryCount: agents?.agents?.length || 0,
      registry: agents?.agents || [],
      queuedTaskCount: queuedTasks.length,
      queuedTasks,
    },
    operations: {
      directoryStatus,
      memoryFileCount: memoryFiles.length,
      memoryFiles,
      reportFileCount: reportFiles.length,
      outputFileCount: outputFiles.length,
      openTodoCount: todos.length,
      openTodos: todos.slice(0, 20),
    },
    recommendations,
  };
}

function cmdCockpit() {
  const asJson = args.includes('--json');
  const save = args.includes('--save');
  const scan = buildCockpitScan();

  if (save) {
    ensureDir('reports');
    fs.writeFileSync(path.join('reports', 'cockpit.json'), JSON.stringify(scan, null, 2) + '\n');
  }

  if (asJson) {
    log(JSON.stringify(scan, null, 2));
    return;
  }

  log(`\n${bold(BRAND)} — Writing Cockpit\n`);
  log(`  Project:     ${scan.project.title}`);
  log(`  Root:        ${scan.project.root}`);
  log(`  Type/Stage:  ${scan.project.type} / ${scan.project.stage}`);
  if (scan.project.genre.length) log(`  Genre:       ${Array.isArray(scan.project.genre) ? scan.project.genre.join(', ') : scan.project.genre}`);
  log('');

  log('  Manuscript');
  log(`    Chapters:      ${scan.manuscript.chapterCount}`);
  log(`    Scene files:    ${scan.manuscript.sceneFileCount}`);
  log(`    Words:          ${formatNumber(scan.manuscript.totalWords)}`);
  log(`    Avg/chapter:    ${formatNumber(scan.manuscript.avgChapterWords)}`);
  if (scan.manuscript.targetProgress !== null) log(`    Target:         ${scan.manuscript.targetProgress}% of ${formatNumber(scan.project.targetWords)} words`);
  log('');

  log('  Story Bible');
  log(`    Characters:     ${scan.storyBible.characterFileCount}`);
  log(`    World files:    ${scan.storyBible.worldFileCount}`);
  log(`    Research files: ${scan.storyBible.researchFileCount}`);
  log(`    Canon files:    ${scan.storyBible.canonFiles.length || 'none'}`);
  log('');

  log('  Agents & Ops');
  log(`    Agents:         ${scan.agents.registryCount}`);
  log(`    Queued tasks:   ${scan.agents.queuedTaskCount}`);
  log(`    Memory files:   ${scan.operations.memoryFileCount}`);
  log(`    Reports:        ${scan.operations.reportFileCount}`);
  log(`    Outputs:        ${scan.operations.outputFileCount}`);
  log(`    Open TODOs:     ${scan.operations.openTodoCount}`);
  if (save) ok('    Saved:          reports/cockpit.json');
  log('');

  if (scan.manuscript.chapters.length) {
    log('  Recent Chapters');
    const recent = [...scan.manuscript.chapters]
      .sort((a, b) => new Date(b.modifiedAt) - new Date(a.modifiedAt))
      .slice(0, 5);
    for (const chapter of recent) {
      const name = path.relative(process.cwd(), chapter.file).padEnd(34);
      log(`    ${name} ${String(chapter.words).padStart(6)} words`);
    }
    log('');
  }

  if (scan.operations.openTodos.length) {
    log('  Open TODOs');
    for (const todo of scan.operations.openTodos.slice(0, 5)) {
      log(`    ${todo.file}:${todo.line} ${todo.text}`);
    }
    if (scan.operations.openTodoCount > 5) dim(`    + ${scan.operations.openTodoCount - 5} more`);
    log('');
  }

  if (scan.recommendations.length) {
    log('  Recommended Next Moves');
    for (const rec of scan.recommendations.slice(0, 6)) {
      log(`    - ${rec}`);
    }
  } else {
    ok('  Cockpit looks healthy. Keep writing.');
  }
  log('');
}

const AUTHORING_EXTENSIONS = new Set([
  '.md',
  '.mdx',
  '.txt',
  '.html',
  '.htm',
  '.astro',
  '.svelte',
  '.vue',
  '.jsx',
  '.tsx',
]);

const AUTHORING_IGNORE_DIRS = new Set([
  '.git',
  '.archive',
  '.next',
  '.nuxt',
  '.turbo',
  '.vercel',
  'archive',
  'coverage',
  'dist',
  'build',
  'node_modules',
  'out',
  'output',
  'vendor',
]);

const AUTHORING_LOCKED_FILES = new Set([
  'AUTHORING_STANDARD.md',
  'BRAND_VOICE_LOCKED.md',
  'CANON_LOCKED.md',
  'COMMUNITY_PROMISE_LOCKED.md',
  'LEGAL_CLAIMS_LOCKED.md',
  'POSITIONING_LOCKED.md',
  'WRITING_EVAL_RUBRIC.md',
]);

function incrementCounter(map, key, amount = 1) {
  map[key] = (map[key] || 0) + amount;
}

function sortObjectByValue(input) {
  return Object.fromEntries(
    Object.entries(input).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  );
}

function safeReadText(file, maxBytes = 450000) {
  const stat = fs.statSync(file);
  if (stat.size > maxBytes) return '';
  try {
    return fs.readFileSync(file, 'utf-8');
  } catch {
    return '';
  }
}

function normalizePathForMatch(value) {
  return value.replace(/\\/g, '/').toLowerCase();
}

function getAuthoringFiles(root, options = {}) {
  if (!fs.existsSync(root)) return [];
  const maxFiles = Number(options.maxFiles || 2500);
  const results = [];

  function walk(dir) {
    if (results.length >= maxFiles) return;
    let entries = [];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (results.length >= maxFiles) return;
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (AUTHORING_IGNORE_DIRS.has(entry.name)) continue;
        walk(fullPath);
        continue;
      }

      const ext = path.extname(entry.name).toLowerCase();
      if (!AUTHORING_EXTENSIONS.has(ext)) continue;
      results.push(fullPath);
    }
  }

  walk(root);
  return results.sort();
}

function classifyAuthoringDomains(relPath, text) {
  const p = normalizePathForMatch(relPath);
  const t = text.toLowerCase();
  const domains = new Set();

  if (/(^|\/)(legal|terms|privacy|policy|compliance|disclosure|disclaimers?)(\/|$)/.test(p)) domains.add('legal');
  if (/(^|\/)(offers?|pricing|sales|checkout|revenue|launch|funnel)(\/|$)/.test(p)) domains.add('offer');
  if (/(^|\/)(social|threads?|tweets?|linkedin|newsletter|campaigns?|content-calendar)(\/|$)/.test(p)) domains.add('social');
  if (/(^|\/)(chapters?|scenes?|manuscript|book|outline|characters?|worldbuilding)(\/|$)/.test(p)) domains.add('book');
  if (/(^|\/)(docs?|guides?|reference|tutorials?|readme|api)(\/|$)/.test(p) || /readme\.md$/.test(p)) domains.add('documentation');
  if (/(^|\/)(research|sources?|citations?|dossiers?|market-map)(\/|$)/.test(p)) domains.add('research');
  if (/(^|\/)(brand|voice|positioning|manifesto|identity|copy)(\/|$)/.test(p)) domains.add('brand');
  if (/(^|\/)(community|cohort|challenge|membership|events?)(\/|$)/.test(p)) domains.add('community');
  if (/(^|\/)(app|pages|routes|src|components|public)(\/|$)/.test(p) && /\.(mdx|tsx|jsx|html|astro|svelte|vue)$/.test(p)) domains.add('website');

  if (/\b(privacy policy|terms of service|jurisdiction|liability|warranty|compliance)\b/.test(t)) domains.add('legal');
  if (/\b(pricing|guarantee|conversion|checkout|refund|offer|bonus|objection|testimonial)\b/.test(t)) domains.add('offer');
  if (/\b(thread|caption|post|newsletter|linkedin|twitter|x\.com|hook)\b/.test(t)) domains.add('social');
  if (/\b(character|chapter|scene|plot|canon|manuscript|protagonist|dialogue)\b/.test(t)) domains.add('book');
  if (/\b(install|quick start|api|configuration|reference|tutorial|how-to)\b/.test(t)) domains.add('documentation');
  if (/\b(source|citation|competitor|market|research|study|report)\b/.test(t)) domains.add('research');
  if (/\b(brand voice|positioning|manifesto|tagline|tone|identity)\b/.test(t)) domains.add('brand');
  if (/\b(community|cohort|challenge|members|belonging|ritual|competition)\b/.test(t)) domains.add('community');

  if (!domains.size) domains.add('general');
  return [...domains];
}

function pickAuthoringTeam(domains) {
  const priority = [
    ['legal', 'legal-and-policy'],
    ['offer', 'offer'],
    ['website', 'website-narrative'],
    ['social', 'social-media'],
    ['book', 'book'],
    ['documentation', 'documentation'],
    ['research', 'research'],
    ['brand', 'brand-voice'],
    ['community', 'community'],
    ['general', 'editorial-triage'],
  ];
  const found = priority.find(([domain]) => domains.includes(domain));
  return found ? found[1] : 'editorial-triage';
}

function countMatches(text, regex) {
  const matches = text.match(regex);
  return matches ? matches.length : 0;
}

function extractAuthoringSignals(text) {
  return {
    moneyMentions: countMatches(text, /(?:\$|€|£)\s?\d+|\b\d+\s?(?:usd|eur|gbp)\b/gi),
    numberClaims: countMatches(text, /\b\d+(?:\.\d+)?\s?(?:%|percent|x|k|m|b|million|billion)\b/gi),
    legalTerms: countMatches(text, /\b(shall|must|liability|warranty|jurisdiction|compliance|privacy|terms|disclosure|copyright|trademark)\b/gi),
    sourceMarkers: countMatches(text, /\b(source|citation|study|report|according to|https?:\/\/)\b/gi),
    hypeMarkers: countMatches(text, /\b(guaranteed|ultimate|revolutionary|secret|never before|insane|unstoppable|effortless)\b/gi),
    aiTicMarkers: countMatches(text, /\b(seamlessly|unlock|delve|elevate|leverage|game-changer|robust|cutting-edge)\b/gi),
  };
}

function classifyAuthoringRisk(domains, relPath, text, signals) {
  const p = normalizePathForMatch(relPath);
  const basename = path.basename(relPath);
  if (AUTHORING_LOCKED_FILES.has(basename)) return 'locked-state';
  if (domains.includes('legal')) return 'human-required';
  if (domains.includes('offer') && (signals.moneyMentions || /\b(guarantee|refund|income|earn|claim|testimonial)\b/i.test(text))) return 'high';
  if (domains.includes('brand') || p.includes('positioning')) return 'brand-positioning';
  if (signals.numberClaims > 2 && signals.sourceMarkers === 0) return 'claim-verification';
  if (domains.includes('website') || domains.includes('social')) return 'public-surface';
  if (domains.includes('documentation')) return 'technical-accuracy';
  return 'normal';
}

function headingCount(text) {
  return countMatches(text, /^#{1,6}\s+/gm);
}

function classifyAuthoringArtifact(root, file) {
  const relPath = path.relative(root, file).replace(/\\/g, '/');
  const text = safeReadText(file);
  const stat = fs.statSync(file);
  const domains = classifyAuthoringDomains(relPath, text);
  const signals = extractAuthoringSignals(text);
  const risk = classifyAuthoringRisk(domains, relPath, text, signals);
  const team = pickAuthoringTeam(domains);
  const words = countWords(text);
  const firstHeading = readFirstHeading(file);
  const ext = path.extname(file).toLowerCase();

  return {
    path: relPath,
    ext,
    title: firstHeading || path.basename(file, ext),
    domains,
    team,
    risk,
    locked: AUTHORING_LOCKED_FILES.has(path.basename(file)),
    words,
    headings: headingCount(text),
    lines: text ? text.split(/\r?\n/).length : 0,
    signals,
    modifiedAt: stat.mtime.toISOString(),
  };
}

function summarizeAuthoringArtifacts(artifacts) {
  const byDomain = {};
  const byTeam = {};
  const byRisk = {};
  let totalWords = 0;
  let lockedCount = 0;
  let highSignalClaims = 0;

  for (const artifact of artifacts) {
    totalWords += artifact.words;
    if (artifact.locked) lockedCount += 1;
    if (artifact.risk === 'human-required' || artifact.risk === 'high' || artifact.risk === 'claim-verification') highSignalClaims += 1;
    for (const domain of artifact.domains) incrementCounter(byDomain, domain);
    incrementCounter(byTeam, artifact.team);
    incrementCounter(byRisk, artifact.risk);
  }

  return {
    artifactCount: artifacts.length,
    totalWords,
    lockedCount,
    highSignalClaims,
    byDomain: sortObjectByValue(byDomain),
    byTeam: sortObjectByValue(byTeam),
    byRisk: sortObjectByValue(byRisk),
  };
}

function buildAuthoringRecommendations(root, artifacts, summary) {
  const recommendations = [];
  const hasStandard = fs.existsSync(path.join(root, 'AUTHORING_STANDARD.md')) || fs.existsSync(path.join(root, 'docs', 'AUTHORING_STANDARD.md'));
  const hasRubric = fs.existsSync(path.join(root, 'WRITING_EVAL_RUBRIC.md')) || fs.existsSync(path.join(root, 'docs', 'WRITING_EVAL_RUBRIC.md'));
  const hasProjectBrief = fs.existsSync(path.join(root, 'AUTHORING_PROJECT_BRIEF.md'));
  const hasAuthoros = fs.existsSync(path.join(root, 'authoros.json'));

  if (!hasAuthoros) recommendations.push('Add authoros.json with an authoring block so teams, brand, risk, and publish gates are explicit.');
  if (!hasProjectBrief) recommendations.push('Add AUTHORING_PROJECT_BRIEF.md so agents know audience, domain, locked state, and current writing goals.');
  if (!hasStandard) recommendations.push('Add AUTHORING_STANDARD.md or docs/AUTHORING_STANDARD.md before broad rewrites.');
  if (!hasRubric) recommendations.push('Add WRITING_EVAL_RUBRIC.md or docs/WRITING_EVAL_RUBRIC.md for repeatable scoring.');
  if (summary.byRisk['human-required']) recommendations.push('Route legal/policy artifacts through human-required review before publishing.');
  if (summary.byRisk['claim-verification']) recommendations.push('Run claim-verification on unsourced numerical/statistical claims.');
  if (summary.byTeam['offer']) recommendations.push('Run offer-positioning review with ethical influence and claims checks.');
  if (summary.byTeam['website-narrative']) recommendations.push('Run website-narrative review against brand voice, proof, hierarchy, and CTA clarity.');
  if (summary.lockedCount === 0 && artifacts.length > 0) recommendations.push('Create locked state files for brand voice, positioning, and legal claims on public-facing repos.');

  return recommendations;
}

function buildAuthoringInventoryForRepo(root, options = {}) {
  const resolvedRoot = path.resolve(root);
  const files = getAuthoringFiles(resolvedRoot, options);
  const artifacts = files.map(file => classifyAuthoringArtifact(resolvedRoot, file));
  const summary = summarizeAuthoringArtifacts(artifacts);

  return {
    schema: 'authoros.authoringInventory.v1',
    generatedAt: new Date().toISOString(),
    scope: 'repo',
    root: resolvedRoot,
    repo: path.basename(resolvedRoot),
    maxFiles: Number(options.maxFiles || 2500),
    truncated: files.length >= Number(options.maxFiles || 2500),
    summary,
    recommendations: buildAuthoringRecommendations(resolvedRoot, artifacts, summary),
    artifacts,
  };
}

function getEstateManifestPath() {
  return path.join('C:', 'Users', 'frank', 'starlight', 'repos', 'starlight-agent-config', 'core', 'estate', 'repo-estate.control.json');
}

function loadEstateRepos(manifestPath, options = {}) {
  const manifest = readJsonSafe(manifestPath);
  if (!manifest?.lanes) throw new Error(`Estate manifest not found or invalid: ${manifestPath}`);
  const workspaceRoot = manifest.workspaceRoot || path.dirname(path.dirname(path.dirname(manifestPath)));
  const laneFilter = String(options.lanes || '').split(',').map(x => x.trim()).filter(Boolean);
  const repos = [];

  for (const [lane, entries] of Object.entries(manifest.lanes)) {
    if (laneFilter.length && !laneFilter.includes(lane)) continue;
    for (const entry of entries || []) {
      const repoRoot = path.join(workspaceRoot, entry.repo);
      if (!fs.existsSync(repoRoot)) continue;
      repos.push({
        lane,
        repo: entry.repo,
        root: repoRoot,
        priority: entry.priority || 'unknown',
        role: entry.role || '',
        tags: entry.tags || [],
      });
    }
  }

  return repos;
}

function buildEstateAuthoringInventory(options = {}) {
  const manifestPath = options.manifestPath || getEstateManifestPath();
  const limitRepos = Number(options.limitRepos || 0);
  const repos = loadEstateRepos(manifestPath, options).slice(0, limitRepos > 0 ? limitRepos : undefined);
  const repoReports = repos.map(repo => {
    const report = buildAuthoringInventoryForRepo(repo.root, options);
    return {
      lane: repo.lane,
      repo: repo.repo,
      root: repo.root,
      priority: repo.priority,
      role: repo.role,
      tags: repo.tags,
      summary: report.summary,
      recommendations: report.recommendations,
      topArtifacts: report.artifacts
        .filter(artifact => artifact.risk !== 'normal')
        .slice(0, 20),
    };
  });

  const allArtifacts = repoReports.flatMap(repo =>
    repo.topArtifacts.map(artifact => ({ ...artifact, repo: repo.repo, lane: repo.lane }))
  );
  const summary = {
    repoCount: repoReports.length,
    artifactCount: repoReports.reduce((sum, repo) => sum + repo.summary.artifactCount, 0),
    totalWords: repoReports.reduce((sum, repo) => sum + repo.summary.totalWords, 0),
    lockedCount: repoReports.reduce((sum, repo) => sum + repo.summary.lockedCount, 0),
    highSignalClaims: repoReports.reduce((sum, repo) => sum + repo.summary.highSignalClaims, 0),
    byLane: sortObjectByValue(repoReports.reduce((acc, repo) => {
      incrementCounter(acc, repo.lane);
      return acc;
    }, {})),
    byTeam: sortObjectByValue(repoReports.reduce((acc, repo) => {
      for (const [team, count] of Object.entries(repo.summary.byTeam)) incrementCounter(acc, team, count);
      return acc;
    }, {})),
    byRisk: sortObjectByValue(repoReports.reduce((acc, repo) => {
      for (const [risk, count] of Object.entries(repo.summary.byRisk)) incrementCounter(acc, risk, count);
      return acc;
    }, {})),
  };

  return {
    schema: 'authoros.authoringInventory.v1',
    generatedAt: new Date().toISOString(),
    scope: 'estate',
    manifestPath,
    workspaceRoot: path.dirname(path.dirname(path.dirname(path.dirname(manifestPath)))),
    maxFilesPerRepo: Number(options.maxFiles || 2500),
    summary,
    repos: repoReports,
    priorityArtifacts: allArtifacts.slice(0, 250),
  };
}

function saveAuthoringInventory(report) {
  const outputRoot = report.scope === 'estate' ? process.cwd() : report.root;
  const reportDir = path.join(outputRoot, 'reports', 'authoring');
  ensureDir(reportDir);
  const file = path.join(reportDir, report.scope === 'estate' ? 'estate-inventory.json' : 'inventory.json');
  fs.writeFileSync(file, JSON.stringify(report, null, 2) + '\n');
  return file;
}

function printAuthoringInventory(report, savedFile = null) {
  log(`\n${bold(BRAND)} — Authoring Inventory\n`);
  log(`  Scope:       ${report.scope}`);
  if (report.scope === 'repo') {
    log(`  Repo:        ${report.repo}`);
    log(`  Root:        ${report.root}`);
    log(`  Artifacts:   ${formatNumber(report.summary.artifactCount)}`);
  } else {
    log(`  Manifest:    ${report.manifestPath}`);
    log(`  Repos:       ${formatNumber(report.summary.repoCount)}`);
    log(`  Artifacts:   ${formatNumber(report.summary.artifactCount)}`);
  }
  log(`  Words:       ${formatNumber(report.summary.totalWords)}`);
  log(`  Locked:      ${formatNumber(report.summary.lockedCount)}`);
  log(`  Risk items:  ${formatNumber(report.summary.highSignalClaims)}`);
  if (savedFile) ok(`  Saved:       ${path.relative(process.cwd(), savedFile)}`);
  log('');

  log('  Teams');
  for (const [team, count] of Object.entries(report.summary.byTeam || {}).slice(0, 8)) {
    log(`    ${team.padEnd(24)} ${String(count).padStart(5)}`);
  }
  log('');

  log('  Risks');
  for (const [risk, count] of Object.entries(report.summary.byRisk || {}).slice(0, 8)) {
    log(`    ${risk.padEnd(24)} ${String(count).padStart(5)}`);
  }
  log('');

  const recommendations = report.scope === 'repo'
    ? report.recommendations
    : report.repos.flatMap(repo => repo.recommendations.map(text => `${repo.repo}: ${text}`)).slice(0, 8);

  if (recommendations.length) {
    log('  Recommended Next Moves');
    for (const rec of recommendations.slice(0, 8)) log(`    - ${rec}`);
    log('');
  }
}

function buildDefaultAuthoringManifest(existing = {}, repoRoot = process.cwd()) {
  const repoName = path.basename(path.resolve(repoRoot));
  const currentAuthoring = existing.authoring && typeof existing.authoring === 'object' ? existing.authoring : {};
  return {
    ...existing,
    title: existing.title || repoName,
    type: existing.type || 'authoring-project',
    authoring: {
      version: currentAuthoring.version || 'authoros.authoring.v1',
      domains: currentAuthoring.domains || ['website', 'offer', 'documentation'],
      brandPack: currentAuthoring.brandPack || 'starlight',
      audience: currentAuthoring.audience || [],
      riskLevel: currentAuthoring.riskLevel || 'public-surface',
      defaultTeam: currentAuthoring.defaultTeam || 'editorial-triage',
      requiredReviewers: currentAuthoring.requiredReviewers || ['strategy', 'voice', 'claim-verification'],
      lockedFiles: currentAuthoring.lockedFiles || [
        'BRAND_VOICE_LOCKED.md',
        'POSITIONING_LOCKED.md',
        'LEGAL_CLAIMS_LOCKED.md',
        'COMMUNITY_PROMISE_LOCKED.md',
      ],
      publishGate: currentAuthoring.publishGate || {
        minimumScore: 90,
        humanApprovalRequired: true,
      },
    },
  };
}

function initAuthoringStandards(repoRoot, options = {}) {
  const root = path.resolve(repoRoot);
  const templatesDir = getAuthoringTemplatesDir();
  if (!fs.existsSync(templatesDir)) throw new Error(`Authoring templates not found: ${templatesDir}`);
  if (!fs.existsSync(root)) throw new Error(`Target repo not found: ${root}`);

  const force = Boolean(options.force);
  const dryRun = Boolean(options.dryRun);
  const copied = [];
  const skipped = [];

  for (const name of fs.readdirSync(templatesDir).filter(file => file.endsWith('.md')).sort()) {
    const source = path.join(templatesDir, name);
    const target = path.join(root, name);
    if (fs.existsSync(target) && !force) {
      skipped.push(path.relative(root, target).replace(/\\/g, '/'));
      continue;
    }
    if (!dryRun) fs.copyFileSync(source, target);
    copied.push(path.relative(root, target).replace(/\\/g, '/'));
  }

  const reportDirs = [
    path.join(root, 'reports', 'authoring'),
    path.join(root, 'reports', 'authoring', 'council'),
    path.join(root, 'reports', 'authoring', 'evals'),
  ];
  if (!dryRun) {
    for (const dir of reportDirs) ensureDir(dir);
  }

  const manifestPath = path.join(root, 'authoros.json');
  const manifestExisted = fs.existsSync(manifestPath);
  const existingManifest = readJsonSafe(manifestPath) || {};
  const nextManifest = buildDefaultAuthoringManifest(existingManifest, root);
  const manifestChanged = !manifestExisted || force || JSON.stringify(existingManifest.authoring || null) !== JSON.stringify(nextManifest.authoring);
  if (!dryRun && manifestChanged) fs.writeFileSync(manifestPath, JSON.stringify(nextManifest, null, 2) + '\n');

  return {
    root,
    dryRun,
    force,
    copied,
    skipped,
    reportDirs: reportDirs.map(dir => path.relative(root, dir).replace(/\\/g, '/')),
    manifest: {
      path: path.relative(root, manifestPath).replace(/\\/g, '/'),
      existed: manifestExisted,
      changed: manifestChanged,
    },
  };
}

function cmdAuthoring() {
  const action = subarg || 'help';

  if (action === 'init' || action === 'setup') {
    const result = initAuthoringStandards(getFlagValue('--repo', process.cwd()), {
      force: hasFlag('--force'),
      dryRun: hasFlag('--dry-run'),
    });
    if (hasFlag('--json')) {
      log(JSON.stringify(result, null, 2));
      return;
    }

    log(`\n${bold(BRAND)} — Authoring Standards Init\n`);
    log(`  Root:      ${result.root}`);
    log(`  Mode:      ${result.dryRun ? 'dry-run' : 'write'}`);
    log(`  Copied:    ${result.copied.length}`);
    log(`  Skipped:   ${result.skipped.length}`);
    log(`  Manifest:  ${result.manifest.path}${result.manifest.changed ? ' updated' : ' unchanged'}`);
    if (result.copied.length) {
      log('');
      log('  Files');
      for (const file of result.copied) ok(`    + ${file}`);
    }
    if (result.skipped.length) {
      log('');
      log('  Existing files skipped');
      for (const file of result.skipped.slice(0, 12)) dim(`    ~ ${file}`);
      if (result.skipped.length > 12) dim(`    + ${result.skipped.length - 12} more`);
    }
    log('');
    return;
  }

  if (action === 'inventory') {
    const maxFiles = Number(getFlagValue('--max-files', 2500));
    const limitRepos = Number(getFlagValue('--limit-repos', 0));
    const lanes = getFlagValue('--lanes', '');
    const manifestPath = getFlagValue('--manifest', getEstateManifestPath());
    const report = hasFlag('--estate')
      ? buildEstateAuthoringInventory({ maxFiles, limitRepos, lanes, manifestPath })
      : buildAuthoringInventoryForRepo(getFlagValue('--repo', process.cwd()), { maxFiles });

    let savedFile = null;
    if (hasFlag('--save')) savedFile = saveAuthoringInventory(report);
    if (hasFlag('--json')) {
      log(JSON.stringify(report, null, 2));
      return;
    }
    printAuthoringInventory(report, savedFile);
    return;
  }

  log(`
${bold(BRAND)} — Authoring

  Usage:
    author-os authoring init [--repo <path>] [--dry-run] [--force] [--json]
    author-os authoring inventory [--repo <path>] [--json] [--save]
    author-os authoring inventory --estate [--lanes site,frankx] [--limit-repos 10] [--json]

  Examples:
    author-os authoring init --repo .
    author-os authoring inventory --repo .
    author-os authoring inventory --repo . --save
    author-os authoring inventory --estate --lanes site,frankx --limit-repos 12 --json
`);
}

function cmdImport(source) {
  if (!source) {
    err('Usage: author-os import <file-or-directory>');
    process.exit(1);
  }
  log(`\n${bold(BRAND)} — Importing manuscript source\n`);
  try {
    const result = importManuscript(path.resolve(source), process.cwd());
    ok(`  Imported ${result.imported.length} file(s).`);
    for (const file of result.imported) log(`  + ${file}`);
    ok(`  Synced graph: ${path.relative(process.cwd(), result.graphFile)}`);
  } catch (e) {
    err(`  Import failed: ${e.message}`);
    process.exit(1);
  }
  log('');
}

function cmdSync() {
  log(`\n${bold(BRAND)} — Syncing local project graph\n`);
  try {
    const project = readAuthorProject(process.cwd());
    const graphFile = writeAuthorProject(process.cwd(), project);
    ensureDir('reports');
    const cockpit = buildCockpitViewModel(project);
    fs.writeFileSync(path.join('reports', 'cockpit-view.json'), JSON.stringify(cockpit, null, 2) + '\n');
    ok(`  Graph:   ${path.relative(process.cwd(), graphFile)}`);
    ok('  Cockpit: reports/cockpit-view.json');
    log(`  Scenes:  ${cockpit.context.stats.scenes}`);
    log(`  Canon:   ${cockpit.context.stats.entities}`);
    log(`  Tasks:   ${cockpit.context.stats.openTasks} open`);
  } catch (e) {
    err(`  Sync failed: ${e.message}`);
    process.exit(1);
  }
  log('');
}

function cmdExport(format = 'markdown') {
  const normalized = format === 'md' ? 'markdown' : format;
  log(`\n${bold(BRAND)} — Exporting ${normalized}\n`);

  if (normalized === 'markdown') {
    try {
      const result = exportLocalProject(process.cwd(), 'markdown');
      ok(`  Output: ${path.relative(process.cwd(), result.file)}`);
      log('');
      return;
    } catch (e) {
      err(`  Export failed: ${e.message}`);
      process.exit(1);
    }
  }

  cmdPublish(normalized);
}

function cmdContinuity() {
  log(`\n${bold(BRAND)} — Continuity Check\n`);
  try {
    const { report, file } = runLocalContinuity(process.cwd());
    log(`  Status: ${report.status}`);
    log(`  Issues: ${report.issueCount}`);
    ok(`  Saved:  ${path.relative(process.cwd(), file)}`);
    if (report.issues.length) {
      log('');
      for (const issue of report.issues.slice(0, 8)) {
        log(`  - [${issue.severity}] ${issue.title}`);
      }
      if (report.issues.length > 8) dim(`  + ${report.issues.length - 8} more`);
    }
  } catch (e) {
    err(`  Continuity check failed: ${e.message}`);
    process.exit(1);
  }
  log('');
}

function cmdMcp() {
  const manifest = buildMcpToolManifest();
  const wantsClientConfig = args.includes('--client-config') || args.includes('--config');
  if (wantsClientConfig) {
    const config = buildMcpClientConfig({
      mode: getFlagValue('--mode', 'both'),
      host: getFlagValue('--host', 'generic'),
      root: getFlagValue('--root', process.cwd()),
      url: getFlagValue('--url', process.env.AUTHOROS_MCP_URL || process.env.NEXT_PUBLIC_APP_URL || ''),
      tokenEnv: getFlagValue('--token-env', 'AUTHOROS_MCP_TOKEN'),
    });
    const savePath = getFlagValue('--save');
    if (savePath) {
      ensureDir(path.dirname(path.resolve(savePath)));
      fs.writeFileSync(savePath, `${JSON.stringify(config.output, null, 2)}\n`);
    }
    const wantsJsonOutput = args.includes('--json') || args.includes('--client-config');
    if (wantsJsonOutput) {
      log(JSON.stringify(config.output, null, 2));
    } else {
      log(`\n${bold(BRAND)} — MCP Client Config\n`);
      log(`  Host:        ${config.host}`);
      log(`  Mode:        ${config.mode}`);
      log(`  Local root:  ${config.localRoot}`);
      log(`  Hosted URL:  ${config.hostedEndpoint}`);
      log('');
      log(JSON.stringify(config.output, null, 2));
    }
    if (savePath && !wantsJsonOutput) ok(`Saved: ${savePath}`);
    return;
  }
  if (args.includes('--manifest') || args.includes('--tools') || args.includes('--json')) {
    log(JSON.stringify(manifest, null, 2));
    return;
  }

  const serverPath = getMcpServerPath();
  log(`\n${bold(BRAND)} — MCP Server\n`);
  log('  Local stdio-lite harness:');
  log(`    node "${serverPath}" --stdio-lite`);
  log('');
  log('  Codex/Claude/Gemini-style config:');
  log(JSON.stringify(buildMcpClientConfig({ mode: 'local', host: 'generic', root: process.cwd() }).output, null, 2));
  log('');
  log('  Tools:');
  for (const tool of manifest.tools) log(`    - ${tool.name}`);
  log('');
}

function cmdPacks() {
  const action = subarg && !subarg.startsWith('--') ? subarg : 'list';
  const registry = buildPackRegistry();
  const selection = action === 'install'
    ? (args[2] && !args[2].startsWith('--') ? args[2] : getFlagValue('--pack', 'authoros-foundry-pack'))
    : getFlagValue('--pack', 'authoros-foundry-pack');

  if (action === 'list' || action === 'registry' || action === undefined) {
    if (hasFlag('--json')) {
      log(JSON.stringify(registry, null, 2));
      return;
    }
    log(`\n${bold(BRAND)} — Pack Registry\n`);
    log(`  Manifest: ${registry.manifest.name} (${registry.manifest.id})`);
    log(`  Version:  ${registry.version}`);
    log(`  Packs:    ${registry.packs.length}`);
    log('');
    for (const pack of registry.packs) {
      log(`  - ${pack.id}`);
      dim(`    ${pack.name} / ${pack.category} / ${pack.layer}`);
      dim(`    ${pack.promise}`);
    }
    log('');
    dim('  Install all Foundry Pack workflows: author-os packs install authoros-foundry-pack');
    log('');
    return;
  }

  if (action === 'install') {
    try {
      const result = installLocalPack(process.cwd(), selection, { installedBy: 'author-os-cli' });
      if (hasFlag('--json')) {
        log(JSON.stringify({
          selection,
          installed: result.installed,
          skipped: result.skipped,
          graphFile: path.relative(process.cwd(), result.graphFile).replace(/\\/g, '/'),
          receiptFile: path.relative(process.cwd(), result.receiptFile).replace(/\\/g, '/'),
          noProseGenerated: result.noProseGenerated,
        }, null, 2));
        return;
      }
      log(`\n${bold(BRAND)} — Pack Install\n`);
      log(`  Selection: ${selection}`);
      ok(`  Installed: ${result.installed.length ? result.installed.join(', ') : 'none'}`);
      if (result.skipped.length) dim(`  Skipped:   ${result.skipped.join(', ')} already installed`);
      log(`  Graph:     ${path.relative(process.cwd(), result.graphFile)}`);
      log(`  Receipt:   ${path.relative(process.cwd(), result.receiptFile)}`);
      dim('  Manuscript prose was not generated or modified.');
      log('');
      return;
    } catch (error) {
      if (hasFlag('--json')) {
        log(JSON.stringify({
          success: false,
          error: {
            code: error.code || 'AUTHOROS_PACK_INSTALL_FAILED',
            message: error.message,
            availablePacks: error.availablePacks || registry.packs.map(pack => pack.id),
          },
        }, null, 2));
      } else {
        err(`Pack install failed: ${error.message}`);
      }
      process.exit(1);
    }
  }

  err('Usage: author-os packs [list|install <pack-id|authoros-foundry-pack>] [--json]');
  process.exit(1);
}

function buildMcpClientConfig(input = {}) {
  const serverPath = getMcpServerPath();
  const localRoot = path.resolve(input.root || process.cwd());
  return buildAuthorOsMcpClientConfig({
    mode: input.mode,
    host: input.host,
    hostedUrl: input.url,
    tokenEnv: input.tokenEnv,
    version: VERSION,
    localRoot,
    localCommand: 'node',
    localArgs: [serverPath, '--stdio-lite'],
  });
}

function cmdDoctor() {
  log(`\n${bold(BRAND)} — Doctor\n`);
  const checks = [];
  const add = (name, pass, detail) => checks.push({ name, pass, detail });

  add('Node.js >= 18', Number(process.versions.node.split('.')[0]) >= 18, process.versions.node);
  add('Project manifest', fs.existsSync('authoros.json'), fs.existsSync('authoros.json') ? 'authoros.json found' : 'Run author-os init or author-os sync.');
  add('Chapters directory', fs.existsSync('chapters'), fs.existsSync('chapters') ? 'chapters/ found' : 'Run author-os init.');
  add('Canon file', fs.existsSync('CANON_LOCKED.md'), fs.existsSync('CANON_LOCKED.md') ? 'CANON_LOCKED.md found' : 'Create CANON_LOCKED.md before agent-heavy work.');
  add('Cockpit app scaffold', fs.existsSync(path.join(getPackageDir(), 'apps', 'cockpit', 'package.json')), 'apps/cockpit');
  add('Core graph package', fs.existsSync(path.join(getPackageDir(), 'packages', 'core', 'src', 'index.js')), 'packages/core');
  add('MCP package', fs.existsSync(path.join(getPackageDir(), 'packages', 'mcp', 'src', 'tools.js')), `${buildMcpToolManifest().tools.length} tools`);
  add('Pandoc export worker', commandExists('pandoc'), commandExists('pandoc') ? 'pandoc found' : 'Needed only for docx/epub/pdf local exports.');

  let project = null;
  try {
    project = readAuthorProject(process.cwd());
    add('Readable story graph', true, `${project.scenes.length} scenes / ${project.entities.length} entities`);
  } catch (e) {
    add('Readable story graph', false, e.message);
  }

  for (const check of checks) {
    const prefix = check.pass ? '\x1b[32mPASS\x1b[0m' : '\x1b[33mWARN\x1b[0m';
    log(`  ${prefix} ${check.name.padEnd(24)} ${check.detail}`);
  }

  log('');
  log('  Model routing routes:');
  for (const [routeId, route] of Object.entries(modelRoutingPolicy.routes)) {
    log(`    - ${routeId.padEnd(12)} ${route.tier} / ${route.purpose}`);
  }

  log('');
  log('  Offer ladder:');
  for (const offer of offerCatalog.slice(0, 6)) {
    log(`    - ${offer.id.padEnd(24)} ${offer.price}`);
  }
  log('');
}

function cmdReadiness() {
  const project = readAuthorProject(process.cwd());
  const report = createPublishingReadinessReport(project);

  if (hasFlag('--json')) {
    log(JSON.stringify(report, null, 2));
    if (hasFlag('--require-ready') && report.status !== 'ready') process.exit(1);
    return;
  }

  if (hasFlag('--save')) {
    ensureDir('reports');
    fs.writeFileSync(path.join('reports', 'readiness.json'), JSON.stringify(report, null, 2) + '\n');
  }

  log(`\n${bold(BRAND)} — Publishing Readiness\n`);
  log(`  Status:             ${report.status}`);
  log(`  Project:            ${project.project.title}`);
  log(`  Continuity:         ${report.continuity.status} (${report.continuity.issueCount} issue(s))`);
  log(`  Credit entries:     ${report.creditSummary.entryCount}`);
  log(`  Included remaining: $${report.creditSummary.remainingIncludedUsd}`);
  log('');
  log('  Checks:');
  for (const check of report.checks) {
    const status = check.status === 'pass' ? '\x1b[32mPASS\x1b[0m' : check.status === 'fail' ? '\x1b[31mFAIL\x1b[0m' : '\x1b[33mREVIEW\x1b[0m';
    log(`    ${status} ${check.label}`);
  }
  if (hasFlag('--save')) ok('\n  Saved reports/readiness.json');
  log('');
  if (hasFlag('--require-ready') && report.status !== 'ready') process.exit(1);
}

function cmdCloudReadiness() {
  const { env, envFile } = createCloudOpsEnv();
  const cloud = createCloudReadinessChecklist(env);
  const launch = createProductionLaunchChecklist(env);
  const report = {
    generatedAt: new Date().toISOString(),
    envFile: envFile ? path.relative(process.cwd(), envFile) || envFile : null,
    cloud,
    launch,
  };

  if (hasFlag('--json')) {
    log(JSON.stringify(report, null, 2));
    if (hasFlag('--require-ready') && launch.status !== 'ready') process.exit(1);
    return;
  }

  log(`\n${bold(BRAND)} — Hosted Launch Readiness\n`);
  log(`  Cloud dependencies: ${cloud.status}`);
  log(`  Production launch:  ${launch.status}`);
  log(`  Environment:        ${launch.environment}`);
  log(`  Demo mode:          ${launch.demoMode ? 'on' : 'off'}`);
  if (report.envFile) dim(`  Env file:           ${report.envFile}`);
  if (launch.appUrl) log(`  App URL:            ${launch.appUrl}`);
  log('');

  log('  Blockers');
  if (launch.blockers.length === 0) {
    ok('    none');
  } else {
    for (const check of launch.checks.filter(item => launch.blockers.includes(item.id))) {
      warn(`    ${check.id}: ${check.nextAction}`);
    }
  }
  log('');

  log('  Warnings');
  if (launch.warnings.length === 0) {
    ok('    none');
  } else {
    for (const check of launch.checks.filter(item => launch.warnings.includes(item.id))) {
      warn(`    ${check.id}: ${check.nextAction}`);
    }
  }
  log('');

  if (hasFlag('--require-ready') && launch.status !== 'ready') process.exit(1);
}

function cmdCloudEnv() {
  const { env, envFile } = createCloudOpsEnv();
  const environments = splitCsv(getFlagValue('--environments'), ['production', 'preview']);
  const project = getFlagValue('--project', 'author-os');
  const previewBranch = getFlagValue('--preview-branch', '');
  const productionBranch = getFlagValue('--production-branch', env.VERCEL_GIT_PRODUCTION_BRANCH || env.AUTHOROS_PRODUCTION_BRANCH || 'main');
  const contract = createProductionEnvContract(env);

  if (hasFlag('--example')) {
    log(renderProductionEnvExample());
    return;
  }

  if (hasFlag('--vercel')) {
    const appUrl = getFlagValue('--app-url', env.NEXT_PUBLIC_APP_URL || env.VERCEL_PROJECT_PRODUCTION_URL || null);
    const applyFile = getFlagValue('--apply-file');
    if (applyFile) {
      const applyPath = path.resolve(applyFile);
      if (!fs.existsSync(applyPath)) {
        err(`Apply file not found: ${applyFile}`);
        process.exit(1);
      }
      const applyEnv = readEnvFile(applyPath);
      const names = splitCsv(getFlagValue('--names'), []);
      const plan = createVercelEnvApplyPlan({
        project,
        environments,
        env: applyEnv,
        names,
        includeRecommended: hasFlag('--include-recommended'),
        previewBranch,
        productionBranch,
      });
      const shouldApply = hasFlag('--apply');
      if (!shouldApply) {
        if (hasFlag('--json')) {
          log(JSON.stringify(plan, null, 2));
        } else {
          log(`\n${bold(BRAND)} — Vercel Env Apply Plan\n`);
          log(`  Project:       ${plan.project}`);
          log(`  Environments:  ${plan.environments.join(', ')}`);
          if (plan.previewBranch) log(`  Preview branch:${' '.repeat(2)}${plan.previewBranch}`);
          if (plan.requestedPreviewBranch && !plan.previewBranch) log(`  Preview branch: ${plan.requestedPreviewBranch} (blocked)`);
          log(`  Apply file:    ${path.relative(process.cwd(), applyPath) || applyPath}`);
          log(`  Status:        ${plan.status}`);
          log(`  Ready names:   ${plan.readyCount}/${plan.requestedCount}`);
          log(`  Commands:      ${plan.commandCount}`);
          log('');
          dim(`  ${plan.note}`);
          if (plan.missing.length) {
            log('');
            warn('  Missing values in apply file:');
            for (const name of plan.missing) warn(`    - ${name}`);
          }
          if (plan.invalid.length) {
            log('');
            warn('  Invalid or placeholder values in apply file:');
            for (const name of plan.invalid) warn(`    - ${name}`);
          }
          if (plan.unknownNames.length) {
            log('');
            warn('  Unknown env names:');
            for (const name of plan.unknownNames) warn(`    - ${name}`);
          }
          if (plan.commands.length) {
            log('');
            log('  Redacted commands:');
            for (const item of plan.commands.slice(0, 32)) log(`    ${item.command}`);
            if (plan.commands.length > 32) log(`    ...${plan.commands.length - 32} more`);
          }
          log('');
        }
        if (hasFlag('--require-ready') && plan.status !== 'ready') process.exit(1);
        return;
      }

      if (plan.status !== 'ready') {
        if (hasFlag('--json')) log(JSON.stringify(plan, null, 2));
        else err(`Vercel env apply blocked: ${plan.status}. Run without --apply to inspect the redacted plan.`);
        process.exit(1);
      }

      const applied = [];
      for (const item of plan.commands) {
        const value = applyEnv[item.configuredName];
        const vercelArgs = ['env', 'add', item.name, item.environment];
        if (item.environment === 'preview') {
          if (!item.previewBranch) throw new Error(`Preview branch is required for ${item.name}.`);
          vercelArgs.push(item.previewBranch);
        }
        vercelArgs.push('--yes', item.sensitive ? '--sensitive' : '--no-sensitive', '--force');
        runVercelCliWithInput(vercelArgs, value);
        applied.push({
          name: item.name,
          environment: item.environment,
          previewBranch: item.previewBranch,
          sensitive: item.sensitive,
          valueState: 'redacted',
        });
      }
      const result = {
        status: 'applied',
        project: plan.project,
        environments: plan.environments,
        applyFile: path.relative(process.cwd(), applyPath) || applyPath,
        commandCount: plan.commandCount,
        applied,
        note: 'Values were sent to Vercel via stdin and are not included in this output.',
      };
      if (hasFlag('--json')) {
        log(JSON.stringify(result, null, 2));
      } else {
        log(`\n${bold(BRAND)} — Vercel Env Apply Complete\n`);
        ok(`  Applied ${result.commandCount} redacted value(s) to Vercel.`);
        for (const item of applied) {
          log(`    - ${item.name} -> ${item.environment}${item.previewBranch ? ` (${item.previewBranch})` : ''}`);
        }
        log('');
      }
      return;
    }

    if (hasFlag('--audit')) {
      const envLsFile = getFlagValue('--env-ls-file');
      const output = envLsFile
        ? fs.readFileSync(path.resolve(envLsFile), 'utf8')
        : runVercelCli(['env', 'ls']);
      const audit = createVercelRemoteEnvAudit({ project, environments, output, env, appUrl, previewBranch, productionBranch });
      if (hasFlag('--json')) {
        log(JSON.stringify(audit, null, 2));
        if (hasFlag('--require-present') && audit.missingRequired.length) process.exit(1);
        return;
      }
      log(`\n${bold(BRAND)} — Vercel Remote Env Presence Audit\n`);
      log(`  Project:             ${audit.project}`);
      log(`  Environments:        ${audit.environments.join(', ')}`);
      log(`  Remote entries:      ${audit.entryCount}`);
      log(`  Required present:    ${audit.summary.requiredPresentCount}/${audit.summary.requiredCount}`);
      log(`  Recommended present: ${audit.summary.recommendedPresentCount}/${audit.summary.recommendedCount}`);
      log(`  Baseline present:    ${audit.summary.baselinePresentCount}/${audit.summary.baselineNameCount}`);
      log(`  Status:              ${audit.status}`);
      if (audit.environmentSummaries && Object.keys(audit.environmentSummaries).length) {
        log('');
        log('  Environment summary');
        for (const [environment, summary] of Object.entries(audit.environmentSummaries)) {
          const required = `${summary.requiredPresentCount}/${summary.requiredCount}`;
          const baseline = `${summary.baselinePresentCount}/${summary.baselineNameCount}`;
          log(`    ${environment}: required ${required}, baseline ${baseline}, status ${summary.status}`);
        }
      }
      log('');
      dim(`  ${audit.note}`);
      if (audit.missingRequired.length) {
        log('');
        warn('  Required names missing in at least one requested environment:');
        for (const name of audit.missingRequired) warn(`    - ${name}`);
      }
      if (audit.baseline.missing.length) {
        log('');
        warn('  Safe baseline names missing remotely:');
        for (const name of audit.baseline.missing) warn(`    - ${name}`);
      }
      log('');
      if (hasFlag('--require-present') && audit.missingRequired.length) process.exit(1);
      return;
    }
    const baseline = hasFlag('--baseline');
    const plan = baseline
      ? createVercelEnvBaselinePlan({ project, environments, env, appUrl, previewBranch, productionBranch })
      : createVercelEnvCommandPlan({ project, environments, env, previewBranch, productionBranch });
    if (hasFlag('--json')) {
      log(JSON.stringify(plan, null, 2));
      if (plan.previewBranchProductionConflict) process.exit(1);
      return;
    }
    log(`\n${bold(BRAND)} — ${baseline ? 'Vercel Safe Baseline Plan' : 'Vercel Environment Command Plan'}\n`);
    log(`  Project:       ${plan.project}`);
    log(`  Environments:  ${plan.environments.join(', ')}`);
    if (plan.previewBranch) log(`  Preview branch:${' '.repeat(2)}${plan.previewBranch}`);
    if (plan.requestedPreviewBranch && !plan.previewBranch) log(`  Preview branch: ${plan.requestedPreviewBranch} (blocked)`);
    if (plan.productionBranch) log(`  Production ref: ${plan.productionBranch}`);
    log(`  Commands:      ${plan.commandCount}`);
    if (baseline) {
      log(`  Baseline keys: ${plan.baselineNameCount}`);
      log(`  Manual keys:   ${plan.manualNameCount}`);
    }
    log('');
    dim(`  ${plan.note}`);
    if (plan.previewBranchProductionConflict) {
      log('');
      warn(`  Refusing production branch "${plan.requestedPreviewBranch}" as a Preview env target. Use --preview-branch <non-production-branch>.`);
    }
    log('');
    for (const item of plan.commands) {
      if (baseline) {
        log(`  ${item.powershellCommand}`);
      } else {
        const suffix = item.sensitive ? ' # secret' : '';
        log(`  ${item.command}${suffix}`);
      }
    }
    if (baseline && plan.manualCommands.length) {
      log('');
      warn('  Manual/redacted values still required:');
      for (const item of plan.manualCommands.slice(0, 24)) {
        const suffix = item.sensitive ? ' # secret' : ' # provider-specific';
        warn(`    ${item.command}${suffix}`);
      }
      if (plan.manualCommands.length > 24) warn(`    ...${plan.manualCommands.length - 24} more`);
    }
    log('');
    if (plan.previewBranchProductionConflict) process.exit(1);
    return;
  }

  if (hasFlag('--json')) {
    log(JSON.stringify({
      envFile: envFile ? path.relative(process.cwd(), envFile) || envFile : null,
      ...contract,
    }, null, 2));
    if (hasFlag('--require-ready') && contract.status !== 'ready') process.exit(1);
    return;
  }

  log(`\n${bold(BRAND)} — Production Environment Contract\n`);
  log(`  Status:              ${contract.status}`);
  log(`  Required configured: ${contract.requiredReadyCount}/${contract.requiredCount}`);
  log(`  Recommended ready:   ${contract.recommendedReadyCount}/${contract.recommendedCount}`);
  if (envFile) dim(`  Env file:            ${path.relative(process.cwd(), envFile) || envFile}`);
  log('');

  for (const [group, summary] of Object.entries(contract.groups)) {
    const status = summary.missing ? 'blocked' : summary.recommended ? 'review' : 'ready';
    log(`  ${group.padEnd(15)} ${status.padEnd(8)} ${summary.ready}/${summary.total} ready`);
  }

  if (contract.missingRequired.length) {
    log('');
    warn('  Missing, placeholder, or invalid required values:');
    for (const name of contract.missingRequired) warn(`    - ${name}`);
  }
  if (contract.missingRecommended.length) {
    log('');
    warn('  Missing, placeholder, or invalid values recommended before paid traffic:');
    for (const name of contract.missingRecommended) warn(`    - ${name}`);
  }
  log('');

  if (hasFlag('--require-ready') && contract.status !== 'ready') process.exit(1);
}

function cmdSetupContract() {
  const { env, envFile } = createCloudOpsEnv();
  const environments = splitCsv(getFlagValue('--environments'), ['production', 'preview']);
  const project = getFlagValue('--project', 'author-os');
  const previewBranch = getFlagValue('--preview-branch', '');
  const contract = createProductionSetupContract({
    env,
    project,
    environments,
    previewBranch,
  });

  if (hasFlag('--save')) {
    ensureDir('reports');
    fs.writeFileSync(path.join('reports', 'production-setup-contract.json'), JSON.stringify(contract, null, 2) + '\n');
  }

  if (hasFlag('--json')) {
    log(JSON.stringify({
      envFile: envFile ? path.relative(process.cwd(), envFile) || envFile : null,
      ...contract,
    }, null, 2));
    if (hasFlag('--require-ready') && contract.status !== 'ready') process.exit(1);
    return;
  }

  log(`\n${bold(BRAND)} — Production Setup Contract\n`);
  log(`  Status:        ${contract.status}`);
  log(`  Project:       ${contract.project}`);
  log(`  Environments:  ${contract.environments.join(', ')}`);
  log(`  Required env:  ${contract.summary.requiredEnvReadyCount}/${contract.summary.requiredEnvCount}`);
  log(`  Connectors:    ${contract.summary.connectorCount} (${contract.summary.blockedConnectorCount} blocked, ${contract.summary.reviewConnectorCount} review)`);
  log(`  Commands:      ${contract.summary.commandCount}`);
  if (envFile) dim(`  Env file:      ${path.relative(process.cwd(), envFile) || envFile}`);
  if (hasFlag('--save')) ok('  Saved:         reports/production-setup-contract.json');
  log('');

  log('  Connectors');
  for (const connector of contract.connectors) {
    const prefix = connector.status === 'pass' ? '\x1b[32mPASS\x1b[0m' : connector.status === 'blocked' ? '\x1b[31mBLOCK\x1b[0m' : '\x1b[33mREVIEW\x1b[0m';
    log(`    ${prefix} ${connector.label} (${connector.provider})`);
    if (connector.missingRequired.length) dim(`      missing: ${connector.missingRequired.join(', ')}`);
    if (!connector.missingRequired.length && connector.missingRecommended.length) dim(`      recommended: ${connector.missingRecommended.join(', ')}`);
  }
  log('');

  log('  Operator Sequence');
  for (const step of contract.operatorSequence) {
    log(`    ${step.label}`);
    dim(`      ${step.command}`);
  }
  log('');

  log('  Proof Endpoints');
  for (const endpoint of contract.proofEndpoints) {
    log(`    ${endpoint.method} ${endpoint.path}`);
  }
  log('');

  if (hasFlag('--require-ready') && contract.status !== 'ready') process.exit(1);
}

async function createLaunchMigrationEvidence(env) {
  const databaseUrl = resolveDatabaseUrl(env);
  if (!databaseUrl) return null;
  if (!hasFlag('--check-db')) {
    return {
      status: 'not_checked',
      nextAction: 'Run author-os launch-plan --check-db --env-file .env.local before promotion.',
    };
  }

  let pool = null;
  try {
    const { Pool } = await import('pg');
    pool = new Pool({
      connectionString: databaseUrl,
      max: Number(env.AUTHOROS_PG_POOL_MAX || 1),
      idleTimeoutMillis: Number(env.AUTHOROS_PG_IDLE_TIMEOUT_MS || 5000),
      connectionTimeoutMillis: Number(env.AUTHOROS_PG_CONNECTION_TIMEOUT_MS || 5000),
    });
    const runner = createCloudMigrationRunner({
      query: (sql, params) => pool.query(sql, params),
      appliedBy: env.AUTHOROS_MIGRATION_APPLIED_BY || process.env.USERNAME || process.env.USER || 'author-os-cli',
    });
    const plan = await runner.plan({ migrations: loadCloudMigrations() });
    return {
      status: plan.status,
      plan: sanitizeMigrationPlanForOutput(plan),
    };
  } finally {
    if (pool) await pool.end().catch(() => {});
  }
}

async function cmdLaunchPlan() {
  const { env, envFile } = createCloudOpsEnv();
  const envFileLabel = envFile ? path.relative(process.cwd(), envFile) || envFile : '.env.local';
  const project = getFlagValue('--project', 'author-os');
  const previewBranch = getFlagValue('--preview-branch', '');
  let migration = null;

  try {
    migration = await createLaunchMigrationEvidence(env);
  } catch (error) {
    migration = {
      status: 'not_checked',
      error: {
        code: error.code || 'MIGRATION_CHECK_FAILED',
        message: error.message,
      },
    };
  }

  const plan = createLaunchOperationsPlan({
    env,
    envFile: envFileLabel,
    project,
    migration,
    previewVerified: hasFlag('--preview-verified'),
    previewBranch,
  });

  if (hasFlag('--save')) {
    ensureDir('reports');
    fs.writeFileSync(path.join('reports', 'cloud-launch-plan.json'), JSON.stringify(plan, null, 2) + '\n');
  }

  if (hasFlag('--json')) {
    log(JSON.stringify(plan, null, 2));
    if (hasFlag('--require-ready') && plan.status !== 'ready') process.exit(1);
    return;
  }

  log(`\n${bold(BRAND)} — Hosted Launch Plan\n`);
  log(`  Status:       ${plan.status}`);
  log(`  Project:      ${plan.project}`);
  log(`  App URL:      ${plan.appUrl || 'not configured'}`);
  log(`  Actions:      ${plan.summary.actionCount} (${plan.summary.blockerCount} blocker, ${plan.summary.reviewCount} review)`);
  if (hasFlag('--save')) ok('  Saved:        reports/cloud-launch-plan.json');
  log('');

  log('  Stages');
  for (const stage of plan.stages) {
    const prefix = stage.status === 'pass' ? '\x1b[32mPASS\x1b[0m' : stage.status === 'blocked' ? '\x1b[31mBLOCK\x1b[0m' : '\x1b[33mREVIEW\x1b[0m';
    log(`    ${prefix} ${stage.label}: ${stage.detail}`);
  }
  log('');

  if (plan.actions.length) {
    log('  Next Actions');
    for (const action of plan.actions.slice(0, 12)) {
      const prefix = action.status === 'blocked' ? '\x1b[31mBLOCK\x1b[0m' : '\x1b[33mREVIEW\x1b[0m';
      log(`    ${prefix} ${action.label}`);
      dim(`      ${action.nextAction}`);
      if (action.command) dim(`      ${action.command}`);
    }
    if (plan.actions.length > 12) dim(`    + ${plan.actions.length - 12} more actions`);
    log('');
  }

  log('  Proof Commands');
  for (const commandText of plan.proofCommands) {
    log(`    ${commandText}`);
  }
  log('');

  if (hasFlag('--require-ready') && plan.status !== 'ready') process.exit(1);
}

async function cmdCloudMigrate() {
  const migrations = loadCloudMigrations();
  const { env, envFile } = createCloudOpsEnv();
  const databaseUrl = resolveDatabaseUrl(env);
  const mode = hasFlag('--apply')
    ? 'apply'
    : hasFlag('--status')
      ? 'status'
      : 'dry-run';
  const wantsJson = hasFlag('--json');
  let result = null;

  if (!databaseUrl) {
    const plan = createCloudMigrationPlan({ migrations, appliedMigrations: [] });
    result = {
      mode,
      connected: false,
      envFile: envFile ? path.relative(process.cwd(), envFile) || envFile : null,
      database: null,
      plan: sanitizeMigrationPlanForOutput(plan),
      applied: [],
      nextAction: 'Set POSTGRES_URL or DATABASE_URL, or pass --url, after attaching a Vercel Marketplace Postgres database.',
    };
    if (wantsJson) {
      log(JSON.stringify(result, null, 2));
    } else {
      log(`\n${bold(BRAND)} — Cloud Migration Plan\n`);
      warn('  Database:           not configured');
      if (envFile) dim(`  Env file:           ${path.relative(process.cwd(), envFile) || envFile}`);
      printMigrationPlan(plan);
      warn(`\n  ${result.nextAction}`);
    }
    if (mode === 'apply' || hasFlag('--require-current')) process.exit(1);
    return;
  }

  let pool = null;
  try {
    const { Pool } = await import('pg');
    pool = new Pool({
      connectionString: databaseUrl,
      max: Number(env.AUTHOROS_PG_POOL_MAX || 1),
      idleTimeoutMillis: Number(env.AUTHOROS_PG_IDLE_TIMEOUT_MS || 5000),
      connectionTimeoutMillis: Number(env.AUTHOROS_PG_CONNECTION_TIMEOUT_MS || 5000),
    });
    const runner = createCloudMigrationRunner({
      query: (sql, params) => pool.query(sql, params),
      appliedBy: env.AUTHOROS_MIGRATION_APPLIED_BY || process.env.USERNAME || process.env.USER || 'author-os-cli',
    });
    if (mode === 'apply') {
      const appliedResult = await runner.applyPendingMigrations({ migrations });
      result = {
        mode,
        connected: true,
        database: redactDatabaseUrl(databaseUrl),
        envFile: envFile ? path.relative(process.cwd(), envFile) || envFile : null,
        plan: sanitizeMigrationPlanForOutput(appliedResult.finalPlan),
        before: sanitizeMigrationPlanForOutput(appliedResult.plan),
        applied: appliedResult.applied.map(sanitizeMigrationForOutput),
        nextAction: appliedResult.finalPlan.status === 'current'
          ? `Set AUTHOROS_DB_MIGRATION_VERSION=${AUTHOR_OS_CLOUD_MIGRATION_VERSION} in Vercel after verifying the target database.`
          : 'Review pending or mismatched migrations before launch.',
      };
    } else {
      const plan = await runner.plan({ migrations });
      result = {
        mode,
        connected: true,
        database: redactDatabaseUrl(databaseUrl),
        envFile: envFile ? path.relative(process.cwd(), envFile) || envFile : null,
        plan: sanitizeMigrationPlanForOutput(plan),
        applied: [],
        nextAction: plan.status === 'current'
          ? `Set AUTHOROS_DB_MIGRATION_VERSION=${AUTHOR_OS_CLOUD_MIGRATION_VERSION} in Vercel if it is not already set.`
          : 'Run author-os cloud-migrate --apply after reviewing the target database and migration plan.',
      };
    }

    if (wantsJson) {
      log(JSON.stringify(result, null, 2));
    } else {
      log(`\n${bold(BRAND)} — Cloud Migration ${mode === 'apply' ? 'Apply' : 'Status'}\n`);
      log(`  Database:           ${result.database}`);
      if (result.envFile) dim(`  Env file:           ${result.envFile}`);
      printMigrationPlan(result.plan);
      if (result.applied.length) {
        ok('\n  Applied migrations:');
        for (const migration of result.applied) ok(`    ${migration.version}`);
      }
      log('');
      dim(`  Next: ${result.nextAction}`);
      log('');
    }

    if (hasFlag('--require-current') && result.plan.status !== 'current') process.exit(1);
  } catch (error) {
    if (wantsJson) {
      log(JSON.stringify({
        mode,
        connected: Boolean(databaseUrl),
        database: redactDatabaseUrl(databaseUrl),
        error: {
          code: error.code || 'CLOUD_MIGRATION_FAILED',
          message: error.message,
        },
      }, null, 2));
    } else {
      err(`Cloud migration failed: ${error.message}`);
    }
    process.exit(1);
  } finally {
    if (pool) await pool.end().catch(() => {});
  }
}

function cmdProductionEvidence() {
  const script = path.join(getPackageDir(), 'scripts', 'collect-production-evidence.mjs');
  if (!fs.existsSync(script)) {
    err(`Production evidence collector not found at ${script}`);
    process.exit(1);
  }
  const result = spawnSync(process.execPath, [script, ...args.slice(1)], {
    cwd: process.cwd(),
    env: process.env,
    stdio: 'inherit',
  });
  if (result.error) {
    err(`Production evidence failed: ${result.error.message}`);
    process.exit(1);
  }
  process.exit(result.status ?? 1);
}

function cmdSearch(query) {
  if (!query) { err('Usage: author-os search "query"'); process.exit(1); }
  log(`\n${bold(BRAND)} — Searching: "${query}"\n`);

  // Check if memsearch is available
  const memsearchPath = path.join(getPackageDir(), 'memory', 'memsearch-sqlite.py');
  const hasMemsearch = fs.existsSync(memsearchPath) || commandExists('memsearch-sqlite.py');
  const hasPython = commandExists('python3') || commandExists('python');

  if (!hasPython) {
    warn('  Python 3 is not installed. Semantic search requires Python 3.');
    warn('  Install: https://www.python.org/downloads/');
    dim('  Falling back to grep...\n');
  } else if (!hasMemsearch) {
    dim('  memsearch-sqlite.py not found. For semantic search:');
    dim('    pip install sentence-transformers sqlite-utils');
    dim('    See: https://github.com/frankxai/author-os#semantic-search\n');
    dim('  Falling back to grep...\n');
  }

  if (hasPython && hasMemsearch) {
    try {
      const pythonCmd = commandExists('python3') ? 'python3' : 'python';
      const result = execSync(
        `${pythonCmd} "${memsearchPath}" --query "${query.replace(/"/g, '\\"')}"`,
        { encoding: 'utf-8', timeout: 10000, stdio: ['pipe', 'pipe', 'pipe'] }
      );
      log(result);
      return;
    } catch (e) {
      dim('  memsearch failed, falling back to grep...\n');
    }
  }

  // Grep fallback
  try {
    const dirs = ['chapters', 'characters', 'worldbuilding', 'notes']
      .filter(d => fs.existsSync(d));
    if (dirs.length === 0) {
      err('  No project directories found. Run `author-os init` first.');
      process.exit(1);
    }
    const grepResult = execSync(
      `grep -rn --include="*.md" -i "${query.replace(/"/g, '\\"')}" ${dirs.join(' ')} 2>/dev/null || echo "  No matches found."`,
      { encoding: 'utf-8', timeout: 10000 }
    );
    log(grepResult);
  } catch (e) {
    err(`  Search failed: ${e.message}`);
  }
}

function cmdQuality(file) {
  if (!file) { err('Usage: author-os quality <file.md>'); process.exit(1); }
  log(`\n${bold(BRAND)} — Quality Check\n`);
  try {
    const binDir = path.dirname(fileURLToPath(import.meta.url));
    const checker = path.join(binDir, 'quality-check.js');
    if (!fs.existsSync(checker)) {
      err(`  quality-check.js not found at ${checker}`);
      err('  Reinstall author-os: npm install -g author-os-cli');
      process.exit(1);
    }
    const result = execSync(`node "${checker}" "${file}"`, { encoding: 'utf-8', timeout: 15000 });
    log(result);
  } catch (e) {
    if (e.stdout) log(e.stdout);
    if (e.stderr) err(e.stderr);
    process.exit(1);
  }
}

function cmdPublish(format) {
  if (!format) format = 'epub';
  log(`\n${bold(BRAND)} — Publishing to ${format}\n`);

  // Check for pandoc before doing any work
  if (!commandExists('pandoc')) {
    err('  pandoc is not installed. It is required for publishing.\n');
    log('  Install pandoc for your platform:');
    log('');
    log('    macOS:    brew install pandoc');
    log('    Ubuntu:   sudo apt install pandoc');
    log('    Windows:  choco install pandoc   (or winget install pandoc)');
    log('    Other:    https://pandoc.org/installing.html');
    log('');
    process.exit(1);
  }

  ensureDir('output');
  const chapters = findMdFiles('chapters').sort();
  if (chapters.length === 0) { err('  No chapters found.'); process.exit(1); }

  const combined = 'output/_combined.md';
  const content = chapters.map(f => fs.readFileSync(f, 'utf-8')).join('\n\n---\n\n');
  fs.writeFileSync(combined, content);

  const outFile = `output/book.${format}`;
  try {
    execSync(`pandoc "${combined}" -o "${outFile}" --metadata title="Untitled" 2>&1`, { encoding: 'utf-8', timeout: 30000 });
    ok(`  Output: ${outFile}`);
    const stat = fs.statSync(outFile);
    log(`  Size: ${(stat.size / 1024).toFixed(1)} KB`);
  } catch (e) {
    err(`  pandoc failed to generate ${format}.`);
    dim(`  ${e.message}`);
    process.exit(1);
  }
  log('');
}

function cmdAgents() {
  log(`\n${bold(BRAND)} — Agent Registry\n`);
  const agentFile = 'tasks/agents.json';
  if (!fs.existsSync(agentFile)) { err(`  ${agentFile} not found. Run \`author-os init\` first.`); return; }
  const data = JSON.parse(fs.readFileSync(agentFile, 'utf-8'));
  log('  Name            Role                                          Model');
  log('  ' + '-'.repeat(74));
  for (const a of data.agents) {
    log(`  ${a.name.padEnd(16)} ${a.role.padEnd(44)} ${a.model}`);
  }
  log(`\n  Total agents: ${data.agents.length}\n`);
}

function cmdSetup() {
  log(`\n${bold(BRAND)} — Setup\n`);

  const skillsSource = getSkillsDir();
  const skillFiles = ['story-architect.md', 'character-psychologist.md', 'line-editor.md', 'publish.md'];

  // Verify skills source exists
  if (!fs.existsSync(skillsSource)) {
    err(`  Skills directory not found at ${skillsSource}`);
    err('  Reinstall: npm install -g author-os-cli');
    process.exit(1);
  }

  // Detect coding agents
  log('  Detecting coding agents...');
  const agents = {
    'Claude Code': { check: () => fs.existsSync('.claude'), dest: '.claude/commands', type: 'dir' },
    'Cursor':      { check: () => fs.existsSync('.cursor'), dest: '.cursor/rules', type: 'dir' },
    'Codex':       { check: () => fs.existsSync('.codex'),  dest: '.codex/commands', type: 'dir' },
    'OpenCode':    { check: () => fs.existsSync('.opencode'), dest: '.opencode/commands', type: 'dir' },
    'AGENTS.md':   { check: () => fs.existsSync('AGENTS.md'), dest: 'AGENTS.md', type: 'agents-md' },
  };

  let anyFound = false;
  const detected = {};

  for (const [name, config] of Object.entries(agents)) {
    const found = config.check();
    detected[name] = found;
    if (found) {
      ok(`    ${name}: Found`);
      anyFound = true;
    } else {
      dim(`    ${name}: Not found`);
    }
  }

  log('');

  // Copy skills to detected agents
  let copiedTo = [];

  for (const [name, config] of Object.entries(agents)) {
    if (!detected[name]) continue;

    if (config.type === 'agents-md') {
      // Append agent definitions to AGENTS.md
      log(`  Appending agent definitions to AGENTS.md...`);
      const existing = fs.readFileSync('AGENTS.md', 'utf-8');
      if (existing.includes('author-os')) {
        dim('    ~ AGENTS.md already has author-os definitions, skipped');
      } else {
        const agentDefs = `\n\n## AuthorOS Agents\n\n` +
          `The following agents are provided by [author-os](https://github.com/frankxai/author-os):\n\n` +
          `- **story-architect** — Builds narrative structure, outlines, and scene beats\n` +
          `- **character-psychologist** — Develops deep character profiles with arcs and voice\n` +
          `- **line-editor** — Revises prose for clarity, rhythm, and voice consistency\n` +
          `- **publish** — Compiles and exports manuscripts to epub/pdf\n`;
        fs.appendFileSync('AGENTS.md', agentDefs);
        ok('    + AGENTS.md (appended agent definitions)');
      }
      copiedTo.push(name);
      continue;
    }

    // Directory-based agent: copy skill files
    ensureDir(config.dest);
    log(`  Copying skills to ${config.dest}/...`);
    for (const skill of skillFiles) {
      const src = path.join(skillsSource, skill);
      const dst = path.join(config.dest, skill);
      if (!fs.existsSync(src)) {
        warn(`    ! ${skill} not found in package`);
        continue;
      }
      fs.copyFileSync(src, dst);
      ok(`    + ${skill}`);
    }
    copiedTo.push(name);
  }

  // If no agent detected: copy to ./skills/
  if (!anyFound) {
    warn('  No coding agent detected.');
    log('  Copying skills to ./skills/ — import them manually into your preferred tool.\n');
    ensureDir('skills');
    for (const skill of skillFiles) {
      const src = path.join(skillsSource, skill);
      const dst = path.join('skills', skill);
      if (!fs.existsSync(src)) {
        warn(`    ! ${skill} not found in package`);
        continue;
      }
      fs.copyFileSync(src, dst);
      ok(`    + skills/${skill}`);
    }
    log('');
    return;
  }

  // Print completion message
  log('');
  if (detected['Claude Code']) {
    ok(`  Done! Run /story-architect in Claude Code to start writing.`);
  } else if (copiedTo.length > 0) {
    ok(`  Done! Skills installed for: ${copiedTo.join(', ')}`);
  }
  log('');
}

function cmdHelp() {
  log(`
${bold(BRAND)} v${VERSION} — AI-native author operating system

  Usage: author-os <command> [args]

  Commands:
    init                Create project structure plus starter cockpit graph
    import <path>       Import markdown/text manuscript files
    setup               Detect coding agents and install skills
    status              Word counts, chapter overview
    cockpit [--json]    Scan the project cockpit
    cockpit --save      Save reports/cockpit.json
    sync                Build .authoros/project.graph.json
    packs               List or install AuthorOS Foundry Pack workflows
    mcp [--manifest]    Show MCP server config or tools
    mcp --client-config Generate Codex/Claude/local/hosted MCP client config
    search "query"      Search across all project files
    continuity          Run local continuity audit
    quality <file.md>   Check prose quality (AI tics, passive voice)
    export [markdown]   Export local manuscript markdown
    publish [epub|pdf]  Convert chapters to publishable format
    readiness           Check export/publishing trust gates
    cloud-readiness     Check hosted/Vercel launch gates
    cloud-env           Show hosted production env contract
    setup-contract      Show production connector/env/proof setup contract
    launch-plan         Compose env, cloud, migration, and preview gates
    cloud-migrate       Plan, inspect, or apply hosted Postgres migrations
    production-evidence Collect sanitized launch/promotion evidence
    audit               Alias for readiness
    doctor              Check local install and cockpit readiness
    agents              Show agent registry
    authoring init      Install authoring standards and locked-state templates
    authoring inventory Scan authoring artifacts, teams, and risks

  Flags:
    --title <name>      Set project title during init
    --genre <csv>       Set comma-separated genre tags during init
    --template <id>     Starter: three-act-novel, romance-arc, mystery-thriller, nonfiction-guide, series-bible
    --premise <text>    Seed the starter outline premise
    --audience <text>   Seed the starter audience promise
    --blank             Init a bare graph instead of starter cockpit state
    --force             Replace existing .authoros/project.graph.json during init
    -v, --version       Show version
    -h, --help          Show this help

  Examples:
    author-os init
    author-os init --title "The Clockwork Saint" --template romance-arc --genre "romantasy,mythic fantasy" --premise "A scribe hears damaged books remember erased people."
    author-os init --blank
    author-os import manuscript.md
    author-os setup
    author-os status
    author-os sync
    author-os packs
    author-os packs install authoros-foundry-pack
    author-os cockpit --save
    author-os mcp --manifest
    author-os mcp --client-config --mode both --host codex --url https://your-author-cockpit
    author-os mcp --client-config --mode local --host claude --save .authoros/mcp-client-config.json
    author-os search "dragon"
    author-os continuity
    author-os export markdown
    author-os readiness --save
    author-os cloud-readiness --json
    author-os cloud-env
    author-os cloud-env --example
    author-os cloud-env --vercel --baseline --project author-os --environments production,preview --app-url https://your-author-cockpit --preview-branch authoros-preview
    author-os cloud-env --vercel --audit --project author-os --environments production,preview
    author-os cloud-env --vercel --project author-os --environments production,preview --preview-branch authoros-preview
    author-os cloud-env --vercel --baseline --environments preview --preview-branch authoros-preview --production-branch main
    author-os cloud-env --vercel --apply-file .env.providers.local --environments production,preview --preview-branch authoros-preview --require-ready
    author-os cloud-env --vercel --apply-file .env.providers.local --environments production,preview --preview-branch authoros-preview --apply
    author-os setup-contract --json --preview-branch authoros-preview
    author-os setup-contract --save --preview-branch authoros-preview
    author-os launch-plan --save --preview-branch authoros-preview
    author-os launch-plan --check-db --env-file .env.local --preview-branch authoros-preview
    author-os cloud-migrate --dry-run
    author-os cloud-migrate --status --env-file .env.local
    author-os cloud-migrate --apply --env-file .env.local
    author-os production-evidence --no-env-file
    author-os production-evidence --env-file .env.local --live-url https://your-preview-url --remote-env-audit --preview-branch authoros-preview --require-ready --save
    author-os quality chapters/01-chapter.md
    author-os publish epub
    author-os authoring init --repo . --dry-run
    author-os authoring inventory --repo . --save
`);
}

// ── Dispatch ─────────────────────────────────────────────────────────

switch (command) {
  case 'init':    cmdInit(); break;
  case 'import':  cmdImport(subarg); break;
  case 'setup':   cmdSetup(); break;
  case 'status':  cmdStatus(); break;
  case 'cockpit': cmdCockpit(); break;
  case 'sync':    cmdSync(); break;
  case 'packs':   cmdPacks(); break;
  case 'mcp':     cmdMcp(); break;
  case 'search':  cmdSearch(subarg); break;
  case 'continuity': cmdContinuity(); break;
  case 'quality': cmdQuality(subarg); break;
  case 'export':  cmdExport(subarg || 'markdown'); break;
  case 'publish': cmdPublish(subarg); break;
  case 'cloud-readiness':
  case 'launch-readiness':
    cmdCloudReadiness(); break;
  case 'cloud-env':
  case 'launch-env':
    cmdCloudEnv(); break;
  case 'setup-contract':
  case 'production-setup':
    cmdSetupContract(); break;
  case 'launch-plan':
  case 'cloud-launch':
    await cmdLaunchPlan(); break;
  case 'cloud-migrate':
    await cmdCloudMigrate(); break;
  case 'production-evidence':
  case 'launch-evidence':
  case 'evidence':
    cmdProductionEvidence(); break;
  case 'readiness':
  case 'audit':   cmdReadiness(); break;
  case 'doctor':  cmdDoctor(); break;
  case 'agents':  cmdAgents(); break;
  case 'authoring': cmdAuthoring(); break;
  case '-v': case '--version': log(`${BRAND} v${VERSION}`); break;
  case '-h': case '--help': case undefined: cmdHelp(); break;
  default: err(`Unknown command: ${command}`); cmdHelp(); process.exit(1);
}

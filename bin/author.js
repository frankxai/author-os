#!/usr/bin/env node

// AuthorOS CLI — the author's command line
// Commands: init, write, revise, search, status, publish, agents

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const VERSION = '0.1.0';
const BRAND = 'AuthorOS';

const args = process.argv.slice(2);
const command = args[0];
const subarg = args[1];

// ── Helpers ──────────────────────────────────────────────────────────

function log(msg) { console.log(msg); }
function err(msg) { console.error(`\x1b[31m${msg}\x1b[0m`); }
function ok(msg) { console.log(`\x1b[32m${msg}\x1b[0m`); }
function dim(msg) { console.log(`\x1b[2m${msg}\x1b[0m`); }
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

// ── Commands ─────────────────────────────────────────────────────────

function cmdInit() {
  log(`\n${bold(BRAND)} — Initializing project...\n`);
  const dirs = ['chapters', 'characters', 'worldbuilding', 'notes', 'tasks', 'memory', 'output'];
  for (const d of dirs) {
    ensureDir(d);
    ok(`  + ${d}/`);
  }

  const files = {
    'outline.md': `# Book Outline\n\n## Working Title\nUntitled\n\n## Premise\n\n\n## Act I\n\n\n## Act II\n\n\n## Act III\n\n`,
    'characters/README.md': `# Characters\n\nOne file per character. Include: name, role, arc, voice notes, relationships.\n`,
    'worldbuilding/README.md': `# Worldbuilding\n\nSystems, locations, history, rules of the world.\n`,
    'chapters/01-chapter.md': `# Chapter 1\n\n`,
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
  log(`\n${bold('Done.')} Start writing: edit chapters/01-chapter.md\n`);
}

function cmdStatus() {
  log(`\n${bold(BRAND)} — Project Status\n`);
  const chapDir = 'chapters';
  const files = findMdFiles(chapDir);
  if (files.length === 0) {
    err('  No chapters found. Run `author init` first.');
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

function cmdSearch(query) {
  if (!query) { err('Usage: author search "query"'); process.exit(1); }
  log(`\n${bold(BRAND)} — Searching: "${query}"\n`);
  try {
    const result = execSync(
      `python3 memsearch-sqlite.py --query "${query.replace(/"/g, '\\"')}" 2>/dev/null || echo "memsearch not available — falling back to grep"`,
      { encoding: 'utf-8', timeout: 10000 }
    );
    if (result.includes('falling back to grep')) {
      dim('  memsearch-sqlite.py not found, using grep fallback...\n');
      const grepResult = execSync(
        `grep -rn --include="*.md" -i "${query.replace(/"/g, '\\"')}" chapters/ characters/ worldbuilding/ notes/ 2>/dev/null || echo "  No matches found."`,
        { encoding: 'utf-8', timeout: 10000 }
      );
      log(grepResult);
    } else {
      log(result);
    }
  } catch (e) {
    err(`  Search failed: ${e.message}`);
  }
}

function cmdQuality(file) {
  if (!file) { err('Usage: author quality <file.md>'); process.exit(1); }
  log(`\n${bold(BRAND)} — Quality Check\n`);
  try {
    const binDir = path.dirname(new URL(import.meta.url).pathname);
    const checker = path.join(binDir, 'quality-check.js');
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
    err(`  pandoc failed. Install it: https://pandoc.org/installing.html`);
    dim(`  ${e.message}`);
    process.exit(1);
  }
  log('');
}

function cmdAgents() {
  log(`\n${bold(BRAND)} — Agent Registry\n`);
  const agentFile = 'tasks/agents.json';
  if (!fs.existsSync(agentFile)) { err(`  ${agentFile} not found. Run \`author init\` first.`); return; }
  const data = JSON.parse(fs.readFileSync(agentFile, 'utf-8'));
  log('  Name            Role                                          Model');
  log('  ' + '-'.repeat(74));
  for (const a of data.agents) {
    log(`  ${a.name.padEnd(16)} ${a.role.padEnd(44)} ${a.model}`);
  }
  log(`\n  Total agents: ${data.agents.length}\n`);
}

function cmdHelp() {
  log(`
${bold(BRAND)} v${VERSION} — AI-native author operating system

  Usage: author <command> [args]

  Commands:
    init                Create project structure
    status              Word counts, chapter overview
    search "query"      Search across all project files
    quality <file.md>   Check prose quality (AI tics, passive voice)
    publish [epub|pdf]  Convert chapters to publishable format
    agents              Show agent registry

  Examples:
    author init
    author status
    author search "dragon"
    author quality chapters/01-chapter.md
    author publish epub
`);
}

// ── Dispatch ─────────────────────────────────────────────────────────

switch (command) {
  case 'init':    cmdInit(); break;
  case 'status':  cmdStatus(); break;
  case 'search':  cmdSearch(subarg); break;
  case 'quality': cmdQuality(subarg); break;
  case 'publish': cmdPublish(subarg); break;
  case 'agents':  cmdAgents(); break;
  case '-v': case '--version': log(`${BRAND} v${VERSION}`); break;
  case '-h': case '--help': case undefined: cmdHelp(); break;
  default: err(`Unknown command: ${command}`); cmdHelp(); process.exit(1);
}

#!/usr/bin/env node

// AuthorOS CLI — the author's command line
// Commands: init, write, revise, search, status, publish, agents, setup

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const VERSION = '0.1.2';
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

function getPackageDir() {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
}

function getSkillsDir() {
  return path.join(getPackageDir(), 'skills');
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
    init                Create project structure
    setup               Detect coding agents and install skills
    status              Word counts, chapter overview
    search "query"      Search across all project files
    quality <file.md>   Check prose quality (AI tics, passive voice)
    publish [epub|pdf]  Convert chapters to publishable format
    agents              Show agent registry

  Flags:
    -v, --version       Show version
    -h, --help          Show this help

  Examples:
    author-os init
    author-os setup
    author-os status
    author-os search "dragon"
    author-os quality chapters/01-chapter.md
    author-os publish epub
`);
}

// ── Dispatch ─────────────────────────────────────────────────────────

switch (command) {
  case 'init':    cmdInit(); break;
  case 'setup':   cmdSetup(); break;
  case 'status':  cmdStatus(); break;
  case 'search':  cmdSearch(subarg); break;
  case 'quality': cmdQuality(subarg); break;
  case 'publish': cmdPublish(subarg); break;
  case 'agents':  cmdAgents(); break;
  case '-v': case '--version': log(`${BRAND} v${VERSION}`); break;
  case '-h': case '--help': case undefined: cmdHelp(); break;
  default: err(`Unknown command: ${command}`); cmdHelp(); process.exit(1);
}

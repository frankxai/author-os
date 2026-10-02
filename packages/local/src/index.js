import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomBytes } from 'node:crypto';
import {
  appendAuditArtifacts,
  countWords,
  compileManuscriptEpub,
  createEmptyProject,
  createExportRecord,
  createId,
  createRevisionSuggestion,
  createSceneRecord,
  exportBookMarkdown,
  installPackIntoProject,
  normalizeProject,
  runContinuityCheck,
  searchManuscript,
  slugify,
} from '../../core/src/index.js';

function readJsonSafe(file) {
  try {
    if (!fs.existsSync(file)) return null;
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch {
    return null;
  }
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function readFirstHeading(file) {
  if (!fs.existsSync(file)) return null;
  const heading = fs.readFileSync(file, 'utf-8').split('\n').find(line => /^#\s+/.test(line.trim()));
  return heading ? heading.replace(/^#\s+/, '').trim() : null;
}

function findFilesRecursive(dir, predicate) {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const results = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['.git', 'node_modules', '.next', 'dist', 'output'].includes(entry.name)) continue;
      results.push(...findFilesRecursive(fullPath, predicate));
    } else if (predicate(fullPath, entry.name)) {
      results.push(fullPath);
    }
  }
  return results;
}

function relative(root, file) {
  return path.relative(root, file).replace(/\\/g, '/');
}

export function readAuthorProject(root = process.cwd()) {
  const graphFile = path.join(root, '.authoros', 'project.graph.json');
  const legacyGraphFile = path.join(root, 'authoros.graph.json');
  const savedGraph = readJsonSafe(graphFile) || readJsonSafe(legacyGraphFile);
  if (savedGraph) return normalizeProject(savedGraph);

  const manifest = readJsonSafe(path.join(root, 'authoros.json')) || {};
  const title = manifest.title || readFirstHeading(path.join(root, 'outline.md')) || path.basename(root);
  const project = createEmptyProject({
    title,
    type: manifest.type || 'book',
    genre: manifest.genre || [],
    stage: manifest.stage || 'drafting',
    targetWords: manifest.targetWords || 80000,
  });

  const bookId = project.books[0]?.id || createId('book');
  const chapterFiles = findFilesRecursive(path.join(root, 'chapters'), (file, name) => name.endsWith('.md')).sort();
  project.chapters = chapterFiles.map((file, index) => {
    const text = fs.readFileSync(file, 'utf-8');
    return {
      id: `chapter_${String(index + 1).padStart(3, '0')}`,
      bookId,
      title: readFirstHeading(file) || path.basename(file, '.md'),
      order: index + 1,
      status: 'drafting',
      file: relative(root, file),
      wordCount: countWords(text),
      text,
    };
  });

  project.scenes = project.chapters.map((chapter, index) => createSceneRecord({
    id: `scene_${String(index + 1).padStart(3, '0')}`,
    chapterId: chapter.id,
    title: chapter.title,
    status: chapter.status,
    order: index + 1,
    text: chapter.text,
    tags: ['imported-chapter'],
  }));

  const characterFiles = findFilesRecursive(path.join(root, 'characters'), (file, name) => name.endsWith('.md')).sort();
  const worldFiles = findFilesRecursive(path.join(root, 'worldbuilding'), (file, name) => name.endsWith('.md')).sort();
  project.entities = [
    ...characterFiles.map(file => ({
      id: `ent_${slugify(path.basename(file, '.md'))}`,
      kind: 'Character',
      name: readFirstHeading(file) || path.basename(file, '.md'),
      aliases: [],
      summary: fs.readFileSync(file, 'utf-8').split('\n').slice(0, 8).join(' ').replace(/^#\s+/, '').trim(),
      file: relative(root, file),
      assetIds: [],
    })),
    ...worldFiles.map(file => ({
      id: `ent_${slugify(path.basename(file, '.md'))}`,
      kind: 'Location',
      name: readFirstHeading(file) || path.basename(file, '.md'),
      aliases: [],
      summary: fs.readFileSync(file, 'utf-8').split('\n').slice(0, 8).join(' ').replace(/^#\s+/, '').trim(),
      file: relative(root, file),
      assetIds: [],
    })),
  ];

  project.assets = findFilesRecursive(path.join(root, 'assets'), () => true).map(file => ({
    id: `asset_${slugify(path.basename(file, path.extname(file)))}`,
    type: path.extname(file).replace('.', '') || 'file',
    title: path.basename(file),
    source: 'local-file',
    rights: 'user-provided',
    path: relative(root, file),
    usedIn: [],
    tags: ['local'],
  }));

  const queue = readJsonSafe(path.join(root, 'tasks', 'queue.json'));
  project.tasks = Array.isArray(queue?.tasks) ? queue.tasks : [];

  return normalizeProject(project);
}

export function writeAuthorProject(root = process.cwd(), project) {
  const graph = normalizeProject(project);
  const dir = path.join(root, '.authoros');
  ensureDir(dir);
  const file = path.join(dir, 'project.graph.json');
  fs.writeFileSync(file, JSON.stringify(graph, null, 2) + '\n');
  return file;
}

export function appendLocalAuditArtifacts(root = process.cwd(), artifacts = {}) {
  const project = readAuthorProject(root);
  const updated = appendAuditArtifacts(project, artifacts);
  const graphFile = writeAuthorProject(root, updated);
  return { project: updated, graphFile };
}

export function installLocalPack(root = process.cwd(), selection = 'authoros-foundry-pack', options = {}) {
  const project = readAuthorProject(root);
  const result = installPackIntoProject(project, selection, {
    installedBy: options.installedBy || 'author-os-cli',
  });
  const graphFile = writeAuthorProject(root, result.project);
  ensureDir(path.join(root, '.authoros', 'packs'));
  const receiptFile = path.join(root, '.authoros', 'packs', `${slugify(selection)}.receipt.json`);
  fs.writeFileSync(receiptFile, JSON.stringify({
    manifestId: result.manifestId,
    registryVersion: result.registryVersion,
    selection,
    installed: result.installed,
    skipped: result.skipped,
    noProseGenerated: result.noProseGenerated,
    graphFile: relative(root, graphFile),
    createdAt: result.project.project.updatedAt,
  }, null, 2) + '\n');
  return {
    ...result,
    graphFile,
    receiptFile,
  };
}

export function readCanon(root = process.cwd()) {
  const candidates = [
    path.join(root, 'CANON_LOCKED.md'),
    path.join(root, 'canon.md'),
    path.join(root, 'worldbuilding', 'CANON_LOCKED.md'),
  ];
  const files = candidates.filter(file => fs.existsSync(file));
  return files.map(file => ({
    file: relative(root, file),
    text: fs.readFileSync(file, 'utf-8'),
  }));
}

export function searchLocalProject(root = process.cwd(), query, options = {}) {
  return searchManuscript(readAuthorProject(root), query, options);
}

export function createLocalScene(root = process.cwd(), input = {}) {
  ensureDir(path.join(root, 'scenes'));
  const title = input.title || 'Untitled Scene';
  const scene = createSceneRecord(input);
  const fileName = `${slugify(title)}.md`;
  const file = path.join(root, 'scenes', fileName);
  const content = [
    `# ${title}`,
    '',
    input.synopsis ? `> ${input.synopsis}` : '> Scene synopsis pending.',
    '',
    input.text || '',
  ].join('\n');
  fs.writeFileSync(file, content);

  const project = readAuthorProject(root);
  project.scenes.push({ ...scene, file: relative(root, file) });
  writeAuthorProject(root, project);

  return { scene: { ...scene, file: relative(root, file) }, file };
}

export function createLocalRevisionSuggestion(root = process.cwd(), input = {}) {
  const project = readAuthorProject(root);
  const revision = createRevisionSuggestion(project, input.sceneId, input.instruction, input);
  const updated = appendAuditArtifacts(project, {
    agentRuns: [revision.run],
    suggestions: [revision.suggestion],
    creditLedgerEntries: [revision.creditLedgerEntry],
  });
  const graphFile = writeAuthorProject(root, updated);
  return {
    ...revision,
    graphFile,
  };
}

export function importManuscript(source, root = process.cwd()) {
  if (!source || !fs.existsSync(source)) throw new Error(`Import source not found: ${source}`);
  ensureDir(path.join(root, 'chapters'));
  const stat = fs.statSync(source);
  const imported = [];

  if (stat.isDirectory()) {
    const files = findFilesRecursive(source, (file, name) => name.endsWith('.md') || name.endsWith('.txt')).sort();
    files.forEach((file, index) => {
      const ext = path.extname(file).toLowerCase() === '.txt' ? '.md' : path.extname(file);
      const target = path.join(root, 'chapters', `${String(index + 1).padStart(2, '0')}-${slugify(path.basename(file, path.extname(file)))}${ext}`);
      fs.copyFileSync(file, target);
      imported.push(relative(root, target));
    });
  } else {
    const ext = path.extname(source).toLowerCase() === '.txt' ? '.md' : path.extname(source);
    const target = path.join(root, 'chapters', `imported-${slugify(path.basename(source, path.extname(source)))}${ext}`);
    fs.copyFileSync(source, target);
    imported.push(relative(root, target));
  }

  const project = readAuthorProject(root);
  writeAuthorProject(root, project);
  return { imported, graphFile: path.join(root, '.authoros', 'project.graph.json') };
}

export function exportLocalProject(root = process.cwd(), format = 'markdown') {
  if (format === 'epub') return exportLocalEpub(root);
  const project = readAuthorProject(root);
  ensureDir(path.join(root, 'output'));
  if (['markdown', 'md'].includes(format)) {
    const file = path.join(root, 'output', 'book.md');
    fs.writeFileSync(file, exportBookMarkdown(project));
    const exportRecord = createExportRecord(project, {
      format: 'markdown',
      status: 'completed',
      path: relative(root, file),
    });
    const updated = appendAuditArtifacts(project, { exports: [exportRecord] });
    writeAuthorProject(root, updated);
    return { file, format: 'markdown', export: exportRecord };
  }
  throw new Error(`Local adapter only exports markdown directly. Use pandoc-backed CLI export for ${format}.`);
}

const digest = bytes => createHash('sha256').update(bytes).digest('hex');

function epubSources(root) {
  const graph = ['.authoros/project.graph.json', 'authoros.graph.json'].find(file => fs.existsSync(path.join(root, file)));
  const files = graph ? [path.join(root, graph)] : [
    ...(fs.existsSync(path.join(root, 'authoros.json')) ? [path.join(root, 'authoros.json')] : []),
    ...(fs.existsSync(path.join(root, 'outline.md')) ? [path.join(root, 'outline.md')] : []),
    ...findFilesRecursive(path.join(root, 'chapters'), (_file, name) => name.endsWith('.md')).sort(),
  ];
  const inputs = files.map(file => {
    if (fs.statSync(file).size > 32 * 1024 * 1024) throw new Error('EPUB source file exceeds 32 MiB.');
    const bytes = fs.readFileSync(file);
    return { path: relative(root, file), sha256: digest(bytes), modifiedAt: fs.statSync(file).mtime.toISOString() };
  });
  return { inputs, sha256: digest(JSON.stringify(inputs)) };
}

// Immutable files avoid overwriting a reader's edits. A failed receipt write can be retried.
function publishImmutable(file, bytes) {
  if (fs.existsSync(file)) {
    if (fs.lstatSync(file).isSymbolicLink() || !fs.readFileSync(file).equals(Buffer.from(bytes))) {
      throw new Error(`Existing edition differs; preserve and inspect ${path.basename(file)}.`);
    }
    return;
  }
  const temporary = `${file}.${randomBytes(8).toString('hex')}.tmp`;
  let descriptor;
  try {
    descriptor = fs.openSync(temporary, 'wx', 0o600);
    fs.writeFileSync(descriptor, bytes);
    fs.fsyncSync(descriptor);
    fs.closeSync(descriptor);
    descriptor = undefined;
    try { fs.linkSync(temporary, file); }
    catch (error) {
      if (error.code !== 'EEXIST' || fs.lstatSync(file).isSymbolicLink() ||
          !fs.readFileSync(file).equals(Buffer.from(bytes))) throw error;
    }
  } finally {
    if (descriptor !== undefined) fs.closeSync(descriptor);
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
  }
}

function exportLocalEpub(root) {
  root = fs.realpathSync(root);
  const source = epubSources(root);
  for (const input of source.inputs) {
    if (input.path.endsWith('.json')) JSON.parse(fs.readFileSync(path.join(root, input.path), 'utf8'));
  }
  const project = readAuthorProject(root);
  if (!source.inputs.some(input => input.path.endsWith('graph.json'))) {
    const manifest = readJsonSafe(path.join(root, 'authoros.json')) || {};
    project.project.author = manifest.author;
    project.project.language = manifest.language;
  }
  const modifiedAt = source.inputs.map(input => input.modifiedAt).sort().at(-1);
  const options = { identifier: `urn:sha256:${source.sha256}`, modifiedAt };
  const bytes = Buffer.from(compileManuscriptEpub(project, options));
  if (epubSources(root).sha256 !== source.sha256) throw new Error('Source changed during EPUB export; retry from the new revision.');
  const checksum = digest(bytes);
  const output = path.join(root, 'output');
  if (fs.existsSync(output) && fs.lstatSync(output).isSymbolicLink()) throw new Error('EPUB output directory must not be a link.');
  ensureDir(output);
  if (path.dirname(fs.realpathSync(output)) !== root) throw new Error('EPUB output must stay inside the project.');
  const file = path.join(output, `book-${checksum}.epub`);
  const receiptFile = `${file}.source.json`;
  const receipt = {
    schemaVersion: 1, format: 'epub', renderer: 'author-os-text-epub-v1/markdown-it-15.0.2',
    sourceSha256: source.sha256, sources: source.inputs, checksum, modifiedAt,
    identifier: options.identifier, file: relative(root, file), approvalState: 'requested',
    scope: 'Internal text reading proof; no EPUBCheck, reader, rights or publication approval inferred.',
  };
  publishImmutable(file, bytes);
  publishImmutable(receiptFile, Buffer.from(JSON.stringify(receipt, null, 2) + '\n'));
  return { file, receiptFile, format: 'epub', checksum, sourceSha256: source.sha256,
    export: createExportRecord(project, { format: 'epub', status: 'completed', path: relative(root, file), checksum }) };
}

export function runLocalContinuity(root = process.cwd()) {
  const report = runContinuityCheck(readAuthorProject(root));
  ensureDir(path.join(root, 'reports'));
  const file = path.join(root, 'reports', 'continuity.json');
  fs.writeFileSync(file, JSON.stringify(report, null, 2) + '\n');
  return { report, file };
}

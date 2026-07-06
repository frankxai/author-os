import fs from 'node:fs';
import path from 'node:path';
import {
  appendAuditArtifacts,
  countWords,
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

export function runLocalContinuity(root = process.cwd()) {
  const report = runContinuityCheck(readAuthorProject(root));
  ensureDir(path.join(root, 'reports'));
  const file = path.join(root, 'reports', 'continuity.json');
  fs.writeFileSync(file, JSON.stringify(report, null, 2) + '\n');
  return { report, file };
}

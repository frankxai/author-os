/**
 * AuthorOS Multi-Format Exporter
 * Compiles manuscript graphs into Markdown, ePub 3.0 structure, and Story Bible bundles.
 */

/**
 * Exports complete manuscript to standard Markdown with YAML frontmatter.
 */
export function compileManuscriptMarkdown(project) {
  const meta = project.project || {};
  const books = project.books || [];
  const chapters = project.chapters || [];
  const scenes = project.scenes || [];

  const lines = [];

  // Frontmatter
  lines.push('---');
  lines.push(`title: "${meta.title || 'Untitled'}"`);
  if (meta.author) lines.push(`author: "${meta.author}"`);
  if (meta.genre) lines.push(`genre: [${(Array.isArray(meta.genre) ? meta.genre : [meta.genre]).map(g => `"${g}"`).join(', ')}]`);
  lines.push(`exportedAt: "${new Date().toISOString()}"`);
  lines.push('generator: "AuthorOS 2026"');
  lines.push('---');
  lines.push('');

  // Title
  lines.push(`# ${meta.title || 'Untitled'}`);
  lines.push('');

  // Sort chapters
  const sortedChapters = [...chapters].sort((a, b) => (a.order || 0) - (b.order || 0));

  for (const chapter of sortedChapters) {
    lines.push(`## ${chapter.title || `Chapter ${chapter.order}`}`);
    lines.push('');

    const chapterScenes = scenes
      .filter(s => s.chapterId === chapter.id)
      .sort((a, b) => (a.order || 0) - (b.order || 0));

    for (let i = 0; i < chapterScenes.length; i++) {
      const scene = chapterScenes[i];
      if (scene.text) {
        lines.push(scene.text.trim());
        lines.push('');
      }

      // Scene break if not the last scene in chapter
      if (i < chapterScenes.length - 1) {
        lines.push('* * *');
        lines.push('');
      }
    }
  }

  return lines.join('\n');
}

export { buildTextEpub as buildEpubPackageStructure, compileManuscriptEpub } from './epub.js';

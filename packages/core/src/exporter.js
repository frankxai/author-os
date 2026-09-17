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

/**
 * Builds an ePub 3.0 virtual file package manifest.
 */
export function buildEpubPackageStructure(project) {
  const meta = project.project || {};
  const chapters = project.chapters || [];
  const scenes = project.scenes || [];

  const packageFiles = {};

  // mimetype
  packageFiles['mimetype'] = 'application/epub+zip';

  // META-INF/container.xml
  packageFiles['META-INF/container.xml'] = `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`;

  // OEBPS/toc.xhtml
  const sortedChapters = [...chapters].sort((a, b) => (a.order || 0) - (b.order || 0));
  const navList = sortedChapters.map((ch, idx) => `      <li><a href="chapter_${idx + 1}.xhtml">${ch.title}</a></li>`).join('\n');

  packageFiles['OEBPS/nav.xhtml'] = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head><title>Table of Contents</title></head>
<body>
  <nav epub:type="toc" id="toc">
    <h1>Table of Contents</h1>
    <ol>
${navList}
    </ol>
  </nav>
</body>
</html>`;

  // Chapter XHTML files
  sortedChapters.forEach((ch, idx) => {
    const chapterScenes = scenes
      .filter(s => s.chapterId === ch.id)
      .sort((a, b) => (a.order || 0) - (b.order || 0));

    const bodyHtml = chapterScenes
      .map(s => (s.text || '').split(/\n\s*\n/).map(p => `  <p>${p.trim()}</p>`).join('\n'))
      .join('\n  <hr class="scene-break"/>\n');

    packageFiles[`OEBPS/chapter_${idx + 1}.xhtml`] = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <title>${ch.title}</title>
  <link rel="stylesheet" type="text/css" href="style.css"/>
</head>
<body>
  <h1>${ch.title}</h1>
${bodyHtml}
</body>
</html>`;
  });

  // OEBPS/style.css
  packageFiles['OEBPS/style.css'] = `body { font-family: serif; line-height: 1.6; margin: 5%; }
h1 { text-align: center; margin-bottom: 2em; }
p { text-indent: 1.5em; margin: 0; }
p:first-of-type { text-indent: 0; }
hr.scene-break { border: 0; text-align: center; margin: 2em 0; }
hr.scene-break:before { content: "* * *"; }`;

  return {
    format: 'epub3',
    title: meta.title,
    fileCount: Object.keys(packageFiles).length,
    packageFiles,
  };
}

import MarkdownIt from '../vendor/markdown-it.cjs';

const encoder = new TextEncoder();
const MAX_TEXT_BYTES = 16 * 1024 * 1024;

function xml(value) {
  const text = String(value ?? '');
  for (const char of text) {
    const point = char.codePointAt(0);
    if ((point < 32 && ![9, 10, 13].includes(point)) ||
        (point >= 0xd800 && point <= 0xdfff) || point === 0xfffe || point === 0xffff) {
      throw new Error('EPUB text contains an invalid XML character.');
    }
  }
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function ordered(items) {
  return [...items].sort((a, b) => (a.order || 0) - (b.order || 0));
}

function document(title, language, body) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="${xml(language)}" xml:lang="${xml(language)}">
<head><title>${xml(title)}</title><link rel="stylesheet" type="text/css" href="style.css"/></head>
<body>${body}</body>
</html>`;
}

/** Text-only EPUB 3 package. Raw HTML is text; images require an asset-aware exporter. */
export function buildTextEpub(project, options = {}) {
  const meta = project.project || {};
  const chapters = ordered(project.chapters || []);
  const scenes = project.scenes || [];
  if (!chapters.length || chapters.length > 500) throw new Error('EPUB requires 1–500 chapters.');
  if ((project.books || []).length > 1) throw new Error('Select one book before EPUB export.');
  const ids = new Set();
  for (const chapter of chapters) {
    if (!chapter.id || ids.has(chapter.id)) throw new Error('EPUB chapter IDs must be unique and nonempty.');
    ids.add(chapter.id);
    if (chapter.order !== undefined && !Number.isFinite(chapter.order)) throw new Error('Invalid chapter order.');
  }
  let size = 0;
  const sceneIds = new Set();
  for (const scene of scenes) {
    if (!ids.has(scene.chapterId)) throw new Error('EPUB scene refers to a missing chapter.');
    if (!scene.id || sceneIds.has(scene.id)) throw new Error('EPUB scene IDs must be unique and nonempty.');
    sceneIds.add(scene.id);
    if (scene.order !== undefined && !Number.isFinite(scene.order)) throw new Error('Invalid scene order.');
    if (typeof scene.text !== 'string') throw new Error('EPUB scene text must be a string.');
    xml(scene.text);
    size += encoder.encode(scene.text).length;
    if (size > MAX_TEXT_BYTES) throw new Error('EPUB source exceeds the 16 MiB text limit.');
  }
  const title = meta.title || 'Untitled';
  const language = options.language || meta.language || 'en';
  if (typeof language !== 'string' || !/^[a-z]{2,8}(?:-[a-z0-9]{1,8})*$/i.test(language)) {
    throw new Error('EPUB language must be a language tag.');
  }
  const identifier = options.identifier || (meta.id ? `urn:authoros:${meta.id}` : null);
  if (!identifier) throw new Error('EPUB requires a project ID or explicit identifier.');
  const timestamp = options.modifiedAt || meta.updatedAt || meta.createdAt;
  if (!timestamp || !Number.isFinite(Date.parse(timestamp))) {
    throw new Error('EPUB requires an explicit modifiedAt or source timestamp.');
  }
  const modifiedAt = new Date(timestamp).toISOString().replace(/\.\d{3}Z$/, 'Z');
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(modifiedAt)) throw new Error('EPUB timestamp year must have four digits.');
  const md = new MarkdownIt({ html: false, xhtmlOut: true, linkify: false, typographer: false });
  md.renderer.rules.image = () => { throw new Error('Text EPUB does not support images; use an asset-aware export.'); };
  md.renderer.rules.heading_open = (tokens, index, opts, env, renderer) => {
    const text = tokens[index + 1].content;
    const slug = text.toLowerCase().replace(/[^\p{L}\p{N}_-]+/gu, '-').replace(/^-|-$/g, '') || 'heading';
    let id = slug;
    for (let suffix = 2; env.ids.has(id); suffix++) id = `${slug}-${suffix}`;
    env.ids.add(id);
    tokens[index].attrSet('id', id);
    return renderer.renderToken(tokens, index, opts);
  };
  md.renderer.rules.link_open = (tokens, index, opts, env, renderer) => {
    const href = tokens[index].attrGet('href');
    if (href.startsWith('#')) env.links.push(href.slice(1));
    else if (!/^(https?:\/\/|mailto:)/i.test(href)) {
      throw new Error('Text EPUB supports web/mail links and same-chapter heading anchors only.');
    }
    return renderer.renderToken(tokens, index, opts);
  };
  const packageFiles = {
    mimetype: 'application/epub+zip',
    'META-INF/container.xml': '<?xml version="1.0" encoding="UTF-8"?>\n<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>',
  };
  const manifest = [];
  const spine = [];
  const navigation = [];
  chapters.forEach((chapter, index) => {
    const chapterTitle = chapter.title || `Chapter ${index + 1}`;
    const name = `chapter_${index + 1}.xhtml`;
    const selected = ordered(scenes.filter(scene => scene.chapterId === chapter.id));
    if (!selected.length) throw new Error(`Chapter ${index + 1} has no scenes.`);
    const environment = { ids: new Set(['chapter-title']), links: [] };
    const body = selected.map(scene => md.render(scene.text, environment)).join('<hr class="scene-break"/>\n');
    for (const link of environment.links) {
      if (!environment.ids.has(decodeURIComponent(link))) throw new Error(`EPUB link points to a missing heading: ${link}`);
    }
    xml(body); // Validate decoded Markdown entities before retaining the generated XHTML.
    packageFiles[`OEBPS/${name}`] = document(chapterTitle, language, `<h1 id="chapter-title">${xml(chapterTitle)}</h1>\n${body}`);
    manifest.push(`<item id="chapter_${index + 1}" href="${name}" media-type="application/xhtml+xml"/>`);
    spine.push(`<itemref idref="chapter_${index + 1}"/>`);
    navigation.push(`<li><a href="${name}">${xml(chapterTitle)}</a></li>`);
  });
  packageFiles['OEBPS/nav.xhtml'] = document('Contents', language,
    `<nav epub:type="toc" id="toc"><h1>Contents</h1><ol>${navigation.join('\n')}</ol></nav>`);
  packageFiles['OEBPS/style.css'] = `body { font-family: serif; line-height: 1.6; margin: 5%; }
h1 { text-align: center; margin-bottom: 2em; }
p { text-indent: 1.5em; margin: 0; }
h1 + p, h2 + p, hr + p, blockquote p { text-indent: 0; }
blockquote { margin: 1em 1.5em; }
pre { white-space: pre-wrap; overflow-wrap: anywhere; }
hr.scene-break { width: 25%; margin: 2em auto; }
a { overflow-wrap: anywhere; }`;
  packageFiles['OEBPS/content.opf'] = `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="book-id" xml:lang="${xml(language)}">
<metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
<dc:identifier id="book-id">${xml(identifier)}</dc:identifier>
<dc:title>${xml(title)}</dc:title><dc:language>${xml(language)}</dc:language>
${meta.author ? `<dc:creator>${xml(meta.author)}</dc:creator>` : ''}
<meta property="dcterms:modified">${modifiedAt}</meta>
</metadata>
<manifest><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
<item id="style" href="style.css" media-type="text/css"/>${manifest.join('\n')}</manifest>
<spine>${spine.join('\n')}</spine>
</package>`;
  return { format: 'epub3', title, identifier, language, modifiedAt,
    fileCount: Object.keys(packageFiles).length, packageFiles };
}

// OCF uses ordinary ZIP32. Entries are stored, including the required first mimetype.
const crcTable = Uint32Array.from({ length: 256 }, (_, value) => {
  for (let bit = 0; bit < 8; bit++) value = (value & 1) ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
});

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function header(length, fields) {
  const bytes = new Uint8Array(length);
  const view = new DataView(bytes.buffer);
  for (const [offset, value, width] of fields) {
    if (width === 4) view.setUint32(offset, value, true);
    else view.setUint16(offset, value, true);
  }
  return bytes;
}

/** Returns actual EPUB bytes; no disk, network, clock, random state or source writes. */
export function compileManuscriptEpub(project, options = {}) {
  const { packageFiles } = buildTextEpub(project, options);
  const chunks = [];
  const central = [];
  let offset = 0;
  for (const [name, value] of Object.entries(packageFiles)) {
    const filename = encoder.encode(name);
    const content = encoder.encode(value);
    const crc = crc32(content);
    const local = header(30, [[0, 0x04034b50, 4], [4, 20, 2], [6, 0x800, 2],
      [12, 33, 2], [14, crc, 4], [18, content.length, 4], [22, content.length, 4], [26, filename.length, 2]]);
    chunks.push(local, filename, content);
    central.push(header(46, [[0, 0x02014b50, 4], [4, 20, 2], [6, 20, 2], [8, 0x800, 2],
      [14, 33, 2], [16, crc, 4], [20, content.length, 4], [24, content.length, 4], [28, filename.length, 2], [42, offset, 4]]), filename);
    offset += local.length + filename.length + content.length;
  }
  const centralSize = central.reduce((sum, bytes) => sum + bytes.length, 0);
  const count = Object.keys(packageFiles).length;
  const end = header(22, [[0, 0x06054b50, 4], [8, count, 2], [10, count, 2],
    [12, centralSize, 4], [16, offset, 4]]);
  const result = new Uint8Array(offset + centralSize + end.length);
  let cursor = 0;
  for (const bytes of [...chunks, ...central, end]) { result.set(bytes, cursor); cursor += bytes.length; }
  return result;
}

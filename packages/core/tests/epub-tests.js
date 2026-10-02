import assert from 'node:assert/strict';
import { crc32 } from 'node:zlib';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { buildEpubPackageStructure, compileManuscriptEpub } from '../src/index.js';

const project = {
  project: { id: 'unicode-book', title: 'Salt & Stars <draft>', author: 'François “F.”', language: 'en', updatedAt: '2026-10-02T12:00:00Z' },
  books: [{ id: 'book' }],
  chapters: [{ id: 'second', title: '帰路 & Home', order: 2 }, { id: 'first', title: 'The <Door>', order: 1 }],
  scenes: [
    { id: 'two', chapterId: 'second', order: 1, text: 'They returned. Ω & 雨.' },
    { id: 'end', chapterId: 'first', order: 2, text: 'The second scene ends with **a choice**.' },
    { id: 'start', chapterId: 'first', order: 1, text: '# Open door\n\n*Listen*, she said.\n\n> A remembered voice.\n\n[Return](#open-door) and [source](https://example.org/?a=1&b=2).\n\n<script>alert("test")</script>\n\n`code < & >`' },
  ],
};
const snapshot = JSON.stringify(project);
const structure = buildEpubPackageStructure(project);
assert.match(structure.packageFiles['OEBPS/content.opf'], /<dc:title>Salt &amp; Stars &lt;draft&gt;<\/dc:title>/);
assert.match(structure.packageFiles['OEBPS/content.opf'], /<dc:creator>François “F\.”<\/dc:creator>/);
assert.match(structure.packageFiles['OEBPS/content.opf'], /idref="chapter_1".*\n.*idref="chapter_2"/);
const chapter = structure.packageFiles['OEBPS/chapter_1.xhtml'];
assert.match(chapter, /<em>Listen<\/em>/);
assert.match(chapter, /<strong>a choice<\/strong>/);
assert.match(chapter, /id="open-door"/);
assert.match(chapter, /<blockquote>/);
assert.match(chapter, /&lt;script&gt;/);
assert.doesNotMatch(chapter, /<script[\s>]/i);
assert.match(chapter, /a=1&amp;b=2/);
assert.ok(chapter.indexOf('Listen') < chapter.indexOf('second scene'));
assert.equal(JSON.stringify(project), snapshot);

const bytes = Buffer.from(compileManuscriptEpub(project));
assert.deepEqual(Buffer.from(compileManuscriptEpub(project)), bytes);
const entries = [];
let cursor = 0;
while (bytes.readUInt32LE(cursor) === 0x04034b50) {
  assert.equal(bytes.readUInt16LE(cursor + 8), 0, 'Stored, without compression');
  assert.equal(bytes.readUInt16LE(cursor + 28), 0, 'No extra field');
  const size = bytes.readUInt32LE(cursor + 18);
  const nameLength = bytes.readUInt16LE(cursor + 26);
  const name = bytes.subarray(cursor + 30, cursor + 30 + nameLength).toString('utf8');
  const content = bytes.subarray(cursor + 30 + nameLength, cursor + 30 + nameLength + size);
  assert.equal(crc32(content), bytes.readUInt32LE(cursor + 14));
  assert.equal(content.toString('utf8'), structure.packageFiles[name]);
  entries.push({ name, offset: cursor });
  cursor += 30 + nameLength + size;
}
assert.equal(entries[0].name, 'mimetype');
assert.equal(entries.length, structure.fileCount);
const centralStart = cursor;
for (const entry of entries) {
  assert.equal(bytes.readUInt32LE(cursor), 0x02014b50);
  assert.equal(bytes.readUInt32LE(cursor + 42), entry.offset);
  const nameLength = bytes.readUInt16LE(cursor + 28);
  assert.equal(bytes.subarray(cursor + 46, cursor + 46 + nameLength).toString('utf8'), entry.name);
  cursor += 46 + nameLength;
}
assert.equal(bytes.readUInt32LE(cursor), 0x06054b50);
assert.equal(bytes.readUInt32LE(cursor + 16), centralStart);
assert.equal(bytes.readUInt16LE(cursor + 10), entries.length);
assert.equal(cursor + 22, bytes.length);

const changed = structuredClone(project);
changed.scenes[0].text += '\n\nA reader edit survives.';
assert.notDeepEqual(Buffer.from(compileManuscriptEpub(changed)), bytes);
for (const [mutate, message] of [
  [p => p.scenes.push({ ...p.scenes[0] }), /unique/],
  [p => p.scenes[0].chapterId = 'absent', /missing chapter/],
  [p => p.scenes[0].text = 'bad\u0000text', /invalid XML/],
  [p => p.scenes[0].text = '\ud800', /invalid XML/],
  [p => p.scenes[0].text = '![cover](cover.jpg)', /does not support images/],
  [p => p.scenes[0].text = '[missing](#absent)', /missing heading/],
  [p => p.scenes[0].text = '[chapter](next.md)', /same-chapter/],
  [p => p.books.push({ id: 'other' }), /one book/],
  [p => p.project.updatedAt = 'yesterday-ish', /timestamp/],
  [p => p.project.language = 'en\"onclick', /language tag/],
]) {
  const invalid = structuredClone(project);
  mutate(invalid);
  const frozen = JSON.stringify(invalid);
  assert.throws(() => compileManuscriptEpub(invalid), message);
  assert.equal(JSON.stringify(invalid), frozen);
}
const vendor = readFileSync(new URL('../vendor/markdown-it.cjs', import.meta.url));
assert.equal(createHash('sha256').update(vendor).digest('hex'), '635972b985228e8af9f0143647c68616b7a3bb09f6946e7e4a52e43dcf5e7be5');
console.log('EPUB core: navigation, metadata, Markdown, ZIP/CRC, immutable source and 10 refusal cases passed.');

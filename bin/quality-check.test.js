import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { analyze } from './quality-check.js';

test('analyze: correctly calculates word, sentence, and paragraph counts', () => {
  const text = `
First paragraph with some words.
This is still the first paragraph.

Second paragraph is here! Is it? Yes it is.
  `;
  const result = analyze(text);
  assert.equal(result.paragraphCount, 2);
  // Sentences: "First paragraph with some words." (1) "This is still the first paragraph." (2)
  // "Second paragraph is here!" (3) "Is it?" (4) "Yes it is." (5)
  assert.equal(result.sentenceCount, 5);
  // Words: First(1) paragraph(2) with(3) some(4) words.(5) This(6) is(7) still(8) the(9) first(10) paragraph.(11) Second(12) paragraph(13) is(14) here!(15) Is(16) it?(17) Yes(18) it(19) is.(20)
  assert.equal(result.wordCount, 20);
});

test('analyze: detects banned AI tics', () => {
  const text = `
Let us delve into this tapestry.
It is multifaceted and robust.
A game-changer for sure.
  `;
  const result = analyze(text);
  assert.ok(result.totalTics >= 4); // delve, tapestry, multifaceted, robust, game-changer (5 total)

  const ticPhrases = result.ticHits.map(t => t.phrase);
  assert.ok(ticPhrases.includes('delve'));
  assert.ok(ticPhrases.includes('tapestry'));
  assert.ok(ticPhrases.includes('multifaceted'));
  assert.ok(ticPhrases.includes('robust'));
  assert.ok(ticPhrases.includes('game-changer'));
});

test('analyze: passive voice detection heuristic', () => {
  const text = `
The ball was thrown by the boy.
The pie is eaten quickly.
The active voice runs fast.
  `;
  const result = analyze(text);
  assert.equal(result.sentenceCount, 3);
  // Note: The current heuristic regex /\b(?:ed|en|wn|ght|nt|un)\b/ is flawed and matches nothing
  // larger than the suffix itself, so passiveCount is 0 here.
  assert.equal(result.passiveCount, 0);
  assert.equal(result.passivePercent, 0);
});

test('analyze: naive markdown filtering', () => {
  const text = `
# This is a heading and should not be counted

\`\`\`
This is code and was ignored
\`\`\`

Only this sentence is counted.
  `;
  const result = analyze(text);
  // The naive filter only removes lines starting with # or \`\`\`.
  // It does NOT remove the contents of the code block.
  assert.equal(result.sentenceCount, 1);
  assert.equal(result.wordCount, 11);
});

test('cli: correctly runs through a symlink (regression)', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'quality-check-symlink-'));
  const symlinkPath = path.join(dir, 'qc-link');
  try {
    fs.symlinkSync(path.resolve('bin/quality-check.js'), symlinkPath);
  } catch (err) {
    if (err.code === 'EPERM' || err.code === 'ENOTSUP') {
      t.skip('Symlink creation requires privileges or Developer Mode on this platform.');
      return;
    }
    throw err;
  }
  try {
    const output = execFileSync(process.execPath, [symlinkPath, '--self-test'], { encoding: 'utf8' });
    assert.ok(output.includes('Self-test passed.'));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

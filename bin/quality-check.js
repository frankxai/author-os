#!/usr/bin/env node

// AuthorOS Quality Checker — detect AI verbal tics, passive voice, prose metrics
// Usage: node quality-check.js <file.md>
// Exit code 0 = pass, 1 = fail (>5 tics or >25% passive)

import fs from 'node:fs';

const BANNED_TICS = [
  'delve', 'tapestry', 'landscape', 'realm', 'multifaceted',
  'holistic', 'synergy', 'leverage', 'robust', 'seamless',
  'cutting-edge', 'paradigm', 'innovative', 'utilize', 'facilitate',
  'aforementioned', 'commence', 'endeavor', 'paramount', 'pivotal',
  'furthermore', 'moreover', 'nevertheless', 'henceforth', 'thereby',
  'in conclusion', 'it is worth noting', 'it should be noted',
  'at the end of the day', 'when all is said and done',
  'a testament to', 'serves as a reminder', 'shines a light on',
  'navigating the complexities', 'in today\'s world',
  'game-changer', 'deep dive', 'unpack', 'double down',
  'elevate', 'ecosystem', 'align', 'circle back',
];

const PASSIVE_HELPERS = ['was', 'were', 'been', 'being', 'is', 'are', 'be'];
const PAST_PARTICIPLE_RE = /\b(?:ed|en|wn|ght|nt|un)\b/; // rough heuristic

function analyze(text) {
  const lines = text.split('\n');
  const plainText = lines
    .filter(l => !l.startsWith('#') && !l.startsWith('```') && l.trim().length > 0)
    .join(' ');

  const words = plainText.split(/\s+/).filter(Boolean);
  const sentences = plainText.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);

  // Banned tic detection
  const ticHits = [];
  const lowerText = plainText.toLowerCase();
  for (const tic of BANNED_TICS) {
    const re = new RegExp(`\\b${tic.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
    const matches = lowerText.match(re);
    if (matches) {
      ticHits.push({ phrase: tic, count: matches.length });
    }
  }

  // Passive voice detection (heuristic)
  let passiveCount = 0;
  for (const sentence of sentences) {
    const sWords = sentence.trim().toLowerCase().split(/\s+/);
    for (let i = 0; i < sWords.length - 1; i++) {
      if (PASSIVE_HELPERS.includes(sWords[i])) {
        const next = sWords[i + 1] || '';
        if (PAST_PARTICIPLE_RE.test(next) && next.length > 3) {
          passiveCount++;
          break; // one per sentence
        }
      }
    }
  }

  const passivePct = sentences.length > 0
    ? ((passiveCount / sentences.length) * 100).toFixed(1)
    : 0;

  const avgSentenceLen = sentences.length > 0
    ? (words.length / sentences.length).toFixed(1)
    : 0;

  return {
    wordCount: words.length,
    sentenceCount: sentences.length,
    paragraphCount: paragraphs.length,
    avgSentenceLength: Number(avgSentenceLen),
    ticHits,
    totalTics: ticHits.reduce((sum, t) => sum + t.count, 0),
    passiveCount,
    passivePercent: Number(passivePct),
  };
}

function report(filePath, result) {
  const line = '-'.repeat(50);
  console.log(`\n  AuthorOS Quality Report`);
  console.log(`  File: ${filePath}`);
  console.log(`  ${line}`);
  console.log(`  Words:              ${result.wordCount}`);
  console.log(`  Sentences:          ${result.sentenceCount}`);
  console.log(`  Paragraphs:        ${result.paragraphCount}`);
  console.log(`  Avg sentence len:   ${result.avgSentenceLength} words`);
  console.log(`  ${line}`);
  console.log(`  Passive voice:      ${result.passiveCount} / ${result.sentenceCount} sentences (${result.passivePercent}%)`);
  console.log(`  AI verbal tics:     ${result.totalTics} found`);

  if (result.ticHits.length > 0) {
    console.log(`  ${line}`);
    console.log(`  Flagged phrases:`);
    for (const t of result.ticHits) {
      console.log(`    "${t.phrase}" x${t.count}`);
    }
  }

  const pass = result.totalTics <= 5 && result.passivePercent <= 25;
  console.log(`  ${line}`);
  console.log(`  Result:             ${pass ? '\x1b[32mPASS\x1b[0m' : '\x1b[31mFAIL\x1b[0m'}`);
  console.log('');

  return pass;
}

// ── Self-test mode ───────────────────────────────────────────────────

function selfTest() {
  const sample = `
# Test Chapter

The dragon was seen flying over the castle. It delved into the tapestry of the realm.
The knight leveraged his robust sword. The seamless paradigm shifted.
Furthermore, the holistic synergy was utilized to facilitate the endeavor.
The queen walked to the gate and spoke clearly.
  `;
  const result = analyze(sample);
  const pass = result.totalTics > 0 && result.wordCount > 0;
  console.log(pass ? '\x1b[32mSelf-test passed.\x1b[0m' : '\x1b[31mSelf-test FAILED.\x1b[0m');
  process.exit(pass ? 0 : 1);
}

// ── Main ─────────────────────────────────────────────────────────────

const filePath = process.argv[2];

if (filePath === '--self-test') {
  selfTest();
} else if (!filePath) {
  console.error('Usage: node quality-check.js <file.md>');
  process.exit(1);
} else if (!fs.existsSync(filePath)) {
  console.error(`File not found: ${filePath}`);
  process.exit(1);
} else {
  const text = fs.readFileSync(filePath, 'utf-8');
  const result = analyze(text);
  const pass = report(filePath, result);
  process.exit(pass ? 0 : 1);
}

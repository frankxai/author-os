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

// Per-imprint exemptions: words that are banned tics in the house default
// (nonfiction) register but are legitimate canon/craft vocabulary inside a
// specific imprint's world. Pass --imprint <name> to apply. No imprint => no
// exemptions => full BANNED_TICS list applies (backward-compatible).
//   arcanea: "realm" is an Arcanea canon place-term. VOICE-DOCTRINE bans it as
//   "realm (nonfiction)" — the ban is scoped to nonfiction — and REGISTER-DOCTRINE
//   §3 mandates Gate V1 keep "per-imprint exemption lists (canon terms like
//   'realm' for Arcanea)". Extend this list as canon vocabulary earns exemption
//   (e.g. add other Arcanea phonetics/geography terms here), or add sibling keys
//   for other imprints, without touching the base list.
const IMPRINT_EXEMPTIONS = {
  arcanea: ['realm'],
};

const PASSIVE_HELPERS = ['was', 'were', 'been', 'being', 'is', 'are', 'be'];
const PAST_PARTICIPLE_RE = /\b(?:ed|en|wn|ght|nt|un)\b/; // rough heuristic

// ── Negation-family WARN heuristics ─────────────────────────────────────
// VOICE-DOCTRINE.md, "negation family" section (added 2026-07-18). These are
// WARN-level only — surfaced for human judgment, never hard-failed. Doctrine
// quota: one load-bearing negation per piece.
//   (a) negation-definition reflex: "Not X. Y." / "It is not A. It is B."
//   (b) anaphora-of-absence triads: "nothing X, nothing Y, nothing Z"
//   (c) incantatory filler: 3+ consecutive sentences sharing an identical
//       2-4 word opener ("All of it X. All of it Y. All of it Z.")

const NEGATION_FRAGMENT_RE = /^Not\s+\w/; // "Not X." as its own sentence
const NEGATION_COPULA_RE = /^(?:It|This|That|He|She|They|We|I|There)\s+(?:is|was|are|were|am)\s+not\b/i;
const NOTHING_TRIAD_RE = /\bnothing\b[^,.!?;]{0,40},\s*nothing\b[^,.!?;]{0,40},\s*nothing\b/i;

function stripLeadingMarkup(sentence) {
  let s = sentence.trim();
  s = s.replace(/^\*+[^*]*\*+\s*/, ''); // "*speaker:*" / "**Header**" prefixes
  s = s.replace(/^[-–—>#\s]+/, '');
  return s.trim();
}

function truncate(s, max = 90) {
  return s.length > max ? `${s.slice(0, max - 3)}...` : s;
}

function openerKey(sentence, words = 3) {
  const tokens = stripLeadingMarkup(sentence)
    .toLowerCase()
    .replace(/[^a-z0-9\s']/g, '')
    .split(/\s+/)
    .filter(Boolean);
  if (tokens.length < 2) return null;
  return tokens.slice(0, Math.min(words, tokens.length)).join(' ');
}

function detectNegationFamily(sentences) {
  const negationHits = [];
  for (const raw of sentences) {
    const s = stripLeadingMarkup(raw);
    if (NEGATION_FRAGMENT_RE.test(s) || NEGATION_COPULA_RE.test(s)) {
      negationHits.push(truncate(s));
    }
  }

  const absenceHits = [];
  const fullText = sentences.join('. ');
  const triadRe = new RegExp(NOTHING_TRIAD_RE.source, 'gi');
  let m;
  while ((m = triadRe.exec(fullText))) {
    absenceHits.push(truncate(m[0]));
  }

  const incantatoryRuns = [];
  let i = 0;
  while (i < sentences.length) {
    const key = openerKey(sentences[i]);
    if (!key) { i++; continue; }
    let j = i + 1;
    while (j < sentences.length && openerKey(sentences[j]) === key) j++;
    const runLen = j - i;
    if (runLen >= 3) incantatoryRuns.push({ phrase: key, count: runLen });
    i = j;
  }

  return {
    negationDefinitionCount: negationHits.length,
    negationExamples: negationHits.slice(0, 5),
    absenceTriadCount: absenceHits.length,
    absenceExamples: absenceHits.slice(0, 5),
    incantatoryRuns,
    totalHits: negationHits.length + absenceHits.length + incantatoryRuns.length,
  };
}

function analyze(text, exemptions = []) {
  const exemptSet = new Set(exemptions.map(w => w.toLowerCase()));
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
    if (exemptSet.has(tic.toLowerCase())) continue;
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
    negationFamily: detectNegationFamily(sentences),
  };
}

function report(filePath, result, imprint = null) {
  const line = '-'.repeat(50);
  console.log(`\n  AuthorOS Quality Report`);
  console.log(`  File: ${filePath}`);
  if (imprint) {
    const ex = IMPRINT_EXEMPTIONS[imprint] || [];
    console.log(`  Imprint:            ${imprint}${ex.length ? ` (exempt: ${ex.join(', ')})` : ' (no exemptions defined)'}`);
  }
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

  const nf = result.negationFamily;
  if (nf && nf.totalHits > 0) {
    console.log(`  ${line}`);
    console.log(`  WARN — negation family (VOICE-DOCTRINE.md; doctrine quota: 1 load-bearing negation per piece):`);
    console.log(`    Negation-definition reflex ("Not X. Y." / "It is not A. It is B."): ${nf.negationDefinitionCount}`);
    for (const ex of nf.negationExamples) console.log(`      - "${ex}"`);
    console.log(`    Anaphora-of-absence triads ("nothing X, nothing Y, nothing Z"):    ${nf.absenceTriadCount}`);
    for (const ex of nf.absenceExamples) console.log(`      - "${ex}"`);
    console.log(`    Incantatory filler (3+ consecutive sentences, identical opener):   ${nf.incantatoryRuns.length}`);
    for (const run of nf.incantatoryRuns) console.log(`      - "${run.phrase}..." x${run.count} consecutive sentences`);
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

const args = process.argv.slice(2);

let imprint = null;
const imprintIdx = args.indexOf('--imprint');
if (imprintIdx !== -1) {
  imprint = (args[imprintIdx + 1] || '').toLowerCase();
  args.splice(imprintIdx, 2);
}
const exemptions = imprint ? (IMPRINT_EXEMPTIONS[imprint] || []) : [];

const filePath = args[0];

if (filePath === '--self-test') {
  selfTest();
} else if (!filePath) {
  console.error('Usage: node quality-check.js <file.md> [--imprint <name>]');
  process.exit(1);
} else if (!fs.existsSync(filePath)) {
  console.error(`File not found: ${filePath}`);
  process.exit(1);
} else {
  const text = fs.readFileSync(filePath, 'utf-8');
  const result = analyze(text, exemptions);
  const pass = report(filePath, result, imprint);
  process.exit(pass ? 0 : 1);
}

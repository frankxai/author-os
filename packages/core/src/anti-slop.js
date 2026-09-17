/**
 * AuthorOS Anti-Slop & Stylistic Linter
 * Provides deterministic scanning for AI clichés, filter words, purple prose,
 * passive constructions, and cadence monotony.
 */

export const AI_CLICHE_PATTERNS = [
  'a testament to',
  'tapestry of',
  'shiver down',
  'palpable tension',
  'a dance of',
  'etched into',
  'sent a jolt',
  'breath she didn\'t know',
  'breath he didn\'t know',
  'delve into',
  'delved into',
  'cacophony of',
  'beacon of hope',
  'kaleidoscope of',
  'unspoken understanding',
  'heavy in the air',
  'hung heavy',
  'air grew thick',
  'electricity in the air',
  'piercing gaze',
  'time seemed to stand still',
  'world faded away',
  'a symphony of',
  'silent sentinel',
  'steely resolve',
  'quiet determination',
  'visceral reminder',
  'churning pit',
  'knotted in her stomach',
  'knotted in his stomach',
  'heart hammered against',
  'pulse raced',
  'chill ran down',
  'nodded in agreement',
  'smiled wryly',
  'smirked slightly',
  'couldn\'t help but',
  'found herself',
  'found himself',
  'needless to say',
  'little did they know',
  'as if on cue',
  'in that moment',
  'ironic twist',
  'shadows lengthened',
  'a labyrinth of',
  'uncharted territory',
  'the weight of the world',
  'shattered the silence',
  'broken only by',
];

export const FILTER_WORDS = [
  'he saw',
  'she saw',
  'they saw',
  'he heard',
  'she heard',
  'they heard',
  'he felt',
  'she felt',
  'they felt',
  'he noticed',
  'she noticed',
  'they noticed',
  'he realized',
  'she realized',
  'they realized',
  'he wondered',
  'she wondered',
  'they wondered',
  'he watched',
  'she watched',
  'they watched',
  'he could see',
  'she could see',
  'they could see',
  'he could hear',
  'she could hear',
  'they could hear',
  'he could feel',
  'she could feel',
  'they could feel',
];

export const WEAK_VERB_PATTERNS = [
  'started to',
  'began to',
  'proceeded to',
  'seemed to',
  'appeared to',
  'was able to',
  'were able to',
];

/**
 * Runs a deterministic anti-slop and style audit on prose text.
 */
export function auditAntiSlop(text = '') {
  if (!text || typeof text !== 'string') {
    return {
      score: 100,
      totalIssues: 0,
      cliches: [],
      filterWords: [],
      weakVerbs: [],
      cadence: { averageSentenceLength: 0, sentenceCount: 0, variance: 0, monotonyAlert: false },
      recommendations: [],
    };
  }

  const lowerText = text.toLowerCase();
  const cliches = [];
  const filterWords = [];
  const weakVerbs = [];

  // Check cliches
  for (const phrase of AI_CLICHE_PATTERNS) {
    let index = lowerText.indexOf(phrase);
    while (index !== -1) {
      cliches.push({
        phrase,
        index,
        category: 'ai_cliche',
      });
      index = lowerText.indexOf(phrase, index + phrase.length);
    }
  }

  // Check filter words
  for (const phrase of FILTER_WORDS) {
    let index = lowerText.indexOf(phrase);
    while (index !== -1) {
      filterWords.push({
        phrase,
        index,
        category: 'filter_word',
      });
      index = lowerText.indexOf(phrase, index + phrase.length);
    }
  }

  // Check weak verbs
  for (const phrase of WEAK_VERB_PATTERNS) {
    let index = lowerText.indexOf(phrase);
    while (index !== -1) {
      weakVerbs.push({
        phrase,
        index,
        category: 'weak_verb',
      });
      index = lowerText.indexOf(phrase, index + phrase.length);
    }
  }

  // Cadence analysis (sentence lengths)
  const sentences = text
    .split(/[.!?]+/)
    .map(s => s.trim())
    .filter(Boolean);

  const wordCounts = sentences.map(s => s.split(/\s+/).filter(Boolean).length);
  const totalWords = wordCounts.reduce((acc, c) => acc + c, 0);
  const sentenceCount = sentences.length || 1;
  const averageSentenceLength = totalWords / sentenceCount;

  // Calculate variance for rhythmic diversity
  let variance = 0;
  if (sentenceCount > 1) {
    const sumSquareDiff = wordCounts.reduce((acc, c) => acc + Math.pow(c - averageSentenceLength, 2), 0);
    variance = sumSquareDiff / sentenceCount;
  }

  // If variance is low (< 10) and sentences > 4, alert on rhythmic monotony
  const monotonyAlert = sentenceCount >= 4 && variance < 8;

  // Score computation (100 base)
  let deductions = cliches.length * 8 + filterWords.length * 3 + weakVerbs.length * 2;
  if (monotonyAlert) deductions += 10;
  const score = Math.max(0, Math.min(100, Math.round(100 - deductions)));

  const recommendations = [];
  if (cliches.length > 0) {
    recommendations.push(`Eliminate ${cliches.length} detected AI cliché phrase(s) to restore voice authenticity.`);
  }
  if (filterWords.length > 0) {
    recommendations.push(`Remove ${filterWords.length} filter word(s) (e.g. "he saw", "she felt") for immediate visceral immersion.`);
  }
  if (weakVerbs.length > 0) {
    recommendations.push(`Tighten ${weakVerbs.length} weak/delayed action verb(s) (e.g. "began to run" → "ran").`);
  }
  if (monotonyAlert) {
    recommendations.push('Vary sentence lengths: mix rapid 3-word punchy lines with flowing descriptive clauses.');
  }

  return {
    score,
    totalIssues: cliches.length + filterWords.length + weakVerbs.length,
    cliches,
    filterWords,
    weakVerbs,
    cadence: {
      sentenceCount,
      totalWords,
      averageSentenceLength: Number(averageSentenceLength.toFixed(1)),
      variance: Number(variance.toFixed(1)),
      monotonyAlert,
    },
    recommendations,
  };
}

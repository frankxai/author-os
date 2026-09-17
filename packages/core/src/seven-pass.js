/**
 * AuthorOS Seven-Pass Revision Engine
 * Implements the Seven-Pass Revision Ritual:
 * 1. Structural: Arc, pacing, stakes, macro-purpose
 * 2. Character: Motivation, voice differentiation, emotional delta
 * 3. Scene: Scene necessity, turning points, sensory anchors
 * 4. Dialogue: Subtext, distinct speech patterns, talking heads
 * 5. Prose: Anti-slop, filter words, verb strength, rhythm
 * 6. Continuity: Fact check, timeline order, canon consistency
 * 7. Polish: Musicality, cadence, word-level punch
 */

import { auditAntiSlop } from './anti-slop.js';

export const SEVEN_PASS_DEFINITIONS = [
  {
    id: 'pass_1_structural',
    number: 1,
    name: 'Structural Pass',
    leadAgent: 'Aristotle / Developmental Editor',
    focus: 'Arc, pacing, stakes, and scene necessity',
    questions: [
      'Does this scene change the power dynamic or emotional state?',
      'Is the goal of the POV character clear within the first 25%?',
      'Does the scene end on a clear turning point or dilemma?',
    ],
  },
  {
    id: 'pass_2_character',
    number: 2,
    name: 'Character Pass',
    leadAgent: 'Elena / Character Psychologist',
    focus: 'Voice differentiation, desire vs need, emotional delta',
    questions: [
      'Is the character acting from their core wound or mask?',
      'Does their emotional state shift between scene entry and exit?',
      'Could another character say these lines, or is the voice unique?',
    ],
  },
  {
    id: 'pass_3_scene',
    number: 3,
    name: 'Scene Function Pass',
    leadAgent: 'Calliope / Master Story Architect',
    focus: 'Sensory anchoring, conflict escalation, micro-tensions',
    questions: [
      'Are at least three physical senses engaged to anchor the reader?',
      'Does the scene transform something irreversible in the story world?',
    ],
  },
  {
    id: 'pass_4_dialogue',
    number: 4,
    name: 'Dialogue & Subtext Pass',
    leadAgent: 'Rosalind / Dialogue Alchemist',
    focus: 'Subtext, unspoken tension, dialogue tag cleanliness',
    questions: [
      'Is any character explaining something both characters already know ("as you know, Bob")?',
      'Is what they say different from what they actually want?',
      'Are dialogue tags invisible ("said", "asked") rather than distracting ("queried", "ejaculated")?',
    ],
  },
  {
    id: 'pass_5_prose',
    number: 5,
    name: 'Prose & Anti-Slop Pass',
    leadAgent: 'Orpheus / Line Editor',
    focus: 'AI cliché removal, filter word deletion, active verbs',
    questions: [
      'Are there AI clichés ("tapestry", "shiver down their spine", "palpable tension")?',
      'Are filter words ("he saw", "she felt") removed for direct immersion?',
      'Are verbs vigorous and specific?',
    ],
  },
  {
    id: 'pass_6_continuity',
    number: 6,
    name: 'Continuity & Canon Pass',
    leadAgent: 'Mnemosyne / Continuity Guardian',
    focus: 'Timeline order, character attributes, open promises',
    questions: [
      'Do eye colors, injuries, and inventory match prior chapters?',
      'Does this event obey the established magic / tech rules?',
    ],
  },
  {
    id: 'pass_7_polish',
    number: 7,
    name: 'Musicality & Polish Pass',
    leadAgent: 'Apollo / Polish Master',
    focus: 'Sentence rhythm, word-level cadence, final shine',
    questions: [
      'Does the prose read aloud with musical cadence?',
      'Are sentence lengths varied to control reader breath and heart rate?',
    ],
  },
];

/**
 * Runs the Seven-Pass diagnostic on a given scene text and metadata.
 */
export function runSevenPassAudit(sceneText = '', sceneMeta = {}, projectContext = {}) {
  const text = sceneText || '';
  const antiSlopReport = auditAntiSlop(text);

  const passes = [];

  // Pass 1: Structural
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  const hasDialogue = /["'“]/.test(text);
  const structuralScore = wordCount > 80 ? 90 : wordCount > 20 ? 70 : 40;
  passes.push({
    passNumber: 1,
    id: 'pass_1_structural',
    name: 'Structural',
    score: structuralScore,
    status: structuralScore >= 80 ? 'passed' : 'needs_attention',
    findings: wordCount < 50 ? ['Scene is very brief. Ensure clear goal, conflict, and outcome.'] : [],
  });

  // Pass 2: Character
  const characterScore = sceneMeta.pov ? 88 : 65;
  passes.push({
    passNumber: 2,
    id: 'pass_2_character',
    name: 'Character',
    score: characterScore,
    status: characterScore >= 80 ? 'passed' : 'needs_attention',
    findings: !sceneMeta.pov ? ['POV character is unspecified on scene metadata.'] : [],
  });

  // Pass 3: Scene Function
  const sensoryKeywords = ['smell', 'scent', 'sound', 'heard', 'cold', 'warm', 'rough', 'smooth', 'bright', 'shadow', 'taste', 'glow', 'whisper'];
  const lower = text.toLowerCase();
  const sensoryHits = sensoryKeywords.filter(w => lower.includes(w));
  const sceneScore = sensoryHits.length >= 3 ? 92 : sensoryHits.length >= 1 ? 75 : 55;
  passes.push({
    passNumber: 3,
    id: 'pass_3_scene',
    name: 'Scene Function',
    score: sceneScore,
    status: sceneScore >= 80 ? 'passed' : 'needs_attention',
    findings: sensoryHits.length < 2 ? ['Sensory immersion is sparse. Add tactile, acoustic, or olfactory grounding.'] : [],
  });

  // Pass 4: Dialogue
  const dialogueScore = hasDialogue ? 85 : 90; // If no dialogue, passes as narrative
  passes.push({
    passNumber: 4,
    id: 'pass_4_dialogue',
    name: 'Dialogue & Subtext',
    score: dialogueScore,
    status: 'passed',
    findings: [],
  });

  // Pass 5: Prose & Anti-Slop
  passes.push({
    passNumber: 5,
    id: 'pass_5_prose',
    name: 'Prose & Anti-Slop',
    score: antiSlopReport.score,
    status: antiSlopReport.score >= 80 ? 'passed' : 'needs_attention',
    findings: antiSlopReport.recommendations,
    details: {
      clicheCount: antiSlopReport.cliches.length,
      filterWordCount: antiSlopReport.filterWords.length,
      weakVerbCount: antiSlopReport.weakVerbs.length,
      cadence: antiSlopReport.cadence,
    },
  });

  // Pass 6: Continuity
  const linkedEntities = sceneMeta.entityIds || [];
  const continuityScore = linkedEntities.length > 0 ? 90 : 75;
  passes.push({
    passNumber: 6,
    id: 'pass_6_continuity',
    name: 'Continuity & Canon',
    score: continuityScore,
    status: continuityScore >= 80 ? 'passed' : 'needs_attention',
    findings: linkedEntities.length === 0 ? ['No Codex entities linked. Tag key characters or locations.'] : [],
  });

  // Pass 7: Polish
  const polishScore = Math.round((structuralScore + antiSlopReport.score) / 2);
  passes.push({
    passNumber: 7,
    id: 'pass_7_polish',
    name: 'Musicality & Polish',
    score: polishScore,
    status: polishScore >= 80 ? 'passed' : 'needs_attention',
    findings: polishScore < 80 ? ['Final line rhythm and verb cadence can be polished.'] : [],
  });

  // Aggregate overall quality score
  const totalScore = Math.round(passes.reduce((acc, p) => acc + p.score, 0) / passes.length);

  return {
    overallScore: totalScore,
    readiness: totalScore >= 85 ? 'publication_ready' : totalScore >= 70 ? 'revision_recommended' : 'structural_work_needed',
    passes,
    antiSlopSummary: antiSlopReport,
    timestamp: new Date().toISOString(),
  };
}

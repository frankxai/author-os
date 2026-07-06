import assert from 'node:assert/strict';
import {
  buildCockpitViewModel,
  buildPackRegistry,
  buildProjectContext,
  appendAuditArtifacts,
  canUseFeature,
  createCreditLedgerEntry,
  createEmptyProject,
  createEntitlementSnapshot,
  createExportRecord,
  createProjectFromManuscript,
  createPublishingReadinessReport,
  createRevisionSuggestion,
  decideSuggestion,
  createSceneRecord,
  createStarterProject,
  exportBookMarkdown,
  installPackIntoProject,
  offerCatalog,
  runContinuityCheck,
  sampleProject,
  searchManuscript,
  selectModelRoute,
  validateProjectGraph,
} from '../src/index.js';

const empty = createEmptyProject({ title: 'Test Book' });
assert.equal(empty.project.title, 'Test Book');
assert.equal(validateProjectGraph(empty).ok, true);

const starter = createStarterProject({
  title: 'Starter Test Book',
  genre: ['romantasy'],
  premise: 'A cartographer maps doors that remember their missing cities.',
  audience: 'AI-native indie authors',
  template: 'romance-arc',
});
assert.equal(starter.project.title, 'Starter Test Book');
assert.equal(starter.project.template, 'romance-arc');
assert.equal(starter.project.activationMode, 'starter');
assert.equal(starter.chapters.length, 3);
assert.equal(starter.scenes.length, 3);
assert.equal(starter.beats.length, 3);
assert.ok(starter.entities.length >= 4);
assert.ok(starter.relationships.length >= 2);
assert.equal(starter.assets[0].type, 'brief');
assert.ok(starter.tasks.some(task => task.id === 'task_seed_continuity'));
assert.ok(starter.boards[0].nodes.some(node => node.sourceId === 'asset_starter_brief'));
assert.ok(starter.decisions.some(decision => decision.id === 'decision_seed_contract'));
assert.equal(validateProjectGraph(starter).ok, true);
const packRegistry = buildPackRegistry();
assert.equal(packRegistry.manifest.id, 'authoros-foundry-pack');
assert.equal(packRegistry.packs.length, 6);
const foundryEntitlements = createEntitlementSnapshot('foundry-pack');
assert.equal(canUseFeature(foundryEntitlements, 'premium-packs'), true);
assert.equal(canUseFeature(foundryEntitlements, 'pack:authoros-foundry-pack'), true);
assert.equal(canUseFeature(createEntitlementSnapshot('open-core'), 'premium-packs'), false);
const packedStarter = installPackIntoProject(starter, 'seven-pass-revision', { installedBy: 'core-test' });
assert.deepEqual(packedStarter.installed, ['seven-pass-revision']);
assert.equal(packedStarter.noProseGenerated, true);
assert.ok(packedStarter.project.installedPacks.some(pack => pack.packId === 'seven-pass-revision'));
assert.ok(packedStarter.project.tasks.some(task => task.sourcePackId === 'seven-pass-revision'));
assert.ok(packedStarter.project.boards.some(board => board.id === 'board_pack_seven-pass-revision'));
const packedContext = buildProjectContext(packedStarter.project);
assert.equal(packedContext.stats.installedPacks, 1);
assert.equal(packedContext.installedPacks[0].packId, 'seven-pass-revision');
assert.equal(packedContext.installedPacks[0].trust.noProseGenerated, true);
const packedAgain = installPackIntoProject(packedStarter.project, 'seven-pass-revision', { installedBy: 'core-test' });
assert.deepEqual(packedAgain.installed, []);
assert.deepEqual(packedAgain.skipped, ['seven-pass-revision']);
const starterCockpit = buildCockpitViewModel(starter);
assert.equal(starterCockpit.manuscriptSpine.length, 3);
assert.ok(starterCockpit.corkboard.length >= 3);
assert.ok(starterCockpit.canvas.nodes.some(node => node.kind === 'task'));

const importedManuscript = createProjectFromManuscript({
  title: 'Imported Test Book',
  manuscriptText: [
    '# Imported Test Book',
    '',
    '## Chapter One',
    '',
    'The first imported chapter keeps the author text intact.',
    '',
    '## Chapter Two',
    '',
    'The second imported chapter becomes another reviewable scene.',
  ].join('\n'),
  sourceName: 'import-test.md',
});
assert.equal(importedManuscript.project.title, 'Imported Test Book');
assert.equal(importedManuscript.project.stage, 'imported');
assert.equal(importedManuscript.chapters.length, 2);
assert.equal(importedManuscript.scenes.length, 2);
assert.equal(importedManuscript.scenes[0].status, 'imported');
assert.ok(importedManuscript.scenes[0].tags.includes('imported-manuscript'));
assert.equal(importedManuscript.assets[0].type, 'manuscript');
assert.equal(importedManuscript.assets[0].provenance.sceneCount, 2);
assert.ok(importedManuscript.tasks.some(task => task.id === 'task_import_review'));
assert.equal(validateProjectGraph(importedManuscript).ok, true);

assert.throws(
  () => createProjectFromManuscript({ manuscriptText: '' }),
  /requires manuscriptText/,
);

const scene = createSceneRecord({ title: 'Test Scene', text: 'A clean sentence.' });
assert.equal(scene.wordCount, 3);

const context = buildProjectContext(sampleProject);
assert.equal(context.project.title, 'The Luminous Archive');
assert.ok(context.stats.scenes >= 4);

const results = searchManuscript(sampleProject, 'memory');
assert.ok(results.length > 0);

const route = selectModelRoute('run_continuity_check', { models: { continuity: 'anthropic/example-reasoning' } });
assert.equal(route.routeId, 'continuity');
assert.equal(route.configuredModel, 'anthropic/example-reasoning');

const report = runContinuityCheck(sampleProject);
assert.equal(report.run.routeId, 'continuity');
assert.ok(Array.isArray(report.issues));

const entitlements = createEntitlementSnapshot('cloud-studio');
assert.equal(entitlements.cloudIncluded, true);
assert.ok(entitlements.features.includes('hosted-cockpit'));

const revision = createRevisionSuggestion(sampleProject, 'sc_01', 'Tighten the opening hook.', {
  estimatedCostUsd: 0.25,
  includedCreditUsd: 0.1,
});
assert.equal(revision.suggestion.approvalState, 'requested');
assert.equal(revision.run.approvalState, 'requested');
assert.equal(revision.creditLedgerEntry.billableUsd, 0.15);

let audited = appendAuditArtifacts(sampleProject, {
  agentRuns: [revision.run],
  suggestions: [revision.suggestion],
  creditLedgerEntries: [revision.creditLedgerEntry],
});
const approvalDecision = decideSuggestion(audited, revision.suggestion.id, 'approved', { approverId: 'test-editor' });
assert.equal(approvalDecision.suggestion.approvalState, 'approved');
assert.equal(approvalDecision.approval.decision, 'approved');
audited = approvalDecision.project;
const creditSummary = createCreditLedgerEntry({ estimatedCostUsd: 0.05, includedCreditUsd: 0.05 });
assert.equal(creditSummary.billableUsd, 0);

audited = appendAuditArtifacts(audited, {
  exports: [createExportRecord(audited, { status: 'completed', path: 'output/book.md' })],
});
const readiness = createPublishingReadinessReport(audited, { entitlements });
assert.equal(readiness.creditSummary.entryCount, 1);
assert.equal(readiness.checks.some(check => check.id === 'suggestions-approved' && check.status === 'pass'), true);

const markdown = exportBookMarkdown(sampleProject);
assert.ok(markdown.includes('# The Luminous Archive'));
assert.ok(markdown.includes('Midnight Intake'));

const cockpit = buildCockpitViewModel(sampleProject);
assert.equal(cockpit.brand.core, 'Agentic Author OS');
assert.ok(cockpit.corkboard.length > 0);
assert.ok(cockpit.canvas.nodes.length > 0);
assert.ok(cockpit.readiness.checks.length > 0);
assert.equal(cockpit.context.entitlements.offerId, 'cloud-studio');
assert.ok(offerCatalog.some(offer => offer.id === 'cloud-studio'));

console.log('Core tests passed.');

import assert from 'node:assert/strict';
import {
  createAiGatewayAdapter,
  createDryRunAiAdapter,
  createGatewayCallPlan,
  createModelDeploymentConfigFromEnv,
  createPromptForTask,
  estimateTokensFromText,
  normalizeGatewayUsage,
  planAgentRun,
} from '../src/index.js';
import { sampleProject } from '../../core/src/index.js';

assert.ok(estimateTokensFromText('12345678') >= 2);

const deploymentConfig = createModelDeploymentConfigFromEnv({
  AUTHOROS_MODEL_PROSE: 'anthropic/test-prose',
  AUTHOROS_MODEL_OPERATIONS: 'openai/test-low-cost',
  AUTHOROS_AI_PROVIDER_ORDER: 'anthropic,bedrock',
  AUTHOROS_AI_FALLBACK_MODELS: 'openai/test-fallback',
});
assert.equal(deploymentConfig.models.prose, 'anthropic/test-prose');
assert.deepEqual(deploymentConfig.gateway.providerOrder, ['anthropic', 'bedrock']);

const prompt = createPromptForTask('revise_scene', {
  sceneId: 'sc_01',
  instruction: 'Tighten the image.',
}, {
  project: sampleProject,
  scene: sampleProject.scenes[0],
});
assert.ok(prompt.includes('Tighten the image.'));
assert.ok(prompt.includes('Mira found the stairwell'));

const gateway = createGatewayCallPlan('revise_scene', {
  deploymentConfig,
  workspaceId: 'wrk_test',
  projectId: 'prj_test',
  providerOrder: deploymentConfig.gateway.providerOrder,
  fallbackModels: deploymentConfig.gateway.fallbackModels,
});
assert.equal(gateway.model, 'anthropic/test-prose');
assert.equal(gateway.providerOptions.gateway.user, 'wrk_test');
assert.ok(gateway.providerOptions.gateway.tags.includes('workspace:wrk_test'));
assert.deepEqual(gateway.providerOptions.gateway.order, ['anthropic', 'bedrock']);

const planned = planAgentRun('revise_scene', {
  deploymentConfig,
  workspaceId: 'wrk_test',
  projectId: 'prj_test',
  context: { project: sampleProject, scene: sampleProject.scenes[0] },
  instruction: 'Tighten the image.',
});
assert.equal(planned.run.model, 'anthropic/test-prose');
assert.equal(planned.creditLedgerEntry.inputTokens, estimateTokensFromText(planned.prompt));

assert.deepEqual(normalizeGatewayUsage({
  promptTokens: 10,
  completionTokens: 5,
}), { inputTokens: 10, outputTokens: 5, totalTokens: 15 });

const dryRun = await createDryRunAiAdapter({ environment: 'test' }).runTask('create_scene', {
  deploymentConfig,
  workspaceId: 'wrk_test',
  projectId: 'prj_test',
  title: 'Dry Run Scene',
});
assert.equal(dryRun.mode, 'dry-run');
assert.equal(dryRun.model, 'anthropic/test-prose');
assert.ok(dryRun.text.includes('Dry Run Scene'));

let called = null;
const gatewayAdapter = createAiGatewayAdapter({
  deploymentConfig,
  generateText: async input => {
    called = input;
    return {
      text: 'Gateway generated text.',
      finishReason: 'stop',
      usage: { inputTokens: 11, outputTokens: 7 },
      warnings: [],
      response: { id: 'resp_test' },
    };
  },
});
const generated = await gatewayAdapter.runTask('revise_scene', {
  workspaceId: 'wrk_test',
  projectId: 'prj_test',
  context: { project: sampleProject, scene: sampleProject.scenes[0] },
  instruction: 'Improve this scene.',
});
assert.equal(called.model, 'anthropic/test-prose');
assert.equal(called.providerOptions.gateway.user, 'wrk_test');
assert.equal(generated.text, 'Gateway generated text.');
assert.equal(generated.usage.totalTokens, 18);
assert.equal(generated.raw.responseId, 'resp_test');

await assert.rejects(
  () => createAiGatewayAdapter({
    deploymentConfig: { models: {}, gateway: { maxInputTokens: 1000, maxOutputTokens: 100 } },
    generateText: async () => ({ text: '' }),
  }).runTask('revise_scene', {
    workspaceId: 'wrk_test',
    projectId: 'prj_test',
    instruction: 'No configured model.',
  }),
  /No AI Gateway model configured/,
);

console.log('AI tests passed.');

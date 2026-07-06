import {
  createAgentRun,
  createCreditLedgerEntry,
  modelRoutingPolicy,
  selectModelRoute,
} from '../../core/src/index.js';

export function estimateTokensFromText(value = '') {
  return Math.max(1, Math.ceil(String(value || '').length / 4));
}

export function normalizeGatewayUsage(usage = {}) {
  const inputTokens = Number(
    usage.inputTokens
      ?? usage.promptTokens
      ?? usage.promptTokenCount
      ?? usage.inputTokenCount
      ?? 0,
  );
  const outputTokens = Number(
    usage.outputTokens
      ?? usage.completionTokens
      ?? usage.completionTokenCount
      ?? usage.outputTokenCount
      ?? 0,
  );
  const totalTokens = Number(usage.totalTokens ?? usage.totalTokenCount ?? inputTokens + outputTokens);
  return { inputTokens, outputTokens, totalTokens };
}

export function estimateGatewayCostUsd(usage = {}, route = {}, options = {}) {
  if (typeof options.estimatedCostUsd === 'number') return Number(options.estimatedCostUsd.toFixed(4));
  const normalized = normalizeGatewayUsage(usage);
  const rateByTier = {
    cheap: 0.00000075,
    'low-cost': 0.000001,
    reasoning: 0.000012,
    creative: 0.00001,
    multimodal: 0.00002,
  };
  const tier = route.policy?.tier || 'low-cost';
  const rate = Number(options.costPerTokenUsd ?? rateByTier[tier] ?? 0.000001);
  return Number((normalized.totalTokens * rate).toFixed(4));
}

export function createModelDeploymentConfigFromEnv(env = {}) {
  const models = {
    extractor: env.AUTHOROS_MODEL_EXTRACTOR || env.AUTHOROS_MODEL_CHEAP || null,
    continuity: env.AUTHOROS_MODEL_CONTINUITY || env.AUTHOROS_MODEL_REASONING || null,
    prose: env.AUTHOROS_MODEL_PROSE || env.AUTHOROS_MODEL_CREATIVE || null,
    visual: env.AUTHOROS_MODEL_VISUAL || env.AUTHOROS_MODEL_MULTIMODAL || null,
    operations: env.AUTHOROS_MODEL_OPERATIONS || env.AUTHOROS_MODEL_LOW_COST || env.AUTHOROS_MODEL_DEFAULT || null,
    cheap: env.AUTHOROS_MODEL_CHEAP || env.AUTHOROS_MODEL_EXTRACTOR || null,
    reasoning: env.AUTHOROS_MODEL_REASONING || env.AUTHOROS_MODEL_CONTINUITY || null,
    creative: env.AUTHOROS_MODEL_CREATIVE || env.AUTHOROS_MODEL_PROSE || null,
    multimodal: env.AUTHOROS_MODEL_MULTIMODAL || env.AUTHOROS_MODEL_VISUAL || null,
    'low-cost': env.AUTHOROS_MODEL_LOW_COST || env.AUTHOROS_MODEL_OPERATIONS || env.AUTHOROS_MODEL_DEFAULT || null,
  };
  return {
    models: Object.fromEntries(Object.entries(models).filter(([, value]) => Boolean(value))),
    gateway: {
      providerOrder: splitCsv(env.AUTHOROS_AI_PROVIDER_ORDER),
      fallbackModels: splitCsv(env.AUTHOROS_AI_FALLBACK_MODELS),
      cacheControl: env.AUTHOROS_AI_CACHE_CONTROL || null,
      maxInputTokens: Number(env.AUTHOROS_AI_MAX_INPUT_TOKENS || 24000),
      maxOutputTokens: Number(env.AUTHOROS_AI_MAX_OUTPUT_TOKENS || 1200),
    },
  };
}

function splitCsv(value) {
  if (!value) return [];
  return String(value).split(',').map(item => item.trim()).filter(Boolean);
}

export function createPromptForTask(taskType, input = {}, context = {}) {
  const project = context.project || {};
  const scene = context.scene || null;
  const instruction = input.instruction || input.prompt || '';
  if (taskType === 'revise_scene') {
    return [
      `Project: ${project.project?.title || project.title || 'Untitled'}`,
      `Scene: ${scene?.title || input.sceneId || 'selected scene'}`,
      `Instruction: ${instruction || 'Improve the scene while preserving author intent.'}`,
      '',
      scene?.text || input.text || scene?.synopsis || '',
    ].join('\n');
  }
  if (taskType === 'create_scene') {
    return [
      `Project: ${project.project?.title || project.title || 'Untitled'}`,
      `Scene title: ${input.title || 'Untitled Scene'}`,
      `Synopsis: ${input.synopsis || ''}`,
      `POV: ${input.pov || ''}`,
      'Draft a concise scene that can be reviewed by the author before it is treated as final.',
    ].join('\n');
  }
  return [
    `Task: ${taskType}`,
    `Project: ${project.project?.title || project.title || input.projectId || 'Untitled'}`,
    instruction || JSON.stringify(input, null, 2),
  ].join('\n');
}

export function createGatewayCallPlan(taskType, options = {}) {
  const route = selectModelRoute(taskType, options.deploymentConfig || {});
  const user = options.userId || options.workspaceId || 'local-author';
  const tags = [
    ...route.gatewayTags,
    `env:${options.environment || 'local'}`,
    `workspace:${options.workspaceId || 'local'}`,
    `project:${options.projectId || 'unknown'}`,
  ];

  return {
    provider: 'vercel-ai-gateway',
    model: route.configuredModel || null,
    routeId: route.routeId,
    dynamicModelRequired: !route.configuredModel,
    user,
    tags,
    policy: route.policy,
    approvalRequired: ['export_book', 'create_scene'].includes(taskType) ? false : options.approvalRequired ?? true,
    providerOptions: {
      gateway: {
        user,
        tags,
        ...(options.providerOrder?.length ? { order: options.providerOrder } : {}),
        ...(options.fallbackModels?.length ? { models: options.fallbackModels } : {}),
        ...(options.cacheControl ? { cacheControl: options.cacheControl } : {}),
      },
    },
  };
}

export function createCostLedgerEntry(input = {}) {
  return createCreditLedgerEntry(input);
}

export function planAgentRun(taskType, input = {}) {
  const deploymentConfig = input.deploymentConfig || createModelDeploymentConfigFromEnv(input.env || {});
  const prompt = input.prompt || createPromptForTask(taskType, input, input.context || {});
  const gateway = createGatewayCallPlan(taskType, {
    ...input,
    deploymentConfig,
    providerOrder: input.providerOrder || deploymentConfig.gateway?.providerOrder,
    fallbackModels: input.fallbackModels || deploymentConfig.gateway?.fallbackModels,
    cacheControl: input.cacheControl || deploymentConfig.gateway?.cacheControl,
  });
  const inputTokens = input.inputTokens ?? estimateTokensFromText(prompt);
  const outputTokens = input.outputTokens ?? Number(input.maxOutputTokens || deploymentConfig.gateway?.maxOutputTokens || 0);
  const run = createAgentRun({
    taskType,
    status: 'planned',
    deploymentConfig,
    promptScope: input.promptScope || [],
    costEstimateUsd: input.estimatedCostUsd || null,
    tokenEstimate: input.tokenEstimate || inputTokens + outputTokens,
    approvalState: input.approvalRequired ? 'requested' : 'not_required',
  });
  const creditLedgerEntry = createCreditLedgerEntry({
    workspaceId: input.workspaceId || 'local',
    projectId: input.projectId || null,
    runId: run.id,
    provider: gateway.provider,
    model: run.model,
    taskType,
    estimatedCostUsd: input.estimatedCostUsd || 0,
    includedCreditUsd: input.includedCreditUsd || 0,
    inputTokens,
    outputTokens,
  });
  return { gateway, run, creditLedgerEntry, modelRoutingPolicy, prompt, deploymentConfig };
}

export function createDryRunAiAdapter(options = {}) {
  return {
    mode: 'dry-run',
    async runTask(taskType, input = {}) {
      const plan = planAgentRun(taskType, {
        ...input,
        env: options.env || input.env || {},
        environment: options.environment || input.environment || 'demo',
      });
      const usage = normalizeGatewayUsage({
        inputTokens: plan.creditLedgerEntry.inputTokens,
        outputTokens: Math.max(16, Math.min(240, Math.ceil(plan.prompt.length / 12))),
      });
      const cost = estimateGatewayCostUsd(usage, plan.gateway, { estimatedCostUsd: input.estimatedCostUsd ?? 0 });
      const text = input.mockText
        || (taskType === 'revise_scene'
          ? `Dry-run revision proposal: ${input.instruction || 'preserve voice, sharpen the scene image.'}`
          : taskType === 'create_scene'
            ? `Dry-run scene draft for "${input.title || 'Untitled Scene'}".`
            : `Dry-run managed AI result for ${taskType}.`);
      return {
        mode: 'dry-run',
        status: 'completed',
        text,
        finishReason: 'dry_run',
        gateway: plan.gateway,
        routeId: plan.gateway.routeId,
        model: plan.run.model,
        provider: plan.gateway.provider,
        gatewayTags: plan.gateway.tags,
        promptScope: input.promptScope || [],
        usage,
        estimatedCostUsd: cost,
        raw: null,
      };
    },
  };
}

export function createUnconfiguredAiAdapter(options = {}) {
  const reason = options.reason || 'AI Gateway adapter is not configured.';
  async function fail() {
    const error = new Error(reason);
    error.code = 'AI_GATEWAY_NOT_CONFIGURED';
    error.status = 503;
    throw error;
  }
  return {
    mode: 'unconfigured',
    runTask: fail,
  };
}

export function createAiGatewayAdapter(options = {}) {
  const env = options.env || {};
  const deploymentConfig = options.deploymentConfig || createModelDeploymentConfigFromEnv(env);
  const generateText = options.generateText;
  const fallbackAdapter = options.fallbackAdapter || null;

  return {
    mode: 'ai-gateway',
    async runTask(taskType, input = {}) {
      const plan = planAgentRun(taskType, {
        ...input,
        env,
        deploymentConfig: input.deploymentConfig || deploymentConfig,
      });
      if (!plan.gateway.model) {
        if (fallbackAdapter && input.allowDryRunFallback) return fallbackAdapter.runTask(taskType, input);
        const error = new Error(`No AI Gateway model configured for route "${plan.gateway.routeId}". Configure AUTHOROS_MODEL_${plan.gateway.routeId.toUpperCase()} or pass deploymentConfig.models.`);
        error.code = 'AI_MODEL_NOT_CONFIGURED';
        error.status = 503;
        throw error;
      }
      if (typeof generateText !== 'function') {
        const error = new Error('AI Gateway generateText function is not configured.');
        error.code = 'AI_GATEWAY_CLIENT_NOT_CONFIGURED';
        error.status = 503;
        throw error;
      }
      const maxInputTokens = Number(input.maxInputTokens || deploymentConfig.gateway?.maxInputTokens || 24000);
      const estimatedInputTokens = estimateTokensFromText(plan.prompt);
      if (estimatedInputTokens > maxInputTokens) {
        const error = new Error(`Prompt exceeds managed AI budget: estimated ${estimatedInputTokens} tokens, limit ${maxInputTokens}.`);
        error.code = 'AI_PROMPT_TOO_LARGE';
        error.status = 413;
        throw error;
      }

      const result = await generateText({
        model: plan.gateway.model,
        system: input.system || 'You are an expert authoring copilot. Return reviewable work, never unapproved final changes.',
        prompt: plan.prompt,
        maxOutputTokens: Number(input.maxOutputTokens || deploymentConfig.gateway?.maxOutputTokens || 1200),
        providerOptions: plan.gateway.providerOptions,
      });
      const usage = normalizeGatewayUsage(result.totalUsage || result.usage || {});
      const estimatedCostUsd = estimateGatewayCostUsd(usage, plan.gateway, input);
      return {
        mode: 'ai-gateway',
        status: 'completed',
        text: result.text || '',
        finishReason: result.finishReason || null,
        gateway: plan.gateway,
        routeId: plan.gateway.routeId,
        model: plan.gateway.model,
        provider: plan.gateway.provider,
        gatewayTags: plan.gateway.tags,
        promptScope: input.promptScope || [],
        usage,
        estimatedCostUsd,
        raw: {
          warnings: result.warnings || [],
          responseId: result.response?.id || null,
          providerMetadata: result.providerMetadata || null,
        },
      };
    },
  };
}

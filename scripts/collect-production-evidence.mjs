#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const wantsJson = hasFlag('--json');
const saveReport = hasFlag('--save');
const requireReady = hasFlag('--require-ready');
const includeRaw = hasFlag('--include-raw');
const liveUrl = getFlagValue('--live-url', process.env.AUTHOROS_VERIFY_URL || process.env.NEXT_PUBLIC_APP_URL || '');
const expectProduction = hasFlag('--expect-production') || requireReady;
const liveRequireReady = hasFlag('--live-require-ready') || requireReady;
const vercelBypassSecret = getFlagValue('--vercel-bypass-secret', '');
const useVercelBypassQuery = hasFlag('--vercel-bypass-query');
const vercelSetBypassCookie = getFlagValue('--vercel-set-bypass-cookie', '');
const envFile = getFlagValue('--env-file');
const noEnvFile = hasFlag('--no-env-file');
const reportPath = getFlagValue('--output', 'reports/production-evidence.json');
const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const remoteEnvAuditRequested = hasFlag('--remote-env-audit') || hasFlag('--vercel-env-audit') || requireReady;
const remoteEnvLsFile = getFlagValue('--env-ls-file', '');
const previewBranch = getFlagValue('--preview-branch', '');

function hasFlag(flag) {
  return args.includes(flag);
}

function getFlagValue(flag, fallback = null) {
  const inlinePrefix = `${flag}=`;
  const inline = args.find(arg => arg.startsWith(inlinePrefix));
  if (inline) return inline.slice(inlinePrefix.length);
  const index = args.indexOf(flag);
  if (index === -1 || index + 1 >= args.length) return fallback;
  return args[index + 1];
}

function redactCommandArgs(commandArgs = []) {
  const secretValueFlags = new Set(['--vercel-bypass-secret']);
  return commandArgs.map((arg, index) => {
    const previous = commandArgs[index - 1];
    if (secretValueFlags.has(previous)) return 'redacted';
    for (const flag of secretValueFlags) {
      if (arg.startsWith(`${flag}=`)) return `${flag}=redacted`;
    }
    return redactSensitiveUrlToken(arg);
  });
}

function redactSensitiveUrlToken(value) {
  const text = String(value || '');
  if (!text.includes('_vercel_share=') && !text.includes('x-vercel-protection-bypass=')) return text;
  try {
    const url = new URL(text.startsWith('http') ? text : `https://${text}`);
    if (url.searchParams.has('_vercel_share')) url.searchParams.set('_vercel_share', 'redacted');
    if (url.searchParams.has('x-vercel-protection-bypass')) url.searchParams.set('x-vercel-protection-bypass', 'redacted');
    return url.toString();
  } catch {
    return text
      .replace(/([?&]_vercel_share=)[^&\s]+/g, '$1redacted')
      .replace(/([?&]x-vercel-protection-bypass=)[^&\s]+/g, '$1redacted');
  }
}

function sanitizeLiveUrl(value) {
  if (!value) return null;
  try {
    const url = new URL(String(value).startsWith('http') ? String(value) : `https://${value}`);
    url.searchParams.delete('_vercel_share');
    url.searchParams.delete('x-vercel-protection-bypass');
    url.searchParams.delete('x-vercel-set-bypass-cookie');
    url.hash = '';
    const query = url.searchParams.toString();
    return `${url.origin}${url.pathname === '/' ? '' : url.pathname}${query ? `?${query}` : ''}`;
  } catch {
    return redactSensitiveUrlToken(value);
  }
}

function runNodeJson(script, commandArgs = [], options = {}) {
  const scriptPath = path.isAbsolute(script) ? script : path.join(packageRoot, script);
  const result = spawnSync(process.execPath, [scriptPath, ...commandArgs], {
    cwd: process.cwd(),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: Number(options.timeoutMs || 60000),
    env: process.env,
  });
  const stdout = result.stdout || '';
  let body = null;
  let parseError = null;
  try {
    body = stdout.trim() ? JSON.parse(stdout) : null;
  } catch (error) {
    parseError = error.message;
  }
  return {
    command: [process.execPath, scriptPath, ...redactCommandArgs(commandArgs)].join(' '),
    exitCode: result.status,
    ok: result.status === 0,
    body,
    error: result.error?.message || parseError || (result.status ? (result.stderr || stdout).trim() : null),
    raw: includeRaw ? { stdout, stderr: result.stderr || '' } : undefined,
  };
}

function runAuthorJson(command, commandArgs = [], options = {}) {
  return runNodeJson('bin/author.js', [command, ...commandArgs], options);
}

function statusFrom(value) {
  if (!value) return 'missing';
  return String(value);
}

function splitCsv(value, fallback = []) {
  if (!value) return fallback;
  return String(value).split(',').map(item => item.trim()).filter(Boolean);
}

function addCheck(checks, id, label, status, detail, severity = 'blocker', nextAction = null) {
  checks.push({
    id,
    label,
    status,
    severity,
    detail,
    nextAction,
  });
}

function summarizeEnvContract(body) {
  if (!body) return null;
  return {
    status: statusFrom(body.status),
    requiredReadyCount: body.requiredReadyCount ?? null,
    requiredCount: body.requiredCount ?? null,
    recommendedReadyCount: body.recommendedReadyCount ?? null,
    recommendedCount: body.recommendedCount ?? null,
    missingRequired: body.missingRequired || [],
    missingRecommended: body.missingRecommended || [],
    placeholderRequired: body.placeholderRequired || [],
    invalidRequired: body.invalidRequired || [],
  };
}

function summarizeSetupContract(body) {
  if (!body) return null;
  const contract = body.setupContract || body;
  return {
    status: statusFrom(contract.status),
    project: contract.project || null,
    environments: contract.environments || [],
    summary: contract.summary || null,
    blockedConnectors: (contract.connectors || [])
      .filter(connector => connector.status === 'blocked')
      .map(connector => ({
        id: connector.id,
        label: connector.label,
        provider: connector.provider,
        missingRequired: connector.missingRequired || [],
      })),
    reviewConnectors: (contract.connectors || [])
      .filter(connector => connector.status === 'review')
      .map(connector => ({
        id: connector.id,
        label: connector.label,
        provider: connector.provider,
        missingRecommended: connector.missingRecommended || [],
      })),
    proofEndpointCount: (contract.proofEndpoints || []).length,
    remoteEnvAuditPlan: contract.remoteEnvAuditPlan
      ? {
        command: contract.remoteEnvAuditPlan.command || null,
        note: contract.remoteEnvAuditPlan.note || null,
      }
      : null,
    nextAction: contract.nextAction || null,
  };
}

function summarizeRemoteEnvAudit(body) {
  if (!body) return null;
  return {
    status: statusFrom(body.status),
    project: body.project || null,
    environments: body.environments || [],
    entryCount: body.entryCount ?? body.summary?.entryCount ?? null,
    requiredPresentCount: body.summary?.requiredPresentCount ?? null,
    requiredCount: body.summary?.requiredCount ?? null,
    recommendedPresentCount: body.summary?.recommendedPresentCount ?? null,
    recommendedCount: body.summary?.recommendedCount ?? null,
    baselinePresentCount: body.summary?.baselinePresentCount ?? null,
    baselineNameCount: body.summary?.baselineNameCount ?? null,
    environmentSummaries: body.environmentSummaries || {},
    missingRequired: body.missingRequired || [],
    missingRecommended: body.missingRecommended || [],
    note: body.note || null,
  };
}

function summarizeLaunchPlan(body) {
  if (!body) return null;
  const plan = body.launchPlan || body;
  return {
    status: statusFrom(plan.status),
    project: plan.project || null,
    appUrl: plan.appUrl || null,
    summary: plan.summary || null,
    stages: (plan.stages || []).map(stage => ({
      id: stage.id,
      label: stage.label,
      status: stage.status,
      detail: stage.detail,
    })),
    topActions: (plan.actions || []).slice(0, 12).map(action => ({
      id: action.id,
      label: action.label,
      status: action.status,
      severity: action.severity,
      nextAction: action.nextAction,
      command: action.command || null,
    })),
    proofCommandCount: (plan.proofCommands || []).length,
    nextAction: plan.nextAction || null,
  };
}

function summarizeMigration(body) {
  if (!body) return null;
  return {
    mode: body.mode || null,
    connected: Boolean(body.connected),
    database: body.database || null,
    status: body.plan?.status || body.status || null,
    pendingCount: body.plan?.pending?.length ?? null,
    appliedCount: body.plan?.applied?.length ?? null,
    checksumMismatchCount: body.plan?.checksumMismatches?.length ?? null,
    nextAction: body.nextAction || null,
  };
}

function summarizeCloudReadiness(body) {
  if (!body) return null;
  return {
    cloudStatus: body.cloud?.status || null,
    launchStatus: body.launch?.status || null,
    demoMode: body.launch?.demoMode ?? body.cloud?.demoMode ?? null,
    launchBlockers: body.launch?.blockers || [],
    launchWarnings: body.launch?.warnings || [],
  };
}

function summarizeRuntime(body) {
  if (!body) return null;
  return {
    status: body.status || null,
    expected: body.expected || null,
    runtime: body.runtime || null,
    blockedChecks: (body.checks || []).filter(check => check.status === 'blocked').map(check => check.id),
  };
}

function summarizeLive(body) {
  if (!body) return null;
  return {
    status: body.status || null,
    baseUrl: body.baseUrl || null,
    summary: body.summary || null,
    vercelProtection: body.vercelProtection || null,
    readiness: body.readiness || null,
    setupContract: body.setupContract || null,
    launchPlan: body.launchPlan || null,
    blockedChecks: (body.checks || []).filter(check => check.status === 'blocked').map(check => ({
      id: check.id,
      label: check.label,
      detail: check.detail,
    })),
    warningChecks: (body.checks || []).filter(check => check.status === 'warn').map(check => ({
      id: check.id,
      label: check.label,
      detail: check.detail,
    })),
    skippedChecks: (body.checks || []).filter(check => check.status === 'skipped').map(check => ({
      id: check.id,
      label: check.label,
      detail: check.detail,
    })),
  };
}

function readVercelProjectLink() {
  const file = path.resolve('.vercel/project.json');
  try {
    if (!fs.existsSync(file)) return { linked: false, projectId: null, orgId: null, projectName: null };
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    return {
      linked: Boolean(data.projectId && data.orgId),
      projectId: data.projectId || null,
      orgId: data.orgId || null,
      projectName: data.projectName || null,
    };
  } catch (error) {
    return {
      linked: false,
      projectId: null,
      orgId: null,
      projectName: null,
      error: error.message,
    };
  }
}

function gitEvidence() {
  const status = spawnSync('git', ['status', '--short'], {
    cwd: process.cwd(),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 15000,
  });
  const branch = spawnSync('git', ['branch', '--show-current'], {
    cwd: process.cwd(),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 15000,
  });
  const lines = (status.stdout || '').split(/\r?\n/).filter(Boolean);
  return {
    branch: branch.status === 0 ? branch.stdout.trim() || null : null,
    dirty: lines.length > 0,
    changedFileCount: lines.length,
    untrackedFileCount: lines.filter(line => line.startsWith('??')).length,
  };
}

function classifyOverall(checks) {
  if (checks.some(check => check.status === 'blocked' && check.severity === 'blocker')) return 'blocked';
  if (checks.some(check => check.status === 'warn' || check.status === 'missing')) return 'needs_review';
  return 'ready';
}

function createOperatorAction(input = {}) {
  return {
    id: input.id,
    phase: input.phase || 'production',
    priority: input.priority || 'P2',
    label: input.label,
    status: input.status || 'blocked',
    reason: input.reason || '',
    command: input.command || null,
    evidence: input.evidence || [],
    missing: input.missing || [],
    blockedBy: input.blockedBy || [],
  };
}

function pushOperatorAction(actions, input) {
  if (!input?.id || actions.some(action => action.id === input.id)) return;
  actions.push(createOperatorAction(input));
}

function buildAuthorCommand(command, options = {}) {
  const parts = [command];
  if (options.project) parts.push('--project', options.project);
  if (options.environments?.length) parts.push('--environments', options.environments.join(','));
  if (options.appUrl) parts.push('--app-url', options.appUrl);
  if (options.previewBranch) parts.push('--preview-branch', options.previewBranch);
  else if (options.previewBranchPlaceholder) parts.push('--preview-branch', options.previewBranchPlaceholder);
  return parts.join(' ');
}

function normalizeAuditEnvironmentName(value = '') {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'prod') return 'production';
  if (normalized === 'dev') return 'development';
  if (normalized.startsWith('preview')) return 'preview';
  if (normalized.startsWith('production')) return 'production';
  if (normalized.startsWith('development')) return 'development';
  return normalized || value;
}

function getRemoteEnvironmentSummary(remoteBody, environment) {
  const normalized = normalizeAuditEnvironmentName(environment);
  return remoteBody?.environmentSummaries?.[normalized] || null;
}

function getRemoteGapEnvironments(remoteBody, environments = [], countKey) {
  const normalizedEnvironments = [...new Set(environments.map(normalizeAuditEnvironmentName).filter(Boolean))];
  const summaries = remoteBody?.environmentSummaries || {};
  const summaryEnvironments = normalizedEnvironments.length
    ? normalizedEnvironments
    : Object.keys(summaries);
  const missing = summaryEnvironments.filter(environment => {
    const summary = summaries[environment];
    return Number(summary?.[countKey] || 0) > 0;
  });
  if (missing.length) return missing;
  return Number(remoteBody?.summary?.[countKey] || 0) > 0 ? summaryEnvironments : [];
}

function getRemoteGapNames(remoteBody, environments = [], listKey, fallback = []) {
  const names = [];
  for (const environment of environments) {
    const summary = getRemoteEnvironmentSummary(remoteBody, environment);
    if (Array.isArray(summary?.[listKey])) names.push(...summary[listKey]);
  }
  return [...new Set(names.length ? names : fallback)];
}

function formatRemoteGapReason(remoteBody, environments = [], countKey, totalKey, label) {
  const parts = environments.map(environment => {
    const summary = getRemoteEnvironmentSummary(remoteBody, environment);
    const missing = Number(summary?.[countKey] || 0);
    const total = Number(summary?.[totalKey] || 0);
    return summary ? `${environment}: ${missing}/${total} ${label} missing` : null;
  }).filter(Boolean);
  if (parts.length) return parts.join('; ');
  const missing = Number(remoteBody?.summary?.[countKey] || 0);
  const total = Number(remoteBody?.summary?.[totalKey] || 0);
  return `${missing}/${total} ${label} missing remotely`;
}

function createOperatorNextActions(input = {}) {
  const actions = [];
  const envBody = input.envContract?.body || {};
  const setupBody = input.setupContract?.body?.setupContract || input.setupContract?.body || {};
  const launchBody = input.launchPlan?.body?.launchPlan || input.launchPlan?.body || {};
  const migrationBody = input.migration?.body || {};
  const cloudBody = input.cloudReadiness?.body || {};
  const remoteBody = input.remoteEnvAudit?.body || null;
  const liveBody = input.live?.body || null;
  const auditEnvironments = input.auditEnvironments || ['production', 'preview'];
  const envFileArg = input.envFile ? `--env-file ${input.envFile}` : input.noEnvFile ? '--no-env-file' : '--env-file .env.local';
  const project = input.auditProject || 'author-os';
  const branch = input.previewBranch || '';
  const appUrl = input.auditAppUrl || '';
  const liveUrl = input.liveUrl || '<preview-url>';
  const branchArg = branch ? ` --preview-branch ${branch}` : '';
  const normalizedAuditEnvironments = [...new Set(auditEnvironments.map(normalizeAuditEnvironmentName).filter(Boolean))];
  const auditCommand = buildAuthorCommand('author-os cloud-env --vercel --audit', {
    project,
    environments: normalizedAuditEnvironments,
    appUrl,
  });

  if (!remoteBody && input.remoteEnvAuditRequested) {
    pushOperatorAction(actions, {
      id: 'rerun-remote-env-audit',
      phase: 'environment',
      priority: 'P0',
      label: 'Rerun remote Vercel env presence audit',
      reason: input.remoteEnvAudit?.error || 'Remote env audit was requested but did not return usable JSON.',
      command: auditCommand,
      evidence: ['author-os production-evidence --remote-env-audit --json'],
    });
  } else if (!remoteBody) {
    pushOperatorAction(actions, {
      id: 'run-remote-env-audit',
      phase: 'environment',
      priority: 'P1',
      label: 'Audit remote Vercel env name presence',
      status: 'needs_review',
      reason: 'Remote Vercel env presence has not been checked in this evidence bundle.',
      command: auditCommand,
      evidence: ['author-os cloud-env --vercel --audit --json'],
    });
  }

  const missingBaselineEnvironments = getRemoteGapEnvironments(remoteBody, normalizedAuditEnvironments, 'missingBaselineCount');
  if (missingBaselineEnvironments.length) {
    const previewBranchPlaceholder = missingBaselineEnvironments.includes('preview') && !branch ? '<non-production-branch>' : null;
    const targetedBaselineCommand = buildAuthorCommand('author-os cloud-env --vercel --baseline', {
      project,
      environments: missingBaselineEnvironments,
      appUrl,
      previewBranch: branch,
      previewBranchPlaceholder,
    });
    const missingBaseline = getRemoteGapNames(remoteBody, missingBaselineEnvironments, 'missingBaseline', remoteBody.baseline?.missing || []);
    pushOperatorAction(actions, {
      id: 'apply-safe-env-baseline',
      phase: 'environment',
      priority: 'P0',
      label: 'Apply deterministic non-secret Vercel baseline',
      reason: formatRemoteGapReason(remoteBody, missingBaselineEnvironments, 'missingBaselineCount', 'baselineNameCount', 'safe baseline names'),
      command: targetedBaselineCommand,
      evidence: ['author-os cloud-env --vercel --audit --json'],
      missing: missingBaseline,
    });
  }

  const missingRequiredEnvironments = getRemoteGapEnvironments(remoteBody, normalizedAuditEnvironments, 'missingRequiredCount');
  if (remoteBody?.missingRequired?.length || missingRequiredEnvironments.length) {
    const previewBranchPlaceholder = missingRequiredEnvironments.includes('preview') && !branch ? '<non-production-branch>' : null;
    const missingBaseline = getRemoteGapNames(remoteBody, missingBaselineEnvironments, 'missingBaseline', remoteBody.baseline?.missing || []);
    const missingRequired = getRemoteGapNames(remoteBody, missingRequiredEnvironments, 'missingRequired', remoteBody.missingRequired || []);
    const applyRequired = missingRequired.filter(name => !missingBaseline.includes(name));
    const targetedEnvCommand = buildAuthorCommand('author-os cloud-env --vercel --apply-file .env.providers.local', {
      project,
      environments: missingRequiredEnvironments.length ? missingRequiredEnvironments : normalizedAuditEnvironments,
      previewBranch: branch,
      previewBranchPlaceholder,
    });
    const command = `${targetedEnvCommand} --names ${(applyRequired.length ? applyRequired : missingRequired).join(',')} --require-ready --apply`;
    pushOperatorAction(actions, {
      id: 'configure-remote-required-env-names',
      phase: 'environment',
      priority: 'P0',
      label: 'Apply missing provider Vercel env values',
      reason: formatRemoteGapReason(remoteBody, missingRequiredEnvironments, 'missingRequiredCount', 'requiredCount', 'required env names'),
      command,
      evidence: ['author-os cloud-env --vercel --apply-file .env.providers.local --require-ready', 'author-os cloud-env --vercel --audit --require-present'],
      missing: missingRequired,
      blockedBy: missingBaseline,
    });
  }

  if (envBody.status && envBody.status !== 'ready') {
    pushOperatorAction(actions, {
      id: 'populate-and-validate-env-values',
      phase: 'environment',
      priority: 'P0',
      label: 'Populate and validate production env values',
      reason: `${envBody.requiredReadyCount ?? 0}/${envBody.requiredCount ?? 0} required values are ready in the checked environment file.`,
      command: `vercel env pull .env.local --yes && author-os cloud-env --require-ready --env-file .env.local`,
      evidence: ['author-os cloud-env --require-ready --env-file .env.local'],
      missing: envBody.missingRequired || [],
    });
  }

  if (setupBody.status && setupBody.status !== 'ready') {
    const blockedConnectors = (setupBody.connectors || [])
      .filter(connector => connector.status === 'blocked')
      .map(connector => connector.id);
    pushOperatorAction(actions, {
      id: 'resolve-setup-connectors',
      phase: 'providers',
      priority: 'P0',
      label: 'Resolve blocked provider connectors',
      reason: `${setupBody.summary?.blockedConnectorCount ?? blockedConnectors.length} setup connector(s) remain blocked.`,
      command: `author-os setup-contract --json ${envFileArg}${branchArg}`,
      evidence: ['author-os setup-contract --require-ready --env-file .env.local'],
      missing: blockedConnectors,
    });
  }

  if (!migrationBody.connected || migrationBody.plan?.status !== 'current') {
    pushOperatorAction(actions, {
      id: 'attach-postgres-and-run-migrations',
      phase: 'database',
      priority: 'P0',
      label: 'Attach Postgres and verify migrations',
      reason: migrationBody.connected
        ? `Migration plan is ${migrationBody.plan?.status || 'unknown'}, not current.`
        : 'No Postgres connection is available for migration verification.',
      command: 'author-os cloud-migrate --status --require-current --env-file .env.local',
      evidence: ['author_schema_migrations', 'author-os cloud-migrate --status --require-current --env-file .env.local'],
    });
  }

  const liveProtection = liveBody?.vercelProtection || {};
  if (!liveBody && input.liveUrl) {
    pushOperatorAction(actions, {
      id: 'rerun-live-verification',
      phase: 'preview',
      priority: 'P0',
      label: 'Rerun live verification',
      reason: input.live?.error || 'Live verification was requested but did not return usable JSON.',
      command: `node scripts/verify-live-cockpit.mjs ${liveUrl} --expect-production --require-ready`,
      evidence: ['node scripts/verify-live-cockpit.mjs <preview-url> --expect-production --require-ready'],
    });
  } else if (!input.liveUrl) {
    pushOperatorAction(actions, {
      id: 'verify-live-preview-url',
      phase: 'preview',
      priority: 'P1',
      label: 'Verify a live Vercel preview URL',
      status: 'needs_review',
      reason: 'No live URL was provided to the production evidence bundle.',
      command: 'author-os production-evidence --env-file .env.local --live-url <preview-url> --remote-env-audit --require-ready --save',
      evidence: ['node scripts/verify-live-cockpit.mjs <preview-url> --expect-production --require-ready'],
    });
  }

  if (liveProtection.protectedEndpointCount > 0 && !liveProtection.bypassProvided && liveProtection.bypassMode !== 'temporary_share') {
    pushOperatorAction(actions, {
      id: 'configure-protected-preview-bypass',
      phase: 'preview',
      priority: 'P0',
      label: 'Configure protected preview automation access',
      reason: `${liveProtection.protectedEndpointCount} live endpoint(s) were hidden behind Vercel deployment protection.`,
      command: `node scripts/verify-live-cockpit.mjs ${liveUrl} --expect-production --require-ready --vercel-bypass-secret $AUTHOROS_VERCEL_PROTECTION_BYPASS`,
      evidence: ['Vercel Protection Bypass for Automation', 'node scripts/verify-live-cockpit.mjs <preview-url> --expect-production --require-ready'],
    });
  }

  if (launchBody.status && launchBody.status !== 'ready') {
    pushOperatorAction(actions, {
      id: 'clear-launch-plan-blockers',
      phase: 'promotion',
      priority: 'P1',
      label: 'Clear launch-plan blockers before promotion',
      status: 'needs_review',
      reason: `${launchBody.summary?.blockerCount ?? 'Unknown'} launch blocker(s) remain.`,
      command: `author-os launch-plan --check-db --preview-verified --require-ready --env-file .env.local${branchArg}`,
      evidence: ['author-os launch-plan --check-db --preview-verified --require-ready --env-file .env.local'],
      missing: (launchBody.actions || []).slice(0, 8).map(action => action.id),
    });
  }

  if (cloudBody.launch?.status && cloudBody.launch.status !== 'ready') {
    pushOperatorAction(actions, {
      id: 'rerun-cloud-readiness',
      phase: 'promotion',
      priority: 'P2',
      label: 'Rerun strict cloud readiness',
      status: 'needs_review',
      reason: `Cloud readiness is ${cloudBody.cloud?.status || 'unknown'} and launch readiness is ${cloudBody.launch.status}.`,
      command: 'author-os cloud-readiness --require-ready --env-file .env.local',
      evidence: ['author-os cloud-readiness --require-ready --env-file .env.local'],
      missing: cloudBody.launch?.blockers || [],
    });
  }

  return actions.sort((left, right) => {
    const priorityRank = { P0: 0, P1: 1, P2: 2, P3: 3 };
    const phaseRank = { environment: 0, providers: 1, database: 2, preview: 3, promotion: 4, production: 5 };
    return (priorityRank[left.priority] ?? 9) - (priorityRank[right.priority] ?? 9)
      || (phaseRank[left.phase] ?? 9) - (phaseRank[right.phase] ?? 9)
      || left.id.localeCompare(right.id);
  });
}

const vercelProject = readVercelProjectLink();
const auditProject = getFlagValue('--project', vercelProject.projectName || vercelProject.projectId || 'author-os');
const auditEnvironments = splitCsv(getFlagValue('--environments'), ['production', 'preview']);
const auditAppUrl = getFlagValue('--app-url', sanitizeLiveUrl(liveUrl) || process.env.NEXT_PUBLIC_APP_URL || '');
const commonEnvArgs = noEnvFile ? ['--no-env-file'] : envFile ? ['--env-file', envFile] : [];
const previewBranchArgs = previewBranch ? ['--preview-branch', previewBranch] : [];
const runtime = runNodeJson('scripts/verify-runtime-contract.mjs', ['--json']);
const envContract = runAuthorJson('cloud-env', [
  '--json',
  ...commonEnvArgs,
  ...(requireReady ? ['--require-ready'] : []),
]);
const setupContract = runAuthorJson('setup-contract', [
  '--json',
  ...commonEnvArgs,
  ...previewBranchArgs,
  ...(requireReady ? ['--require-ready'] : []),
]);
const launchPlan = runAuthorJson('launch-plan', [
  '--json',
  ...commonEnvArgs,
  ...previewBranchArgs,
  ...(requireReady ? ['--check-db', '--preview-verified', '--require-ready'] : []),
]);
const migration = runAuthorJson('cloud-migrate', [
  requireReady ? '--status' : '--dry-run',
  '--json',
  ...commonEnvArgs,
  ...(requireReady ? ['--require-current'] : []),
]);
const cloudReadiness = runAuthorJson('cloud-readiness', [
  '--json',
  ...commonEnvArgs,
  ...(requireReady ? ['--require-ready'] : []),
]);
const remoteEnvAudit = remoteEnvAuditRequested
  ? runAuthorJson('cloud-env', [
    '--vercel',
    '--audit',
    '--json',
    '--project',
    auditProject,
    '--environments',
    auditEnvironments.join(','),
    ...previewBranchArgs,
    ...(remoteEnvLsFile ? ['--env-ls-file', remoteEnvLsFile] : []),
    ...(auditAppUrl ? ['--app-url', auditAppUrl] : []),
  ], { timeoutMs: 90000 })
  : null;
const liveArgs = [
  liveUrl,
  '--json',
  ...(expectProduction ? ['--expect-production'] : []),
  ...(liveRequireReady ? ['--require-ready', '--require-promotable'] : []),
  ...(vercelBypassSecret ? ['--vercel-bypass-secret', vercelBypassSecret] : []),
  ...(useVercelBypassQuery ? ['--vercel-bypass-query'] : []),
  ...(vercelSetBypassCookie ? ['--vercel-set-bypass-cookie', vercelSetBypassCookie] : []),
].filter(Boolean);
const live = liveUrl
  ? runNodeJson('scripts/verify-live-cockpit.mjs', liveArgs, { timeoutMs: 90000 })
  : null;

const checks = [];
addCheck(
  checks,
  'runtime-contract',
  'Node and pnpm runtime contract',
  runtime.body?.status === 'ready' ? 'pass' : 'blocked',
  runtime.body?.status ? `runtime=${runtime.body.status}` : runtime.error || 'Runtime contract did not return JSON.',
  'blocker',
  'Run npm run runtime:check locally and in CI.',
);
addCheck(
  checks,
  'production-env-contract',
  'Required production environment values',
  envContract.body?.status === 'ready' ? 'pass' : 'blocked',
  envContract.body ? `${envContract.body.requiredReadyCount}/${envContract.body.requiredCount} required values ready.` : envContract.error || 'Env contract did not return JSON.',
  'blocker',
  'Populate Vercel project envs with real Clerk, Postgres, Blob, Stripe, AI Gateway, MCP OAuth, and app URL values.',
);
addCheck(
  checks,
  'setup-contract',
  'Production setup contract',
  (setupContract.body?.status || setupContract.body?.setupContract?.status) === 'ready' ? 'pass' : 'blocked',
  setupContract.body?.summary
    ? `${setupContract.body.summary.blockedConnectorCount} connector blockers.`
    : setupContract.body?.setupContract?.summary
      ? `${setupContract.body.setupContract.summary.blockedConnectorCount} connector blockers.`
      : setupContract.error || 'Setup contract did not return JSON.',
  'blocker',
  'Run author-os setup-contract after env provisioning and resolve blocked connectors.',
);
addCheck(
  checks,
  'launch-plan',
  'Promotion launch plan',
  (launchPlan.body?.status || launchPlan.body?.launchPlan?.status) === 'ready' ? 'pass' : 'blocked',
  launchPlan.body?.summary
    ? `${launchPlan.body.summary.blockerCount} launch blockers.`
    : launchPlan.body?.launchPlan?.summary
      ? `${launchPlan.body.launchPlan.summary.blockerCount} launch blockers.`
      : launchPlan.error || 'Launch plan did not return JSON.',
  'blocker',
  'Run author-os launch-plan --check-db --preview-verified --require-ready before promotion.',
);
addCheck(
  checks,
  'migration-plan',
  'Database migration evidence',
  migration.body?.connected && migration.body?.plan?.status === 'current' ? 'pass' : 'blocked',
  migration.body?.connected
    ? `migration=${migration.body.plan?.status || 'missing'}`
    : migration.body?.nextAction || migration.error || 'Migration did not return JSON.',
  'blocker',
  'Attach Marketplace Postgres and run author-os cloud-migrate --status --require-current.',
);
addCheck(
  checks,
  'cloud-readiness',
  'Hosted cloud and launch readiness',
  cloudReadiness.body?.launch?.status === 'ready' ? 'pass' : 'blocked',
  cloudReadiness.body?.launch
    ? `cloud=${cloudReadiness.body.cloud?.status || 'missing'} launch=${cloudReadiness.body.launch.status}.`
    : cloudReadiness.error || 'Cloud readiness did not return JSON.',
  'blocker',
  'Run author-os cloud-readiness --require-ready after env and database provisioning.',
);
if (remoteEnvAuditRequested) {
  const auditBody = remoteEnvAudit?.body;
  const remoteRequiredMissing = auditBody?.missingRequired || [];
  addCheck(
    checks,
    'remote-vercel-env-presence',
    'Remote Vercel env names are present',
    auditBody && remoteRequiredMissing.length === 0 ? 'pass' : 'blocked',
    auditBody
      ? `${auditBody.summary?.requiredPresentCount ?? 0}/${auditBody.summary?.requiredCount ?? 0} required names present; audit=${auditBody.status || 'missing'} (presence only).`
      : remoteEnvAudit?.error || 'Remote Vercel env audit did not return JSON.',
    'blocker',
    'Run author-os cloud-env --vercel --audit --project <project> --environments production,preview after applying baseline and provider env names.',
  );
}
addCheck(
  checks,
  'live-verification',
  'Live preview or production URL verification',
  live ? live.body?.status === 'ready' ? 'pass' : 'blocked' : 'missing',
    live
      ? live.body
      ? `live=${live.body.status} blockers=${live.body.summary?.blockerCount ?? 'unknown'} skipped=${live.body.summary?.skippedCount ?? 0}.`
      : live.error || 'Live verifier did not return JSON.'
    : 'No --live-url or AUTHOROS_VERIFY_URL provided.',
  live ? 'blocker' : 'warning',
  'Run node scripts/verify-live-cockpit.mjs <url> --expect-production --require-ready after protected-preview bypass and production envs are configured.',
);

const operatorNextActions = createOperatorNextActions({
  envContract,
  setupContract,
  remoteEnvAudit,
  launchPlan,
  migration,
  cloudReadiness,
  live,
  liveUrl: sanitizeLiveUrl(liveUrl),
  auditProject,
  auditEnvironments,
  auditAppUrl,
  previewBranch,
  envFile,
  noEnvFile,
  remoteEnvAuditRequested,
});

const report = {
  status: classifyOverall(checks),
  generatedAt: new Date().toISOString(),
  envFile: noEnvFile ? null : envFile || 'auto',
  liveUrl: sanitizeLiveUrl(liveUrl),
  vercelProject,
  git: gitEvidence(),
  summary: {
    checkCount: checks.length,
    blockerCount: checks.filter(check => check.status === 'blocked' && check.severity === 'blocker').length,
    warningCount: checks.filter(check => check.status === 'warn' || check.status === 'missing').length,
    skippedCount: checks.filter(check => check.status === 'skipped').length,
    operatorNextActionCount: operatorNextActions.length,
  },
  evidence: {
    runtime: summarizeRuntime(runtime.body),
    envContract: summarizeEnvContract(envContract.body),
    setupContract: summarizeSetupContract(setupContract.body),
    remoteEnvAudit: summarizeRemoteEnvAudit(remoteEnvAudit?.body),
    launchPlan: summarizeLaunchPlan(launchPlan.body),
    migration: summarizeMigration(migration.body),
    cloudReadiness: summarizeCloudReadiness(cloudReadiness.body),
    live: summarizeLive(live?.body),
  },
  operatorNextActions,
  checks,
  raw: includeRaw ? {
    runtime,
    envContract,
    setupContract,
    remoteEnvAudit,
    launchPlan,
    migration,
    cloudReadiness,
    live,
  } : undefined,
};

if (saveReport) {
  fs.mkdirSync(path.dirname(path.resolve(reportPath)), { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
}

if (wantsJson) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(`AuthorOS production evidence: ${report.status}`);
  console.log(`  Runtime: ${report.evidence.runtime?.status || 'missing'}`);
  console.log(`  Env: ${report.evidence.envContract?.status || 'missing'}`);
  console.log(`  Setup: ${report.evidence.setupContract?.status || 'missing'}`);
  console.log(`  Remote env audit: ${report.evidence.remoteEnvAudit?.status || (remoteEnvAuditRequested ? 'missing' : 'not_checked')}`);
  console.log(`  Launch: ${report.evidence.launchPlan?.status || 'missing'}`);
  console.log(`  Migration: ${report.evidence.migration?.status || 'missing'}`);
  console.log(`  Cloud readiness: ${report.evidence.cloudReadiness?.launchStatus || 'missing'}`);
  console.log(`  Live: ${report.evidence.live?.status || (liveUrl ? 'missing' : 'not_checked')}`);
  if (operatorNextActions.length) {
    console.log('  Operator next actions:');
    for (const action of operatorNextActions.slice(0, 8)) {
      console.log(`    ${action.priority} ${action.phase} ${action.id}: ${action.label}`);
      if (action.command) console.log(`      ${action.command}`);
    }
    if (operatorNextActions.length > 8) console.log(`    + ${operatorNextActions.length - 8} more actions`);
  }
  for (const check of checks) {
    const marker = check.status === 'pass' ? 'PASS' : check.status === 'missing' ? 'MISS' : check.status === 'warn' ? 'WARN' : check.status === 'skipped' ? 'SKIP' : 'BLOCK';
    console.log(`  ${marker.padEnd(5)} ${check.label}: ${check.detail}`);
  }
  if (saveReport) console.log(`  Saved: ${reportPath}`);
}

if (requireReady && report.status !== 'ready') process.exit(1);

#!/usr/bin/env node

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'authoros-env-audit-'));
const envListFile = path.join(tempDir, 'vercel-env-ls.txt');

const vercelEnvListOutput = `
 name                                       value               environments        created
 AUTHOROS_DEMO_MODE                         Encrypted           Production          17m ago
 AUTHOROS_REQUIRE_AUTH                      Encrypted           Production          17m ago
 AUTHOROS_AUTH_PROVIDER                     Encrypted           Production          17m ago
 AUTHOROS_ALLOW_TRUSTED_AUTH_HEADERS        Encrypted           Production          17m ago
 AUTHOROS_DEFAULT_PLAN                      Encrypted           Production          17m ago
 AUTHOROS_DEFAULT_AUTH_ROLE                 Encrypted           Production          17m ago
 AUTHOROS_PROJECT_ADAPTER                   Encrypted           Production          17m ago
 AUTHOROS_DB_MIGRATION_VERSION              Encrypted           Production          17m ago
 AUTHOROS_MIGRATION_APPLIED_BY              Encrypted           Production          17m ago
 AUTHOROS_PG_POOL_MAX                       Encrypted           Production          17m ago
 AUTHOROS_PG_IDLE_TIMEOUT_MS                Encrypted           Production          17m ago
 NEXT_PUBLIC_CLERK_SIGN_IN_URL              Encrypted           Production          17m ago
 NEXT_PUBLIC_CLERK_SIGN_UP_URL              Encrypted           Production          17m ago
 AUTHOROS_AI_MAX_INPUT_TOKENS               Encrypted           Production          17m ago
 AUTHOROS_AI_MAX_OUTPUT_TOKENS              Encrypted           Production          17m ago
 NEXT_PUBLIC_POSTHOG_HOST                   Encrypted           Production          17m ago
 NEXT_PUBLIC_APP_URL                        Encrypted           Production          17m ago
`;

try {
  fs.writeFileSync(envListFile, vercelEnvListOutput);
  const result = spawnSync(process.execPath, [
    'scripts/collect-production-evidence.mjs',
    '--no-env-file',
    '--remote-env-audit',
    '--env-ls-file',
    envListFile,
    '--project',
    'author-os',
    '--environments',
    'production',
    '--json',
  ], {
    cwd: path.resolve('.'),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 120000,
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout);
  assert.equal(report.status, 'blocked');
  assert.equal(report.evidence.remoteEnvAudit.status, 'blocked');
  assert.equal(report.evidence.remoteEnvAudit.requiredPresentCount, 14);
  assert.equal(report.evidence.remoteEnvAudit.requiredCount, 27);
  assert.equal(report.evidence.remoteEnvAudit.environmentSummaries.production.requiredPresentCount, 14);
  assert.equal(report.evidence.remoteEnvAudit.environmentSummaries.production.baselinePresentCount, 16);
  assert.ok(report.evidence.remoteEnvAudit.missingRequired.includes('CLERK_SECRET_KEY'));
  assert.ok(report.evidence.remoteEnvAudit.missingRequired.includes('POSTGRES_URL'));
  assert.ok(report.evidence.setupContract.remoteEnvAuditPlan.command.includes('cloud-env --vercel --audit'));
  assert.ok(Array.isArray(report.operatorNextActions));
  assert.ok(report.operatorNextActions.some(action => action.id === 'configure-remote-required-env-names'));
  assert.ok(report.operatorNextActions.some(action => action.id === 'populate-and-validate-env-values'));
  const remoteAction = report.operatorNextActions.find(action => action.id === 'configure-remote-required-env-names');
  assert.equal(remoteAction.priority, 'P0');
  assert.ok(remoteAction.missing.includes('CLERK_SECRET_KEY'));
  assert.ok(remoteAction.command.includes('author-os cloud-env --vercel'));
  assert.ok(remoteAction.command.includes('--apply-file .env.providers.local'));
  assert.ok(remoteAction.command.includes('--names CLERK_SECRET_KEY'));
  assert.ok(remoteAction.command.includes('--require-ready --apply'));
  const remoteCheck = report.checks.find(check => check.id === 'remote-vercel-env-presence');
  assert.equal(remoteCheck.status, 'blocked');
  assert.ok(remoteCheck.detail.includes('presence only'));
  assert.ok(!JSON.stringify(report).includes('sk_live_replace_me'));

  const productionAndPreviewResult = spawnSync(process.execPath, [
    'scripts/collect-production-evidence.mjs',
    '--no-env-file',
    '--remote-env-audit',
    '--env-ls-file',
    envListFile,
    '--project',
    'author-os',
    '--environments',
    'production,preview',
    '--json',
  ], {
    cwd: path.resolve('.'),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 120000,
  });

  assert.equal(productionAndPreviewResult.status, 0, productionAndPreviewResult.stderr || productionAndPreviewResult.stdout);
  const productionAndPreviewReport = JSON.parse(productionAndPreviewResult.stdout);
  assert.equal(productionAndPreviewReport.evidence.remoteEnvAudit.environmentSummaries.production.baselinePresentCount, 16);
  assert.equal(productionAndPreviewReport.evidence.remoteEnvAudit.environmentSummaries.preview.baselinePresentCount, 0);
  const baselineAction = productionAndPreviewReport.operatorNextActions.find(action => action.id === 'apply-safe-env-baseline');
  assert.ok(baselineAction);
  assert.ok(baselineAction.reason.includes('preview: 16/16 safe baseline names missing'));
  assert.ok(baselineAction.command.includes('--environments preview'));
  assert.ok(baselineAction.command.includes('--preview-branch <non-production-branch>'));
  assert.ok(!baselineAction.command.includes('--environments production,preview'));
  const requiredAction = productionAndPreviewReport.operatorNextActions.find(action => action.id === 'configure-remote-required-env-names');
  assert.ok(requiredAction.reason.includes('production: 13/27 required env names missing'));
  assert.ok(requiredAction.reason.includes('preview: 27/27 required env names missing'));

  console.log('Production evidence remote env audit tests passed.');
} finally {
  fs.rmSync(tempDir, { recursive: true, force: true });
}

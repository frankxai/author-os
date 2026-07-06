#!/usr/bin/env node

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'authoros-cloud-env-apply-'));
const readyFile = path.join(tempDir, 'provider.env');
const invalidFile = path.join(tempDir, 'invalid.env');
const fixtureClerkSecret = ['sk', 'test', 'clerksecret123'].join('_');
const fixtureClerkPublishable = ['pk', 'test', 'clerkpublic123'].join('_');
const fixturePlaceholderSecret = ['sk', 'live', 'replace_me'].join('_');

try {
  fs.writeFileSync(readyFile, [
    `CLERK_SECRET_KEY=${fixtureClerkSecret}`,
    `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=${fixtureClerkPublishable}`,
    '',
  ].join('\n'));
  fs.writeFileSync(invalidFile, [
    `CLERK_SECRET_KEY=${fixturePlaceholderSecret}`,
    '',
  ].join('\n'));

  const readyResult = spawnSync(process.execPath, [
    'bin/author.js',
    'cloud-env',
    '--vercel',
    '--apply-file',
    readyFile,
    '--names',
    'CLERK_SECRET_KEY,NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY',
    '--environments',
    'production,preview',
    '--preview-branch',
    'codex/author-os-preview',
    '--json',
  ], {
    cwd: path.resolve('.'),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 120000,
  });

  assert.equal(readyResult.status, 0, readyResult.stderr || readyResult.stdout);
  assert.ok(!readyResult.stdout.includes(fixtureClerkSecret));
  assert.ok(!readyResult.stdout.includes(fixtureClerkPublishable));
  const readyPlan = JSON.parse(readyResult.stdout);
  assert.equal(readyPlan.status, 'ready');
  assert.equal(readyPlan.readyCount, 2);
  assert.equal(readyPlan.commandCount, 4);
  assert.ok(readyPlan.commands.every(command => command.command.includes('--value <redacted>')));
  assert.ok(readyPlan.commands.some(command => command.command.includes('preview codex/author-os-preview')));

  const invalidResult = spawnSync(process.execPath, [
    'bin/author.js',
    'cloud-env',
    '--vercel',
    '--apply-file',
    invalidFile,
    '--names',
    'CLERK_SECRET_KEY',
    '--environments',
    'production',
    '--json',
    '--require-ready',
  ], {
    cwd: path.resolve('.'),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 120000,
  });

  assert.equal(invalidResult.status, 1, invalidResult.stdout);
  assert.ok(!invalidResult.stdout.includes(fixturePlaceholderSecret));
  const invalidPlan = JSON.parse(invalidResult.stdout);
  assert.equal(invalidPlan.status, 'blocked');
  assert.ok(invalidPlan.invalid.includes('CLERK_SECRET_KEY'));

  console.log('CLI cloud env apply tests passed.');
} finally {
  fs.rmSync(tempDir, { recursive: true, force: true });
}

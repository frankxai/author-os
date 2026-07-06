#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const expectedNodeMajor = Number(process.env.AUTHOROS_EXPECTED_NODE_MAJOR || 24);
const expectedNodeRange = process.env.AUTHOROS_EXPECTED_NODE_RANGE || '>=24 <25';
const expectedPackageManager = process.env.AUTHOROS_EXPECTED_PACKAGE_MANAGER || 'pnpm@11.7.0';
const wantsJson = process.argv.includes('--json');

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf-8'));
}

function addCheck(checks, id, label, pass, detail) {
  checks.push({
    id,
    label,
    status: pass ? 'pass' : 'blocked',
    detail,
  });
}

function readPnpmVersion() {
  const candidates = process.platform === 'win32'
    ? [
      [process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', 'pnpm --version']],
      [process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', 'corepack pnpm --version']],
    ]
    : [
      ['pnpm', ['--version']],
      ['corepack', ['pnpm', '--version']],
    ];

  const failures = [];
  for (const [command, args] of candidates) {
    const result = spawnSync(command, args, {
      cwd: process.cwd(),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 30000,
    });
    if (result.status === 0) {
      return {
        ok: true,
        version: result.stdout.trim(),
        detail: `pnpm ${result.stdout.trim()}`,
      };
    }
    failures.push(result.stderr?.trim() || result.error?.message || `${command} ${args.join(' ')} failed.`);
  }
  return {
    ok: false,
    version: null,
    detail: failures.filter(Boolean).join(' | ') || 'pnpm --version failed.',
  };
}

const rootPackage = readJson(path.resolve('package.json'));
const cockpitPackage = readJson(path.resolve('apps/cockpit/package.json'));
const nodeMajor = Number(process.versions.node.split('.')[0]);
const pnpm = readPnpmVersion();
const expectedPnpmVersion = expectedPackageManager.split('@').at(-1);
const checks = [];

addCheck(
  checks,
  'node-major',
  'Node runtime matches hosted Vercel project',
  nodeMajor === expectedNodeMajor,
  `current=${process.versions.node} expectedMajor=${expectedNodeMajor}.`,
);
addCheck(
  checks,
  'root-engine',
  'Root package declares hosted Node range',
  rootPackage.engines?.node === expectedNodeRange,
  `root engines.node=${rootPackage.engines?.node || 'missing'} expected=${expectedNodeRange}.`,
);
addCheck(
  checks,
  'cockpit-engine',
  'Cockpit package declares hosted Node range',
  cockpitPackage.engines?.node === expectedNodeRange,
  `cockpit engines.node=${cockpitPackage.engines?.node || 'missing'} expected=${expectedNodeRange}.`,
);
addCheck(
  checks,
  'package-manager',
  'Root package pins pnpm',
  rootPackage.packageManager === expectedPackageManager,
  `packageManager=${rootPackage.packageManager || 'missing'} expected=${expectedPackageManager}.`,
);
addCheck(
  checks,
  'pnpm-version',
  'Installed pnpm matches package manager pin',
  pnpm.ok && pnpm.version === expectedPnpmVersion,
  pnpm.ok ? `current=${pnpm.version} expected=${expectedPnpmVersion}.` : pnpm.detail,
);

const blocked = checks.filter(check => check.status === 'blocked');
const report = {
  status: blocked.length ? 'blocked' : 'ready',
  generatedAt: new Date().toISOString(),
  expected: {
    nodeMajor: expectedNodeMajor,
    nodeRange: expectedNodeRange,
    packageManager: expectedPackageManager,
  },
  runtime: {
    node: process.versions.node,
    pnpm: pnpm.version,
  },
  checks,
};

if (wantsJson) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(`AuthorOS runtime contract: ${report.status}`);
  console.log(`  Node: ${report.runtime.node}`);
  console.log(`  pnpm: ${report.runtime.pnpm || 'missing'}`);
  for (const check of checks) {
    const marker = check.status === 'pass' ? 'PASS' : 'BLOCK';
    console.log(`  ${marker.padEnd(5)} ${check.label}: ${check.detail}`);
  }
}

if (blocked.length) process.exit(1);

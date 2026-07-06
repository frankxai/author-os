#!/usr/bin/env node

import { execFileSync } from 'node:child_process';

const relevantPrefixes = [
  '.github/workflows/',
  'apps/cockpit/',
  'packages/',
  'scripts/',
  'bin/author.js',
  'package.json',
  'pnpm-lock.yaml',
  'pnpm-workspace.yaml',
  'vercel.json',
];

function changedFiles() {
  const previousSha = process.env.VERCEL_GIT_PREVIOUS_SHA;
  const currentSha = process.env.VERCEL_GIT_COMMIT_SHA || 'HEAD';
  if (!previousSha) return null;
  try {
    return execFileSync('git', ['diff', '--name-only', previousSha, currentSha], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).split(/\r?\n/).filter(Boolean);
  } catch {
    return null;
  }
}

const files = changedFiles();
if (!files) {
  console.log('No previous commit diff available; continuing Vercel build.');
  process.exit(1);
}

const shouldBuild = files.some(file => relevantPrefixes.some(prefix => file === prefix || file.startsWith(prefix)));
if (shouldBuild) {
  console.log(`Relevant Author Cockpit changes detected (${files.length} file(s)); continuing Vercel build.`);
  process.exit(1);
}

console.log('No Author Cockpit runtime/build changes detected; skipping Vercel build.');
process.exit(0);

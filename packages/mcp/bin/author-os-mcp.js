#!/usr/bin/env node

import readline from 'node:readline';
import { buildMcpToolManifest, callAuthorOsTool } from '../src/tools.js';

const args = process.argv.slice(2);

if (args.includes('--manifest') || args.includes('--tools')) {
  console.log(JSON.stringify(buildMcpToolManifest(), null, 2));
  process.exit(0);
}

if (args.includes('--help') || args.includes('-h')) {
  console.log(`AuthorOS MCP local harness

Usage:
  author-os-mcp --manifest
  author-os-mcp --stdio-lite

The --stdio-lite mode accepts newline-delimited JSON:
  {"id":"1","tool":"read_project_context","input":{"root":"."}}
  {"id":"2","tool":"search_manuscript","input":{"query":"dragon"}}

The package also exposes pure tool definitions for hosted Vercel MCP handlers.`);
  process.exit(0);
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false,
});

process.stderr.write('AuthorOS MCP stdio-lite harness ready. Send newline-delimited JSON tool calls.\n');

rl.on('line', async line => {
  const raw = line.trim();
  if (!raw) return;
  try {
    const message = JSON.parse(raw);
    const name = message.tool || message.name || message.method;
    const input = message.input || message.params || {};
    if (name === 'tools/list') {
      console.log(JSON.stringify({ id: message.id || null, result: buildMcpToolManifest() }));
      return;
    }
    const result = await callAuthorOsTool(name, input);
    console.log(JSON.stringify({ id: message.id || null, result }));
  } catch (error) {
    console.log(JSON.stringify({
      id: null,
      error: {
        code: 'AUTHOR_OS_MCP_ERROR',
        message: error.message,
      },
    }));
  }
});

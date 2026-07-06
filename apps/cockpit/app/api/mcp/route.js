import { createWorkspaceAccessDecision } from '@author-os/cloud';
import { buildMcpToolManifest } from '@author-os/mcp/manifest';
import {
  createTenantContextFromRequest,
  errorResponse,
  getMcpWwwAuthenticateHeader,
  getHostedProjectService,
  getHostedWorkflowService,
} from '../../../lib/hosted.js';

const toolManifest = buildMcpToolManifest();

const toolContracts = {
  list_projects: { scope: 'authoros:read', requiredRole: 'viewer' },
  read_project_context: { scope: 'authoros:read', requiredRole: 'viewer' },
  read_canon: { scope: 'authoros:read', requiredRole: 'viewer' },
  search_manuscript: { scope: 'authoros:read', requiredRole: 'viewer' },
  create_scene: { scope: 'authoros:write', requiredRole: 'editor' },
  revise_scene: { scope: 'authoros:agents', requiredRole: 'agent' },
  run_continuity_check: { scope: 'authoros:agents', requiredRole: 'agent' },
  generate_character_board: { scope: 'authoros:agents', requiredRole: 'agent' },
  export_book: { scope: 'authoros:export', requiredRole: 'agent' },
  get_run_status: { scope: 'authoros:read', requiredRole: 'viewer' },
  read_publishing_readiness: { scope: 'authoros:read', requiredRole: 'viewer' },
  list_packs: { scope: 'authoros:read', requiredRole: 'viewer' },
  install_pack: { scope: 'authoros:write', requiredRole: 'editor' },
};

const manifest = {
  ...toolManifest,
  name: 'author-os',
  version: '0.2.0',
  description: 'Vercel-hosted AuthorOS MCP endpoint facade. Production tool execution is tenant-scoped and adapter-backed; local file execution is served by author-os-mcp.',
  tools: toolManifest.tools.map(tool => ({
    ...tool,
    scope: toolContracts[tool.name]?.scope || 'authoros:read',
    requiredRole: toolContracts[tool.name]?.requiredRole || 'viewer',
  })),
  contracts: toolContracts,
};

const protocolVersion = '2025-06-18';
const mutationTools = new Set([
  'create_scene',
  'revise_scene',
  'run_continuity_check',
  'generate_character_board',
  'export_book',
  'install_pack',
]);
const resourceKinds = {
  context: {
    name: 'project_context',
    title: 'Project Context',
    description: 'Compact manuscript, canon, publishing, and agent context for an AuthorOS project.',
  },
  canon: {
    name: 'project_canon',
    title: 'Project Canon',
    description: 'Living codex, entities, relationships, timeline, and continuity facts for an AuthorOS project.',
  },
  readiness: {
    name: 'project_readiness',
    title: 'Publishing Readiness',
    description: 'Publishing and export readiness, including continuity, approvals, assets, entitlements, and credit state.',
  },
};
const promptDefinitions = [
  {
    name: 'authoros_project_brief',
    title: 'AuthorOS Project Brief',
    description: 'Prepare an agent to understand the manuscript, canon, cockpit state, and next best moves.',
    arguments: [
      { name: 'projectId', description: 'AuthorOS project id.', required: true },
    ],
  },
  {
    name: 'authoros_continuity_audit',
    title: 'Continuity Audit',
    description: 'Guide an agent through a cautious continuity review using project context and canon resources.',
    arguments: [
      { name: 'projectId', description: 'AuthorOS project id.', required: true },
    ],
  },
  {
    name: 'authoros_scene_revision',
    title: 'Scene Revision Pass',
    description: 'Prepare a human-reviewable scene revision pass without direct application.',
    arguments: [
      { name: 'projectId', description: 'AuthorOS project id.', required: true },
      { name: 'sceneId', description: 'Optional scene id to focus the revision.', required: false },
    ],
  },
  {
    name: 'authoros_export_readiness',
    title: 'Export Readiness Review',
    description: 'Check readiness blockers before manuscript export or launch operations.',
    arguments: [
      { name: 'projectId', description: 'AuthorOS project id.', required: true },
    ],
  },
];

export async function GET() {
  return Response.json({
    transport: 'http-json',
    protocol: 'json-rpc-2.0',
    protocolVersion,
    note: 'Use this route as the Vercel-hosted AuthorOS tool endpoint. POST execution requires hosted tenant auth when AUTHOROS_REQUIRE_AUTH=true.',
    capabilities: createMcpCapabilities(),
    jsonRpcMethods: ['initialize', 'tools/list', 'tools/call', 'resources/list', 'resources/read', 'resources/templates/list', 'prompts/list', 'prompts/get', 'ping'],
    tools: manifest.tools,
    resourceTemplates: createMcpResourceTemplates().resourceTemplates,
    prompts: promptDefinitions,
    manifest,
  });
}

function createMcpAccessError(tool, decision) {
  const error = new Error(`Hosted MCP access denied for ${tool}: ${decision.reason}`);
  error.code = decision.reason === 'entitlement_required' ? 'MCP_ENTITLEMENT_REQUIRED' : 'MCP_ACCESS_DENIED';
  error.status = decision.reason === 'entitlement_required' ? 402 : 403;
  error.decision = decision;
  return error;
}

function createUnknownToolError(tool) {
  const error = new Error(`Unknown hosted MCP tool: ${tool || 'missing'}`);
  error.code = 'MCP_TOOL_NOT_FOUND';
  error.status = 404;
  return error;
}

function sanitizeMcpTenant(tenant) {
  return {
    mode: tenant.mode,
    authProvider: tenant.authProvider,
    authSource: tenant.authSource,
    authVerified: tenant.authVerified,
    userId: tenant.userId ? 'present' : null,
    workspaceId: tenant.workspaceId,
    plan: tenant.plan,
    roles: tenant.roles,
    requestId: tenant.requestId,
  };
}

function readToolInput(body = {}) {
  const input = body.input || body.params || body.arguments || {};
  return input && typeof input === 'object' ? input : {};
}

function resolveProjectId(tool, input = {}, body = {}) {
  if (input.projectId) return input.projectId;
  if (body.projectId) return body.projectId;
  if (tool === 'list_projects' || tool === 'list_packs') return null;
  const error = new Error(`Hosted MCP tool ${tool} requires input.projectId.`);
  error.code = 'MCP_PROJECT_ID_REQUIRED';
  error.status = 400;
  throw error;
}

function textContent(data) {
  return {
    result: {
      content: [
        {
          type: 'text',
          text: typeof data === 'string' ? data : JSON.stringify(data, null, 2),
        },
      ],
    },
  };
}

function createMcpCapabilities() {
  return {
    tools: {
      listChanged: false,
    },
    resources: {
      listChanged: false,
    },
    prompts: {
      listChanged: false,
    },
  };
}

function createMcpServerInfo() {
  return {
    name: manifest.name,
    version: manifest.version,
    title: 'Agentic Author OS / Arcanea Author Cockpit',
  };
}

function createJsonRpcResult(id, result) {
  return {
    jsonrpc: '2.0',
    id,
    result,
  };
}

function createJsonRpcError(id, code, message, data = undefined) {
  return {
    jsonrpc: '2.0',
    id: id ?? null,
    error: {
      code,
      message,
      ...(data === undefined ? {} : { data }),
    },
  };
}

function isJsonRpcMessage(body) {
  return body?.jsonrpc === '2.0' && typeof body.method === 'string';
}

function isJsonRpcNotification(body) {
  return isJsonRpcMessage(body) && !Object.hasOwn(body, 'id');
}

function createMcpToolList() {
  return {
    tools: manifest.tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
      _meta: {
        'authoros/scope': tool.scope,
        'authoros/requiredRole': tool.requiredRole,
      },
    })),
  };
}

function createMcpToolCallResult(data) {
  const envelope = {
    status: 'completed',
    ...data,
  };
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(envelope, null, 2),
      },
    ],
    structuredContent: envelope,
  };
}

function createProjectResourceUri(projectId, kind) {
  return `authoros://projects/${encodeURIComponent(projectId)}/${kind}`;
}

function createProjectResource(project, kind) {
  const definition = resourceKinds[kind];
  return {
    uri: createProjectResourceUri(project.id, kind),
    name: `${definition.name}:${project.id}`,
    title: `${project.title} - ${definition.title}`,
    description: definition.description,
    mimeType: 'application/json',
    annotations: {
      audience: ['assistant'],
      priority: kind === 'context' ? 1 : 0.8,
    },
    _meta: {
      'authoros/projectId': project.id,
      'authoros/workspaceId': project.workspaceId,
      'authoros/resourceKind': kind,
      'authoros/plan': project.plan,
    },
  };
}

function createMcpResourceTemplates() {
  return {
    resourceTemplates: Object.entries(resourceKinds).map(([kind, definition]) => ({
      uriTemplate: `authoros://projects/{projectId}/${kind}`,
      name: definition.name,
      title: definition.title,
      description: definition.description,
      mimeType: 'application/json',
      annotations: {
        audience: ['assistant'],
        priority: kind === 'context' ? 1 : 0.8,
      },
      _meta: {
        'authoros/resourceKind': kind,
        'authoros/scope': 'authoros:read',
        'authoros/requiredRole': 'viewer',
      },
    })),
  };
}

function parseProjectResourceUri(uri) {
  const match = String(uri || '').match(/^authoros:\/\/projects\/([^/]+)\/([^/?#]+)$/);
  if (!match) {
    const error = new Error(`Unsupported AuthorOS MCP resource URI: ${uri || 'missing'}`);
    error.code = 'MCP_RESOURCE_NOT_FOUND';
    error.status = 404;
    throw error;
  }
  const projectId = decodeURIComponent(match[1]);
  const kind = decodeURIComponent(match[2]);
  if (!resourceKinds[kind]) {
    const error = new Error(`Unsupported AuthorOS MCP resource kind: ${kind}`);
    error.code = 'MCP_RESOURCE_NOT_FOUND';
    error.status = 404;
    throw error;
  }
  return { projectId, kind };
}

async function createMcpResourceList(request) {
  const tenant = await createTenantContextFromRequest(request, null);
  const projectService = getHostedProjectService();
  const listed = await projectService.listProjects(tenant, { requiredRole: 'viewer' });
  const resources = listed.projects.flatMap(project => Object.keys(resourceKinds).map(kind => createProjectResource(project, kind)));
  return {
    resources,
  };
}

async function readMcpResource(request, uri) {
  const { projectId, kind } = parseProjectResourceUri(uri);
  const tenant = await createTenantContextFromRequest(request, projectId);
  const projectService = getHostedProjectService();
  let data;

  if (kind === 'context') {
    data = await projectService.readProjectContext(projectId, tenant, {});
  } else if (kind === 'canon') {
    data = await projectService.readCanon(projectId, tenant, {});
  } else if (kind === 'readiness') {
    data = await projectService.readPublishingReadiness(projectId, tenant, {});
  }

  return {
    contents: [
      {
        uri,
        mimeType: 'application/json',
        text: JSON.stringify({
          status: 'completed',
          resourceKind: kind,
          projectId,
          tenant: sanitizeMcpTenant(tenant),
          data,
        }, null, 2),
      },
    ],
  };
}

function createMcpPromptList() {
  return {
    prompts: promptDefinitions,
  };
}

function getRequiredPromptArgument(params, name) {
  const value = params?.arguments?.[name];
  if (value) return String(value);
  const error = new Error(`Prompt requires argument: ${name}`);
  error.code = 'MCP_PROMPT_ARGUMENT_REQUIRED';
  error.status = 400;
  throw error;
}

function createPromptMessage(text) {
  return {
    role: 'user',
    content: {
      type: 'text',
      text,
    },
  };
}

function createMcpPrompt(params = {}) {
  const name = params.name;
  const definition = promptDefinitions.find(prompt => prompt.name === name);
  if (!definition) {
    const error = new Error(`Unknown AuthorOS MCP prompt: ${name || 'missing'}`);
    error.code = 'MCP_PROMPT_NOT_FOUND';
    error.status = 404;
    throw error;
  }

  const projectId = getRequiredPromptArgument(params, 'projectId');
  const contextUri = createProjectResourceUri(projectId, 'context');
  const canonUri = createProjectResourceUri(projectId, 'canon');
  const readinessUri = createProjectResourceUri(projectId, 'readiness');
  const sceneId = params.arguments?.sceneId ? String(params.arguments.sceneId) : null;

  const promptText = {
    authoros_project_brief: [
      'Prepare a concise AuthorOS project brief for the author.',
      `Read ${contextUri}, ${canonUri}, and ${readinessUri} before recommending next moves.`,
      'Preserve author agency: do not invent manuscript facts, and distinguish observed graph state from suggestions.',
    ],
    authoros_continuity_audit: [
      'Run a continuity audit plan for this AuthorOS project.',
      `Use ${contextUri} for manuscript/cockpit state and ${canonUri} for approved or provisional canon.`,
      'Return issues with evidence links, severity, affected scene/entity ids, and proposed human-reviewable fixes.',
    ],
    authoros_scene_revision: [
      'Prepare a scene revision pass that creates suggestions only.',
      `Use ${contextUri} and ${canonUri} first.${sceneId ? ` Focus on scene ${sceneId}.` : ''}`,
      'Never apply prose directly. Use revise_scene so the author can approve, reject, or condition the change.',
    ],
    authoros_export_readiness: [
      'Review whether this AuthorOS project is ready for export.',
      `Read ${readinessUri} and inspect blockers before calling export_book.`,
      'If blocked, return the smallest ordered set of actions needed before export.',
    ],
  }[name];

  return {
    description: definition.description,
    messages: [
      createPromptMessage(promptText.join('\n')),
    ],
  };
}

async function executeHostedMcpTool(tool, projectId, tenant, input) {
  const projectService = getHostedProjectService();
  const workflowService = getHostedWorkflowService();

  switch (tool) {
    case 'list_projects':
      return projectService.listProjects(tenant, input);
    case 'read_project_context':
      return projectService.readProjectContext(projectId, tenant, input);
    case 'read_canon':
      return projectService.readCanon(projectId, tenant, input);
    case 'search_manuscript':
      return projectService.searchManuscript(projectId, tenant, input);
    case 'create_scene':
      return workflowService.startAgentRun(projectId, tenant, { ...input, taskType: 'create_scene' });
    case 'revise_scene':
      return workflowService.startAgentRun(projectId, tenant, { ...input, taskType: 'revise_scene' });
    case 'run_continuity_check':
      return workflowService.startAgentRun(projectId, tenant, { ...input, taskType: 'run_continuity_check' });
    case 'generate_character_board':
      return workflowService.startAgentRun(projectId, tenant, { ...input, taskType: 'generate_character_board' });
    case 'export_book':
      return workflowService.startAgentRun(projectId, tenant, { ...input, taskType: 'export_book' });
    case 'get_run_status':
      return projectService.getRunStatus(projectId, tenant, input);
    case 'read_publishing_readiness':
      return projectService.readPublishingReadiness(projectId, tenant, input);
    case 'list_packs':
      return projectService.listPacks(tenant, input);
    case 'install_pack':
      return projectService.installPack(projectId, tenant, input);
    default:
      throw createUnknownToolError(tool);
  }
}

async function executeHostedMcpToolEnvelope(tool, projectId, tenant, input, contract) {
  const data = await executeHostedMcpTool(tool, projectId, tenant, input);
  return {
    tool,
    scope: contract.scope,
    requiredRole: contract.requiredRole,
    tenant: sanitizeMcpTenant(tenant),
    data,
  };
}

async function assertHostedMcpToolAccess(tool, request, body, input) {
  const contract = manifest.contracts[tool];
  if (!contract) throw createUnknownToolError(tool);
  const projectId = resolveProjectId(tool, input, body);
  const tenant = await createTenantContextFromRequest(request, projectId);
  const access = createWorkspaceAccessDecision(tenant, {
    requiredFeature: 'hosted-cockpit',
    requiredRole: contract.requiredRole,
  });
  if (!access.allowed) throw createMcpAccessError(tool, access);
  return {
    contract,
    projectId,
    tenant,
  };
}

function jsonRpcErrorCode(error) {
  if (error.code === 'MCP_TOOL_NOT_FOUND') return -32601;
  if (error.code === 'MCP_RESOURCE_NOT_FOUND') return -32004;
  if (error.code === 'MCP_PROMPT_NOT_FOUND') return -32005;
  if (error.code === 'MCP_PROJECT_ID_REQUIRED') return -32602;
  if (error.code === 'MCP_PROMPT_ARGUMENT_REQUIRED') return -32602;
  if (error.status === 400) return -32602;
  if (error.status === 401) return -32001;
  if (error.status === 402) return -32002;
  if (error.status === 403) return -32003;
  return -32000;
}

async function handleJsonRpcMessage(message, request) {
  const id = Object.hasOwn(message, 'id') ? message.id : null;

  if (message.method === 'notifications/initialized') {
    return null;
  }

  if (message.method === 'initialize') {
    return createJsonRpcResult(id, {
      protocolVersion,
      capabilities: createMcpCapabilities(),
      serverInfo: createMcpServerInfo(),
      instructions: 'Use tools/list for the AuthorOS tool catalog and tools/call for tenant-scoped project, canon, manuscript, agent, and export operations.',
    });
  }

  if (message.method === 'ping') {
    return createJsonRpcResult(id, {});
  }

  if (message.method === 'tools/list') {
    return createJsonRpcResult(id, createMcpToolList());
  }

  if (message.method === 'resources/list') {
    try {
      return createJsonRpcResult(id, await createMcpResourceList(request));
    } catch (error) {
      error.jsonRpcResponse = createJsonRpcError(id, jsonRpcErrorCode(error), error.message, {
        code: error.code || 'HOSTED_AUTHOR_OS_ERROR',
        status: error.status || 500,
      });
      if ((error.status || 500) === 401) throw error;
      return error.jsonRpcResponse;
    }
  }

  if (message.method === 'resources/templates/list') {
    return createJsonRpcResult(id, createMcpResourceTemplates());
  }

  if (message.method === 'resources/read') {
    try {
      return createJsonRpcResult(id, await readMcpResource(request, message.params?.uri));
    } catch (error) {
      error.jsonRpcResponse = createJsonRpcError(id, jsonRpcErrorCode(error), error.message, {
        code: error.code || 'HOSTED_AUTHOR_OS_ERROR',
        status: error.status || 500,
      });
      if ((error.status || 500) === 401) throw error;
      return error.jsonRpcResponse;
    }
  }

  if (message.method === 'prompts/list') {
    return createJsonRpcResult(id, createMcpPromptList());
  }

  if (message.method === 'prompts/get') {
    try {
      return createJsonRpcResult(id, createMcpPrompt(message.params || {}));
    } catch (error) {
      error.jsonRpcResponse = createJsonRpcError(id, jsonRpcErrorCode(error), error.message, {
        code: error.code || 'HOSTED_AUTHOR_OS_ERROR',
        status: error.status || 500,
      });
      return error.jsonRpcResponse;
    }
  }

  if (message.method !== 'tools/call') {
    return createJsonRpcError(id, -32601, `Unsupported AuthorOS MCP method: ${message.method}`);
  }

  const params = message.params || {};
  const tool = params.name;
  const input = params.arguments || params.input || {};
  if (!tool) return createJsonRpcError(id, -32602, 'tools/call requires params.name.');
  if (!input || typeof input !== 'object') return createJsonRpcError(id, -32602, 'tools/call requires object params.arguments.');

  try {
    const { contract, projectId, tenant } = await assertHostedMcpToolAccess(tool, request, message, input);
    const envelope = await executeHostedMcpToolEnvelope(tool, projectId, tenant, input, contract);
    return createJsonRpcResult(id, createMcpToolCallResult(envelope));
  } catch (error) {
    error.jsonRpcResponse = createJsonRpcError(id, jsonRpcErrorCode(error), error.message, {
      code: error.code || 'HOSTED_AUTHOR_OS_ERROR',
      status: error.status || 500,
    });
    if ((error.status || 500) === 401) throw error;
    return createJsonRpcError(id, jsonRpcErrorCode(error), error.message, {
      code: error.code || 'HOSTED_AUTHOR_OS_ERROR',
      status: error.status || 500,
    });
  }
}

export async function POST(request) {
  let requiredScope = 'authoros:read';
  try {
    const body = await request.json();
    if (Array.isArray(body)) {
      const responses = [];
      for (const message of body) {
        if (!isJsonRpcMessage(message)) {
          responses.push(createJsonRpcError(null, -32600, 'Invalid JSON-RPC message.'));
          continue;
        }
        const response = await handleJsonRpcMessage(message, request);
        if (response) responses.push(response);
      }
      return responses.length ? Response.json(responses) : new Response(null, { status: 204 });
    }

    if (isJsonRpcMessage(body)) {
      if (body.method === 'tools/call' && body.params?.name && manifest.contracts[body.params.name]) {
        requiredScope = manifest.contracts[body.params.name].scope;
      }
      const response = await handleJsonRpcMessage(body, request);
      return response ? Response.json(response) : new Response(null, { status: 204 });
    }

    const tool = body.tool || body.name || body.method;
    const contract = manifest.contracts[tool];
    const input = readToolInput(body);
    if (!contract) throw createUnknownToolError(tool);
    requiredScope = contract.scope;
    const { projectId, tenant } = await assertHostedMcpToolAccess(tool, request, body, input);
    const data = await executeHostedMcpToolEnvelope(tool, projectId, tenant, input, contract);
    return Response.json(textContent({
      status: 'completed',
      ...data,
    }), { status: mutationTools.has(tool) ? 202 : 200 });
  } catch (error) {
    const headers = {};
    if ((error.status || 500) === 401) {
      headers['www-authenticate'] = getMcpWwwAuthenticateHeader(request, [requiredScope]);
    }
    if (error.jsonRpcResponse) {
      return Response.json(error.jsonRpcResponse, {
        status: error.status || 500,
        headers,
      });
    }
    return errorResponse(error, { headers });
  }
}

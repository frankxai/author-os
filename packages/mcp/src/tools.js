import {
  buildProjectContext,
  buildPackRegistry,
  createAgentRun,
  createPublishingReadinessReport,
  exportBookMarkdown,
  generateCharacterBoard,
  runContinuityCheck,
} from '../../core/src/index.js';
import {
  appendLocalAuditArtifacts,
  createLocalScene,
  createLocalRevisionSuggestion,
  exportLocalProject,
  installLocalPack,
  readAuthorProject,
  readCanon,
  runLocalContinuity,
  searchLocalProject,
} from '../../local/src/index.js';
export { authorOsToolDefinitions, buildMcpToolManifest } from './manifest.js';
import { authorOsToolDefinitions } from './manifest.js';

function rootFrom(input = {}, fallbackRoot = process.cwd()) {
  return input.root || fallbackRoot;
}

function textResult(data) {
  return {
    content: [
      {
        type: 'text',
        text: typeof data === 'string' ? data : JSON.stringify(data, null, 2),
      },
    ],
  };
}

export async function callAuthorOsTool(name, input = {}, options = {}) {
  const root = rootFrom(input, options.root);

  switch (name) {
    case 'list_projects': {
      const project = readAuthorProject(root);
      return textResult({
        projects: [
          {
            id: project.project.id,
            title: project.project.title,
            root,
            stage: project.project.stage,
            plan: project.workspace.plan,
          },
        ],
      });
    }
    case 'read_project_context': {
      const project = readAuthorProject(root);
      return textResult(buildProjectContext(project, {
        sceneLimit: input.sceneLimit || 8,
        entityLimit: input.entityLimit || 16,
      }));
    }
    case 'read_canon': {
      return textResult({ canon: readCanon(root) });
    }
    case 'search_manuscript': {
      return textResult({
        query: input.query,
        results: searchLocalProject(root, input.query, { limit: input.limit || 12 }),
      });
    }
    case 'create_scene': {
      const created = createLocalScene(root, input);
      const run = createAgentRun({
        taskType: 'create_scene',
        status: 'completed',
        promptScope: ['scene-input'],
        output: { sceneId: created.scene.id },
      });
      appendLocalAuditArtifacts(root, { agentRuns: [run] });
      return textResult({
        success: true,
        scene: created.scene,
        file: created.file,
        run,
      });
    }
    case 'revise_scene': {
      if (input.apply) {
        return textResult({
          success: false,
          error: {
            code: 'APPROVAL_REQUIRED',
            message: 'Direct apply is intentionally disabled. Return a suggestion, then apply through an approval workflow.',
            recoverable: true,
          },
        });
      }
      let revision;
      try {
        revision = createLocalRevisionSuggestion(root, input);
      } catch (error) {
        if (error.code !== 'SCENE_NOT_FOUND') throw error;
        return textResult({ success: false, error: { code: 'SCENE_NOT_FOUND', message: `Scene not found: ${input.sceneId}` } });
      }
      return textResult({
        success: true,
        suggestion: revision.suggestion,
        run: revision.run,
        creditLedgerEntry: revision.creditLedgerEntry,
        route: revision.route,
        graphFile: revision.graphFile,
      });
    }
    case 'run_continuity_check': {
      if (input.save === false) {
        return textResult(runContinuityCheck(readAuthorProject(root)));
      }
      return textResult(runLocalContinuity(root));
    }
    case 'generate_character_board': {
      return textResult(generateCharacterBoard(readAuthorProject(root), input.character));
    }
    case 'export_book': {
      const format = input.format || 'markdown';
      if (['markdown', 'md'].includes(format)) return textResult(exportLocalProject(root, format));
      return textResult({
        success: false,
        error: {
          code: 'UNSUPPORTED_LOCAL_FORMAT',
          message: 'Local MCP export currently supports markdown. Use hosted export workers or CLI pandoc flow for DOCX/EPUB/PDF.',
        },
      });
    }
    case 'get_run_status': {
      const project = readAuthorProject(root);
      const run = project.agentRuns.find(item => item.id === input.runId) || null;
      return textResult({
        runId: input.runId,
        found: Boolean(run),
        run,
        fallback: run ? null : 'No persisted run found in the local graph yet.',
      });
    }
    case 'read_publishing_readiness': {
      return textResult(createPublishingReadinessReport(readAuthorProject(root)));
    }
    case 'list_packs': {
      return textResult(buildPackRegistry());
    }
    case 'install_pack': {
      const result = installLocalPack(root, input.packId || 'authoros-foundry-pack', { installedBy: 'author-os-mcp' });
      return textResult({
        success: true,
        installed: result.installed,
        skipped: result.skipped,
        graphFile: result.graphFile,
        receiptFile: result.receiptFile,
        noProseGenerated: result.noProseGenerated,
      });
    }
    default:
      return textResult({
        success: false,
        error: {
          code: 'UNKNOWN_TOOL',
          message: `Unknown AuthorOS tool: ${name}`,
          availableTools: authorOsToolDefinitions.map(tool => tool.name),
        },
      });
  }
}

export function mapToAiSdkTools() {
  return Object.fromEntries(authorOsToolDefinitions.map(tool => [
    tool.name,
    {
      description: tool.description,
      inputSchema: tool.inputSchema,
      execute: async input => callAuthorOsTool(tool.name, input),
    },
  ]));
}

export function exportProjectMarkdown(project) {
  return exportBookMarkdown(project);
}

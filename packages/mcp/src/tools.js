import {
  buildProjectContext,
  buildPackRegistry,
  createAgentRun,
  createPublishingReadinessReport,
  exportBookMarkdown,
  generateCharacterBoard,
  runContinuityCheck,
  extractInlineTags,
  resolveMentionsAgainstEntities,
  createCharacterDiamond,
  runSevenPassAudit,
  auditAntiSlop,
  formatNotionSceneBlocks,
  buildEpubPackageStructure,
  generateSensoryExpansion,
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
      if (format === 'epub') {
        try { return textResult(exportLocalProject(root, format)); }
        catch (error) { return textResult({ success: false, error: { code: 'EPUB_EXPORT_REFUSED', message: error.message } }); }
      }
      return textResult({
        success: false,
        error: {
          code: 'UNSUPPORTED_LOCAL_FORMAT',
          message: 'Local MCP export supports Markdown and text EPUB. Use hosted export workers or CLI pandoc flow for DOCX/PDF.',
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
    case 'extract_codex_entities': {
      const project = readAuthorProject(root);
      const tags = extractInlineTags(input.text || '');
      const resolution = resolveMentionsAgainstEntities(tags, project.entities || []);
      return textResult({
        extractedTags: tags,
        resolved: resolution.resolved,
        unmapped: resolution.unmapped,
      });
    }
    case 'create_character_diamond': {
      const diamond = createCharacterDiamond(input);
      return textResult({
        success: true,
        diamond,
      });
    }
    case 'run_seven_pass_revision': {
      const project = readAuthorProject(root);
      let text = input.text;
      let sceneMeta = { pov: input.pov };

      if (input.sceneId) {
        const found = (project.scenes || []).find(s => s.id === input.sceneId);
        if (found) {
          text = text || found.text;
          sceneMeta = { ...found, ...sceneMeta };
        }
      }

      const report = runSevenPassAudit(text || '', sceneMeta, project);
      return textResult({
        success: true,
        sceneId: input.sceneId || null,
        report,
      });
    }
    case 'anti_slop_lint': {
      const report = auditAntiSlop(input.text || '');
      return textResult({
        success: true,
        report,
      });
    }
    case 'format_notion_blocks': {
      const project = readAuthorProject(root);
      const scene = (project.scenes || []).find(s => s.id === input.sceneId);
      if (!scene) {
        return textResult({
          success: false,
          error: { code: 'SCENE_NOT_FOUND', message: `Scene not found: ${input.sceneId}` },
        });
      }
      const audit = runSevenPassAudit(scene.text || '', scene, project);
      const blocks = formatNotionSceneBlocks(scene, audit);
      return textResult({
        success: true,
        sceneId: scene.id,
        blockCount: blocks.length,
        blocks,
      });
    }
    case 'export_epub_manifest': {
      const project = readAuthorProject(root);
      try { return textResult({ success: true, epub: buildEpubPackageStructure(project) }); }
      catch (error) { return textResult({ success: false, error: { code: 'EPUB_EXPORT_REFUSED', message: error.message } }); }
    }
    case 'describe_sensory_expansion': {
      const result = generateSensoryExpansion({
        focus: input.focus,
        genre: input.genre || 'mythic-fantasy',
        senses: input.senses,
      });
      return textResult({
        success: true,
        ...result,
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

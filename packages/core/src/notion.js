/**
 * AuthorOS Notion Bi-Directional Bridge & Schema Formatter
 * Allows authors working in Notion to interact with the full AuthorOS intelligence,
 * including Living Codex, Seven-Pass Revision, and Continuity checks.
 */

export const NOTION_DATABASE_TEMPLATES = {
  manuscript: {
    title: '📚 AuthorOS Manuscript Hub',
    description: 'Master index of Books, Chapters, and Scenes',
    properties: {
      Title: { title: {} },
      Book: { select: { options: [] } },
      ChapterOrder: { number: { format: 'number' } },
      SceneOrder: { number: { format: 'number' } },
      POV: { select: { options: [] } },
      Status: {
        select: {
          options: [
            { name: 'Planned', color: 'gray' },
            { name: 'Drafting', color: 'blue' },
            { name: 'Needs Review', color: 'yellow' },
            { name: 'Polished', color: 'green' },
            { name: 'Locked', color: 'purple' },
          ],
        },
      },
      WordCount: { number: { format: 'number' } },
      QualityScore: { number: { format: 'number' } },
      ContinuityStatus: {
        select: {
          options: [
            { name: 'Clean', color: 'green' },
            { name: 'Warning', color: 'yellow' },
            { name: 'Violation', color: 'red' },
          ],
        },
      },
    },
  },
  codex: {
    title: '🧬 AuthorOS Living Codex',
    description: 'Story Bible: Characters, Locations, Rules, Factions, and Lore',
    properties: {
      Name: { title: {} },
      Kind: {
        select: {
          options: [
            { name: 'Character', color: 'blue' },
            { name: 'Location', color: 'green' },
            { name: 'Rule', color: 'purple' },
            { name: 'Faction', color: 'orange' },
            { name: 'Object', color: 'pink' },
            { name: 'Lore', color: 'brown' },
          ],
        },
      },
      Aliases: { multi_select: { options: [] } },
      CoreSummary: { rich_text: {} },
      VoiceTone: { rich_text: {} },
      AppearanceCount: { number: { format: 'number' } },
    },
  },
  editorialQueue: {
    title: '🔍 AuthorOS Editorial & Revision Queue',
    description: 'Actionable suggestions from the 12-Desk Specialist Agent Swarm',
    properties: {
      Issue: { title: {} },
      Pass: {
        select: {
          options: [
            { name: 'Structural', color: 'blue' },
            { name: 'Character', color: 'purple' },
            { name: 'Scene Function', color: 'orange' },
            { name: 'Dialogue & Subtext', color: 'pink' },
            { name: 'Prose & Anti-Slop', color: 'red' },
            { name: 'Continuity', color: 'yellow' },
            { name: 'Polish', color: 'green' },
          ],
        },
      },
      TargetScene: { rich_text: {} },
      Suggestion: { rich_text: {} },
      Status: {
        select: {
          options: [
            { name: 'Pending Review', color: 'yellow' },
            { name: 'Approved', color: 'green' },
            { name: 'Rejected', color: 'gray' },
          ],
        },
      },
    },
  },
};

/**
 * Formats an AuthorOS scene and its Seven-Pass audit report into clean Notion blocks.
 */
export function formatNotionSceneBlocks(scene = {}, auditReport = null) {
  const blocks = [];

  // Scene Header
  blocks.push({
    object: 'block',
    type: 'heading_2',
    heading_2: {
      rich_text: [{ type: 'text', text: { content: scene.title || 'Untitled Scene' } }],
    },
  });

  // Scene Synopsis Callout
  if (scene.synopsis) {
    blocks.push({
      object: 'block',
      type: 'callout',
      callout: {
        rich_text: [{ type: 'text', text: { content: `🎯 Synopsis: ${scene.synopsis}` } }],
        icon: { emoji: '🎬' },
        color: 'gray_background',
      },
    });
  }

  // Audit Score Callout (if available)
  if (auditReport) {
    const emoji = auditReport.overallScore >= 85 ? '✨' : auditReport.overallScore >= 70 ? '⚠️' : '🚨';
    const color = auditReport.overallScore >= 85 ? 'green_background' : auditReport.overallScore >= 70 ? 'yellow_background' : 'red_background';
    blocks.push({
      object: 'block',
      type: 'callout',
      callout: {
        rich_text: [
          {
            type: 'text',
            text: {
              content: `AuthorOS Quality Score: ${auditReport.overallScore}/100 (${auditReport.readiness}) | Anti-Slop Score: ${auditReport.antiSlopSummary.score}/100`,
            },
          },
        ],
        icon: { emoji },
        color,
      },
    });
  }

  // Prose paragraphs
  const rawText = scene.text || '';
  const paragraphs = rawText.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
  for (const paragraph of paragraphs) {
    blocks.push({
      object: 'block',
      type: 'paragraph',
      paragraph: {
        rich_text: [{ type: 'text', text: { content: paragraph } }],
      },
    });
  }

  // Actionable Agent Findings Toggle
  if (auditReport && auditReport.passes) {
    const findingsChildren = [];
    for (const pass of auditReport.passes) {
      if (pass.findings && pass.findings.length > 0) {
        for (const finding of pass.findings) {
          findingsChildren.push({
            object: 'block',
            type: 'bulleted_list_item',
            bulleted_list_item: {
              rich_text: [
                { type: 'text', text: { content: `[${pass.name}] `, annotations: { bold: true } } },
                { type: 'text', text: { content: finding } },
              ],
            },
          });
        }
      }
    }

    if (findingsChildren.length > 0) {
      blocks.push({
        object: 'block',
        type: 'toggle',
        toggle: {
          rich_text: [{ type: 'text', text: { content: `🔍 12-Desk Agent Editorial Suggestions (${findingsChildren.length})` } }],
          children: findingsChildren,
        },
      });
    }
  }

  return blocks;
}

/**
 * Parses Notion blocks back into raw prose and AuthorOS scene properties.
 */
export function parseNotionBlocksToSceneText(blocks = []) {
  const paragraphs = [];
  for (const block of blocks) {
    if (block.type === 'paragraph' && block.paragraph?.rich_text) {
      const text = block.paragraph.rich_text.map(t => t.plain_text || t.text?.content || '').join('');
      if (text.trim()) paragraphs.push(text.trim());
    }
  }
  return paragraphs.join('\n\n');
}

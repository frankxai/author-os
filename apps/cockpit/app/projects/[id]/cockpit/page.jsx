import { headers } from 'next/headers';
import {
  createTenantContextFromHeaders,
  getHostedProjectService,
} from '../../../../lib/hosted.js';

function Metric({ label, value, tone = 'neutral' }) {
  return (
    <div className={`metric metric-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function StatusDot({ tone = 'neutral' }) {
  return <span className={`status-dot status-${tone}`} aria-hidden="true" />;
}

function SceneCard({ scene }) {
  const tone = scene.status === 'needs_review' ? 'warn' : scene.status === 'drafting' ? 'active' : 'neutral';
  return (
    <article className="scene-card">
      <div className="scene-card-top">
        <StatusDot tone={tone} />
        <span>{scene.status || 'planned'}</span>
        <span>{scene.wordCount} words</span>
      </div>
      <h3>{scene.title}</h3>
      <p>{scene.synopsis || 'No synopsis yet.'}</p>
      <div className="tag-row">
        {(scene.tags || []).slice(0, 3).map(tag => <span key={tag}>{tag}</span>)}
      </div>
    </article>
  );
}

function CanvasNode({ node }) {
  return (
    <div className={`canvas-node node-${node.kind}`} style={{ left: `${node.x}px`, top: `${node.y}px` }}>
      <span>{node.kind}</span>
      <strong>{node.title}</strong>
      <small>{node.summary}</small>
    </div>
  );
}

function TimelineItem({ event }) {
  return (
    <li>
      <span>{event.storyDate || `Plot ${event.plotOrder || ''}`}</span>
      <strong>{event.title}</strong>
    </li>
  );
}

export default async function CockpitPage({ params }) {
  const { id } = await params;
  const requestHeaders = await headers();
  const tenant = await createTenantContextFromHeaders(requestHeaders, id);
  const service = getHostedProjectService();
  const hosted = await service.readCockpit(id, tenant);
  const cockpit = hosted.cockpit;
  const { context } = cockpit;
  const continuityTone = cockpit.continuity.issueCount ? 'warn' : 'clear';
  const installedPacks = context.installedPacks || [];

  return (
    <main className="cockpit-shell" data-cockpit-shell>
      <header className="topbar">
        <div>
          <p className="eyebrow">Arcanea Author Cockpit</p>
          <h1>{context.project.title}</h1>
        </div>
        <nav aria-label="Cockpit views">
          <a href="/projects">Projects</a>
          <a href="#canvas">Canvas</a>
          <a href="#codex">Codex</a>
          <a href="#agents">Agents</a>
          <a href="#publish">Publish</a>
          <a href="/setup">Setup</a>
          <a href="/ops">Ops</a>
          <a href="/billing">Billing</a>
        </nav>
        <div className="project-id">Project {id}</div>
      </header>

      <section className="cockpit-grid" aria-label="Author cockpit">
        <aside className="spine-panel" aria-label="Manuscript spine" data-manuscript-spine>
          <div className="panel-heading">
            <span>Manuscript</span>
            <strong>{context.stats.wordCount} words</strong>
          </div>
          <div className="progress-track">
            <span style={{ width: `${Math.min(context.stats.targetProgress || 0, 100)}%` }} />
          </div>
          <div className="chapter-list">
            {cockpit.manuscriptSpine.map(chapter => (
              <button type="button" key={chapter.id}>
                <span>{chapter.title}</span>
                <small>{chapter.sceneCount} scenes / {chapter.wordCount} words</small>
              </button>
            ))}
          </div>
          <div className="spine-footer">
            <Metric label="Scenes" value={context.stats.scenes} />
            <Metric label="Canon" value={context.stats.entities} />
          </div>
        </aside>

        <section className="story-surface" data-story-surface>
          <div className="surface-header">
            <div>
              <p className="eyebrow">Living Story Surface</p>
              <h2>Canvas, corkboard, timeline, and graph in one flow.</h2>
            </div>
            <div className="surface-actions" aria-label="Cockpit actions">
              <button type="button">Run check</button>
              <button type="button">New scene</button>
              <button type="button">Export</button>
            </div>
          </div>

          <div className="metrics-row">
            <Metric label="Chapters" value={context.stats.chapters} />
            <Metric label="Relationships" value={context.stats.relationships} tone="teal" />
            <Metric label="Assets" value={context.stats.assets} tone="gold" />
            <Metric label="Open tasks" value={context.stats.openTasks} tone="rose" />
          </div>

          <section className="canvas-panel" id="canvas" aria-label="Visual story canvas" data-story-canvas>
            <div className="panel-heading">
              <span>Story Canvas</span>
              <strong>{cockpit.canvas.title} / {cockpit.canvas.nodes.length} nodes</strong>
            </div>
            <div className="canvas-stage" aria-label="Scrollable story canvas workspace">
              <div className="canvas-gridline" />
              {cockpit.canvas.nodes.map(node => <CanvasNode key={node.id} node={node} />)}
            </div>
          </section>

          <section className="corkboard-panel" aria-label="Scene corkboard" data-corkboard>
            <div className="panel-heading">
              <span>Corkboard</span>
              <strong>Act I</strong>
            </div>
            <div className="scene-grid">
              {cockpit.corkboard.map(scene => <SceneCard key={scene.id} scene={scene} />)}
            </div>
          </section>

          <section className="lower-grid">
            <div className="graph-panel" id="codex">
              <div className="panel-heading">
                <span>Relationship Graph</span>
                <strong>{cockpit.relationshipGraph.edges.length} edges</strong>
              </div>
              <div className="graph-list">
                {cockpit.relationshipGraph.edges.map(edge => (
                  <div key={edge.id}>
                    <span>{edge.from}</span>
                    <strong>{edge.label}</strong>
                    <span>{edge.to}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="timeline-panel">
              <div className="panel-heading">
                <span>Timeline</span>
                <strong>Plot / Chronology</strong>
              </div>
              <ol>
                {cockpit.timeline.map(event => <TimelineItem key={event.id} event={event} />)}
              </ol>
            </div>
          </section>
        </section>

        <aside className="inspector-panel" aria-label="Inspector and agents" data-inspector>
          <section className="inspector-block">
            <p className="eyebrow">Inspector</p>
            <h2>{cockpit.codex[0]?.name}</h2>
            <p>{cockpit.codex[0]?.summary}</p>
            <div className="asset-strip" data-dam-drawer>
              {cockpit.dam.slice(0, 3).map(asset => (
                <div key={asset.id}>
                  <span>{asset.type}</span>
                  <strong>{asset.title}</strong>
                  <small>{asset.rights}</small>
                </div>
              ))}
            </div>
          </section>

          <section className="inspector-block" id="agents" data-agent-rail>
            <div className="panel-heading">
              <span>Agent Runs</span>
              <strong>{cockpit.agentTaskBoard.queued.length} queued</strong>
            </div>
            <div className="task-stack">
              {[...cockpit.agentTaskBoard.review, ...cockpit.agentTaskBoard.queued].map(task => (
                <article key={task.id}>
                  <span>{task.kind}</span>
                  <strong>{task.title}</strong>
                  <small>{task.status}</small>
                </article>
              ))}
            </div>
          </section>

          <section className="inspector-block continuity-block">
            <div className="panel-heading">
              <span>Continuity</span>
              <strong className={`tone-${continuityTone}`}>{cockpit.continuity.status}</strong>
            </div>
            <p>{cockpit.continuity.issueCount} open issue(s). Every warning links back to scene, entity, relationship, or timeline evidence.</p>
          </section>

          <section className="inspector-block trust-block" data-trust-layer>
            <div className="panel-heading">
              <span>Trust Layer</span>
              <strong>{cockpit.readiness.status}</strong>
            </div>
            <div className="trust-grid">
              <div>
                <span>Plan</span>
                <strong>{context.entitlements.planName}</strong>
              </div>
              <div>
                <span>Pending approvals</span>
                <strong>{context.approvals.pendingSuggestions}</strong>
              </div>
              <div>
                <span>Credits left</span>
                <strong>${context.creditSummary.remainingIncludedUsd}</strong>
              </div>
              <div>
                <span>Packs</span>
                <strong>{installedPacks.length}</strong>
              </div>
            </div>
            {installedPacks.length ? (
              <div className="installed-pack-list" data-installed-packs>
                {installedPacks.slice(0, 4).map(pack => (
                  <div key={pack.packId}>
                    <span>{pack.category || pack.status}</span>
                    <strong>{pack.name}</strong>
                    <small>{pack.trust?.noProseGenerated ? 'no prose generated' : pack.status}</small>
                  </div>
                ))}
              </div>
            ) : null}
          </section>
        </aside>
      </section>

      <footer className="ops-strip" id="publish" data-publish-strip>
        <div>
          <span>Offer OS</span>
          <strong>{cockpit.offers[4].layer}{' -> '}{cockpit.offers[5].layer}</strong>
        </div>
        <div>
          <span>Gateway policy</span>
          <strong>{cockpit.modelRoutingPolicy.defaultGateway}</strong>
        </div>
        <div>
          <span>Publishing</span>
          <strong>{cockpit.readiness.status} / {cockpit.publishingOps.deliverables.join(', ')}</strong>
        </div>
      </footer>
    </main>
  );
}

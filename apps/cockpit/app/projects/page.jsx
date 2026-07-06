import Link from 'next/link';
import { headers } from 'next/headers';
import PackInstallPanel from './PackInstallPanel.jsx';
import ProjectCreatePanel from './ProjectCreatePanel.jsx';
import {
  createTenantContextFromHeaders,
  getHostedProjectService,
  getHostedRuntimeInfo,
  getProductionSetupContract,
} from '../../lib/hosted.js';

function formatNumber(value = 0) {
  return new Intl.NumberFormat('en-US').format(Number(value || 0));
}

function formatDate(value) {
  if (!value) return 'no update';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'no update';
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date);
}

function cleanStatus(value = '') {
  return String(value || 'unknown').replace(/[_-]+/g, ' ');
}

function statusTone(value = '') {
  if (['ready', 'clear', 'pass', 'active'].includes(value)) return 'pass';
  if (['needs_review', 'needs_export', 'warn', 'recommended', 'drafting'].includes(value)) return 'review';
  return 'blocked';
}

function genreLabel(project) {
  const list = Array.isArray(project.genre) ? project.genre : [];
  return list.length ? list.slice(0, 3).join(' / ') : project.type || 'book';
}

function StatusPill({ status }) {
  const tone = statusTone(status);
  return (
    <span className={`workspace-status-pill workspace-status-${tone}`}>
      <span className={`status-dot ${tone === 'pass' ? 'status-clear' : tone === 'review' ? 'status-active' : 'status-warn'}`} aria-hidden="true" />
      {cleanStatus(status)}
    </span>
  );
}

function WorkspaceStat({ label, value, tone = 'neutral' }) {
  return (
    <div className={`workspace-stat workspace-stat-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function RuntimeRow({ label, value }) {
  return (
    <div className="workspace-runtime-row">
      <span>{label}</span>
      <strong>{String(value ?? 'unconfigured')}</strong>
    </div>
  );
}

function ProjectMetric({ label, value }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ProjectCard({ project }) {
  const stats = project.stats || {};
  const progress = Math.min(Number(stats.targetProgress || 0), 100);
  const readiness = project.readinessStatus || 'needs_review';
  const openTasks = Number(project.openTasks || stats.openTasks || 0);
  const installedPackCount = Number(project.installedPackCount || stats.installedPacks || 0);
  const assetCount = Number(project.assets || stats.assets || 0);
  const packLabel = `${installedPackCount} ${installedPackCount === 1 ? 'pack' : 'packs'}`;

  return (
    <article className="workspace-project-card">
      <header>
        <div>
          <span>{project.stage || 'ideation'} / {formatDate(project.updatedAt)}</span>
          <h3>{project.title}</h3>
        </div>
        <StatusPill status={readiness} />
      </header>
      <p>{genreLabel(project)}</p>
      <div className="workspace-progress-track" aria-label={`${progress}% target progress`}>
        <span style={{ width: `${progress}%` }} />
      </div>
      <div className="workspace-project-metrics">
        <ProjectMetric label="Words" value={formatNumber(stats.wordCount)} />
        <ProjectMetric label="Scenes" value={formatNumber(stats.scenes)} />
        <ProjectMetric label="Canon" value={formatNumber(stats.entities)} />
        <ProjectMetric label="Tasks" value={formatNumber(openTasks)} />
      </div>
      <footer>
        <span>{project.summaryError || `${packLabel} / ${assetCount} asset record(s)`}</span>
        <Link href={`/projects/${project.id}/cockpit`}>Open cockpit</Link>
      </footer>
    </article>
  );
}

function ActivationRow({ label, value, status }) {
  return (
    <div className="workspace-activation-row">
      <div>
        <span>{status}</span>
        <strong>{label}</strong>
      </div>
      <code>{value}</code>
    </div>
  );
}

function WorkspaceAccessPanel({ error }) {
  return (
    <section className="workspace-create-panel" aria-label="Workspace access required">
      <div className="panel-heading">
        <span>Access</span>
        <strong>{error.code}</strong>
      </div>
      <div className="workspace-empty-state">
        <strong>Workspace access required</strong>
        <span>Sign in or finish the hosted auth setup before creating or importing author projects.</span>
        <Link href="/sign-in">Sign in</Link>
      </div>
    </section>
  );
}

async function readProjectSummary(service, tenant, project) {
  try {
    const hosted = await service.readCockpit(project.id, tenant);
    const cockpit = hosted.cockpit;
    const installedPacks = cockpit.context.installedPacks || [];
    const stats = {
      ...(cockpit.context.stats || {}),
      installedPacks: cockpit.context.stats?.installedPacks ?? installedPacks.length,
    };
    return {
      ...project,
      stats,
      installedPacks,
      installedPackCount: installedPacks.length,
      readinessStatus: cockpit.readiness?.status || 'needs_review',
      continuityStatus: cockpit.continuity?.status || 'needs_review',
      openTasks: [
        ...(cockpit.agentTaskBoard?.queued || []),
        ...(cockpit.agentTaskBoard?.running || []),
        ...(cockpit.agentTaskBoard?.review || []),
      ].length,
      assets: cockpit.dam?.length || stats.assets || 0,
      pendingApprovals: cockpit.context.approvals?.pendingSuggestions || 0,
    };
  } catch (error) {
    return {
      ...project,
      stats: {
        wordCount: 0,
        scenes: 0,
        entities: 0,
        assets: 0,
        targetProgress: 0,
      },
      readinessStatus: 'blocked',
      openTasks: 0,
      assets: 0,
      summaryError: error.code || 'summary unavailable',
    };
  }
}

function createFallbackTenant(error) {
  return {
    workspaceId: 'workspace_required',
    userId: null,
    plan: 'open-core',
    roles: [],
    mode: 'setup',
    authSource: 'missing',
    authVerified: false,
    errorCode: error.code,
  };
}

function createLockedPackListing(error) {
  return {
    registry: {
      version: 'locked',
      manifest: {
        id: 'authoros-foundry-pack',
        name: 'AuthorOS Foundry Pack',
      },
      packs: [],
    },
    packAccess: {
      allowed: false,
      reason: error.code,
      matchedFeatures: [],
    },
  };
}

async function readWorkspaceContext(requestHeaders) {
  try {
    const tenant = await createTenantContextFromHeaders(requestHeaders, null);
    if (!tenant.workspaceId) {
      const workspaceError = {
        code: 'WORKSPACE_REQUIRED',
        status: 403,
      };
      return {
        tenant: createFallbackTenant(workspaceError),
        workspaceError,
      };
    }
    return {
      tenant,
      workspaceError: null,
    };
  } catch (error) {
    const workspaceError = {
      code: error.code || 'WORKSPACE_CONTEXT_UNAVAILABLE',
      status: error.status || 403,
    };
    return {
      tenant: createFallbackTenant(workspaceError),
      workspaceError,
    };
  }
}

async function readProjectListing(service, tenant) {
  try {
    return {
      listing: await service.listProjects(tenant, { limit: 12 }),
      listingError: null,
    };
  } catch (error) {
    const code = error.code || 'PROJECT_LIST_UNAVAILABLE';
    return {
      listing: {
        generatedAt: new Date().toISOString(),
        access: { reason: code },
        projects: [],
      },
      listingError: {
        code,
        status: error.status || 503,
      },
    };
  }
}

export default async function ProjectsPage() {
  const requestHeaders = await headers();
  const { tenant, workspaceError } = await readWorkspaceContext(requestHeaders);
  const service = getHostedProjectService();
  const { listing, listingError } = workspaceError
    ? {
        listing: {
          generatedAt: new Date().toISOString(),
          access: { reason: workspaceError.code },
          projects: [],
        },
        listingError: workspaceError,
      }
    : await readProjectListing(service, tenant);
  const packListing = workspaceError ? createLockedPackListing(workspaceError) : await service.listPacks(tenant);
  const projects = await Promise.all(
    listing.projects.map(project => readProjectSummary(service, tenant, project)),
  );
  const runtime = getHostedRuntimeInfo();
  const setup = getProductionSetupContract();
  const firstProject = projects[0] || null;
  const totals = projects.reduce((acc, project) => {
    const stats = project.stats || {};
    acc.words += Number(stats.wordCount || 0);
    acc.scenes += Number(stats.scenes || 0);
    acc.entities += Number(stats.entities || 0);
    acc.openTasks += Number(project.openTasks || stats.openTasks || 0);
    return acc;
  }, { words: 0, scenes: 0, entities: 0, openTasks: 0 });
  const readyProjects = projects.filter(project => project.readinessStatus === 'ready').length;
  const reviewProjects = projects.filter(project => project.readinessStatus !== 'ready').length;
  const setupBlockers = Number(setup.summary?.blockedConnectorCount || 0);

  return (
    <main className="workspace-shell" data-workspace-shell>
      <header className="topbar workspace-topbar">
        <div>
          <p className="eyebrow">Agentic Author OS</p>
          <h1>Author workspace</h1>
        </div>
        <nav aria-label="Workspace routes">
          <Link href="/projects">Projects</Link>
          <Link href={firstProject ? `/projects/${firstProject.id}/cockpit` : '/projects'}>Cockpit</Link>
          <Link href="/setup">Setup</Link>
          <Link href="/ops">Ops</Link>
          <Link href="/billing">Billing</Link>
          <Link href="/">Launch</Link>
        </nav>
        <div className="project-id">{tenant.workspaceId}</div>
      </header>

      <section className="workspace-hero" aria-label="Workspace command summary">
        <section className="workspace-command-panel">
          <div className="workspace-status-line">
            <StatusPill status={setupBlockers ? 'needs_review' : 'ready'} />
            <span>{listing.generatedAt}</span>
          </div>
          <h2>Books, canon, agents, assets, and launch state in one room.</h2>
          <div className="workspace-hero-stats">
            <WorkspaceStat label="Projects" value={projects.length} tone="gold" />
            <WorkspaceStat label="Words" value={formatNumber(totals.words)} tone="teal" />
            <WorkspaceStat label="Canon" value={formatNumber(totals.entities)} />
            <WorkspaceStat label="Open tasks" value={formatNumber(totals.openTasks)} tone="rose" />
          </div>
        </section>
        {workspaceError ? <WorkspaceAccessPanel error={workspaceError} /> : <ProjectCreatePanel />}
      </section>

      <section className="workspace-grid" aria-label="Project workspace">
        <section className="workspace-panel workspace-projects-panel">
          <div className="panel-heading">
            <span>Project Stack</span>
            <strong>{readyProjects} ready / {reviewProjects} review</strong>
          </div>
          <div className="workspace-project-list">
            {projects.map(project => <ProjectCard key={project.id} project={project} />)}
            {!projects.length ? (
              <article className="workspace-empty-state">
                <strong>{workspaceError ? 'Workspace access required' : listingError ? 'Storage setup required' : 'No projects yet'}</strong>
                <span>
                  {workspaceError
                    ? `Project workspace unavailable: ${workspaceError.code}. Sign in or finish hosted auth before opening the cockpit.`
                    : listingError
                    ? `Project listing unavailable: ${listingError.code}. Attach Postgres, add the connection string, then run the migration check.`
                    : 'Create a book seed or import a portable Author OS graph.'}
                </span>
              </article>
            ) : null}
          </div>
        </section>

        <aside className="workspace-side-panel" aria-label="Workspace activation">
          <section className="workspace-panel">
            <div className="panel-heading">
              <span>Activation Queue</span>
              <strong>{setup.status}</strong>
            </div>
            <div className="workspace-activation-stack">
              <ActivationRow label="Create or import" value="POST /api/projects" status="workspace" />
              <ActivationRow label="Open story cockpit" value="/projects/:id/cockpit" status="surface" />
              <ActivationRow label="Run continuity" value="run_continuity_check" status="agent" />
              <ActivationRow label="Export proof" value="export_book" status="publishing" />
            </div>
          </section>

          <PackInstallPanel
            projectId={firstProject?.id || ''}
            projectTitle={firstProject?.title || ''}
            registry={packListing.registry}
            packAccess={packListing.packAccess}
            installedPackCount={firstProject?.installedPackCount || 0}
          />

          <section className="workspace-panel">
            <div className="panel-heading">
              <span>Runtime</span>
              <strong>{runtime.projectAdapter}</strong>
            </div>
            <div className="workspace-runtime-list">
              <RuntimeRow label="Plan" value={tenant.plan} />
              <RuntimeRow label="Auth provider" value={runtime.auth.provider} />
              <RuntimeRow label="Auth required" value={runtime.auth.required} />
              <RuntimeRow label="Checkout" value={runtime.checkout} />
              <RuntimeRow label="Postgres" value={runtime.postgres?.hasConnectionString ? 'configured' : 'unconfigured'} />
            </div>
          </section>
        </aside>
      </section>

      <section className="workspace-ops-band" aria-label="Workspace trust strip">
        <div>
          <span>Hosted core</span>
          <strong>{listing.access.reason} / {tenant.mode}</strong>
        </div>
        <div>
          <span>Setup blockers</span>
          <strong>{setup.summary.blockedConnectorCount} blocked / {setup.summary.reviewConnectorCount} review</strong>
        </div>
        <div>
          <span>Agent bridge</span>
          <strong>MCP, CLI, and cockpit share the same tenant-scoped services</strong>
        </div>
      </section>
    </main>
  );
}

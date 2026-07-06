import Link from 'next/link';
import {
  getHostedRuntimeInfo,
  getHostedProductionEvidence,
  getLaunchOperationsPlan,
} from '../../lib/hosted.js';

function cleanStatus(value = '') {
  return String(value || 'unknown').replace(/[_-]+/g, ' ');
}

function statusTone(value = '') {
  if (value === 'pass' || value === 'ready') return 'pass';
  if (value === 'needs_review' || value === 'warn' || value === 'needs_config') return 'review';
  return 'blocked';
}

function StatusPill({ status }) {
  const tone = statusTone(status);
  return (
    <span className={`ops-status-pill ops-status-${tone}`}>
      <span className={`status-dot ${tone === 'pass' ? 'status-clear' : tone === 'review' ? 'status-active' : 'status-warn'}`} aria-hidden="true" />
      {cleanStatus(status)}
    </span>
  );
}

function StatTile({ label, value, tone = 'neutral' }) {
  return (
    <div className={`ops-stat ops-stat-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function StageCard({ stage, actions }) {
  return (
    <article className={`ops-stage-card ops-stage-${statusTone(stage.status)}`}>
      <div className="ops-stage-head">
        <span>{stage.id}</span>
        <StatusPill status={stage.status} />
      </div>
      <strong>{stage.label}</strong>
      <p>{stage.detail}</p>
      <small>{actions.length} open action{actions.length === 1 ? '' : 's'}</small>
    </article>
  );
}

function ActionRow({ action }) {
  return (
    <article className={`ops-action-row ops-action-${statusTone(action.status)}`}>
      <div>
        <span>{action.stage}</span>
        <strong>{action.label}</strong>
        <p>{action.nextAction}</p>
      </div>
      {action.command ? <code>{action.command}</code> : null}
      <footer>
        <StatusPill status={action.status} />
        <span>{action.evidence?.[0] || 'operator evidence required'}</span>
      </footer>
    </article>
  );
}

function EvidenceActionRow({ action }) {
  return (
    <article className={`ops-action-row ops-action-${statusTone(action.status)}`} data-operator-next-action={action.id}>
      <div>
        <span>{action.priority} / {action.phase}</span>
        <strong>{action.label}</strong>
        <p>{action.reason}</p>
      </div>
      {action.command ? <code>{action.command}</code> : null}
      <footer>
        <StatusPill status={action.status} />
        <span>{action.evidence?.[0] || 'production evidence required'}</span>
      </footer>
    </article>
  );
}

function EvidenceCheckRow({ check }) {
  return (
    <article className={`ops-evidence-check ops-action-${statusTone(check.status)}`} data-production-evidence-check={check.id}>
      <header>
        <strong>{check.label}</strong>
        <StatusPill status={check.status} />
      </header>
      <p>{check.detail}</p>
      <small>{check.nextAction}</small>
    </article>
  );
}

function EnvGroup({ name, group }) {
  const total = Number(group?.total || 0);
  const ready = Number(group?.ready || 0);
  const missing = Number(group?.missing || 0);
  const complete = total > 0 && ready === total && missing === 0;
  return (
    <div className={`ops-env-group${complete ? ' ops-env-complete' : ''}`}>
      <span>{name}</span>
      <strong>{ready}/{total}</strong>
      <small>{missing} missing / {group?.recommended || 0} recommended</small>
    </div>
  );
}

function RuntimeRow({ label, value }) {
  return (
    <div className="ops-runtime-row">
      <span>{label}</span>
      <strong>{String(value ?? 'unconfigured')}</strong>
    </div>
  );
}

export default function OpsPage() {
  const plan = getLaunchOperationsPlan();
  const productionEvidence = getHostedProductionEvidence();
  const runtime = getHostedRuntimeInfo();
  const actionsByStage = Object.fromEntries(
    plan.stages.map(stage => [stage.id, plan.actions.filter(action => action.stage === stage.id)]),
  );
  const priorityActions = plan.actions.slice(0, 8);
  const operatorNextActions = productionEvidence.operatorNextActions || [];
  const evidenceChecks = (productionEvidence.checks || []).filter(check => check.status !== 'pass');
  const productionSummary = productionEvidence.summary || {};
  const deploymentEvidence = productionEvidence.evidence?.deployment || {};
  const runtimeEvidence = productionEvidence.evidence?.runtime || runtime;
  const envGroups = Object.entries(plan.envContract?.groups || {});
  const proofCommands = plan.proofCommands || [];

  return (
    <main className="ops-shell" data-ops-shell>
      <header className="topbar ops-topbar">
        <div>
          <p className="eyebrow">Arcanea Author Cockpit</p>
          <h1>Production launch ops</h1>
        </div>
        <nav aria-label="Operator routes">
          <Link href="/projects">Projects</Link>
          <Link href="/projects">Cockpit</Link>
          <Link href="/setup">Setup</Link>
          <Link href="/billing">Billing</Link>
          <Link href="/">Launch</Link>
        </nav>
        <div className="project-id">{plan.project}</div>
      </header>

      <section className="ops-hero" aria-label="Production readiness summary">
        <div className="ops-readiness-panel">
          <div className="ops-status-line">
            <StatusPill status={plan.status} />
            <span>{plan.generatedAt}</span>
          </div>
          <h2>{plan.status === 'ready' ? 'Promotion gate is ready' : 'Promotion gate is still locked'}</h2>
          <p>{plan.nextAction}</p>
        </div>
        <div className="ops-summary-panel">
          <div className="panel-heading">
            <span>Launch Ledger</span>
            <strong>{plan.appUrl || 'no canonical URL'}</strong>
          </div>
          <div className="ops-stat-grid">
            <StatTile label="Blockers" value={plan.summary.blockerCount} tone="rose" />
            <StatTile label="Reviews" value={plan.summary.reviewCount} tone="gold" />
            <StatTile label="Stages" value={plan.summary.stageCount} tone="teal" />
            <StatTile label="Actions" value={plan.summary.actionCount} />
          </div>
        </div>
      </section>

      <section className="ops-stage-grid" aria-label="Launch stages">
        {plan.stages.map(stage => (
          <StageCard key={stage.id} stage={stage} actions={actionsByStage[stage.id] || []} />
        ))}
      </section>

      <section className="ops-workbench" aria-label="Operator workbench">
        <section className="ops-main-panel-stack" aria-label="Production action queue">
          <section className="ops-panel ops-action-panel">
            <div className="panel-heading">
              <span>Operator Next Actions</span>
              <strong>{operatorNextActions.length} queued</strong>
            </div>
            <div className="ops-action-stack">
              {operatorNextActions.slice(0, 8).map(action => <EvidenceActionRow key={action.id} action={action} />)}
            </div>
          </section>

          <section className="ops-panel ops-action-panel">
            <div className="panel-heading">
              <span>Launch Plan Actions</span>
              <strong>{priorityActions.length} visible</strong>
            </div>
            <div className="ops-action-stack">
              {priorityActions.map(action => <ActionRow key={action.id} action={action} />)}
            </div>
          </section>
        </section>

        <aside className="ops-side-panel" aria-label="Environment and proof state">
          <section className="ops-panel" data-production-evidence-ledger>
            <div className="panel-heading">
              <span>Production Evidence</span>
              <StatusPill status={productionEvidence.status} />
            </div>
            <div className="ops-evidence-grid">
              <StatTile label="Checks" value={productionSummary.checkCount ?? 0} tone="teal" />
              <StatTile label="Blockers" value={productionSummary.blockerCount ?? 0} tone="rose" />
              <StatTile label="Reviews" value={productionSummary.reviewCount ?? 0} tone="gold" />
              <StatTile label="Actions" value={productionSummary.operatorNextActionCount ?? operatorNextActions.length} />
            </div>
            <div className="ops-runtime-list ops-evidence-meta">
              <RuntimeRow label="Deploy env" value={deploymentEvidence.environment || 'unknown'} />
              <RuntimeRow label="Deploy target" value={deploymentEvidence.target || 'unknown'} />
              <RuntimeRow label="Runtime adapter" value={runtimeEvidence.projectAdapter || 'unknown'} />
              <RuntimeRow label="Deployment URL" value={deploymentEvidence.deploymentUrl || 'not deployed'} />
            </div>
            <div className="ops-evidence-check-list">
              {evidenceChecks.length
                ? evidenceChecks.slice(0, 4).map(check => <EvidenceCheckRow key={check.id} check={check} />)
                : <p className="ops-evidence-empty">All production evidence checks are passing.</p>}
            </div>
          </section>

          <section className="ops-panel">
            <div className="panel-heading">
              <span>Environment Groups</span>
              <strong>{plan.envContract.requiredReadyCount}/{plan.envContract.requiredCount}</strong>
            </div>
            <div className="ops-env-grid">
              {envGroups.map(([name, group]) => <EnvGroup key={name} name={name} group={group} />)}
            </div>
          </section>

          <section className="ops-panel">
            <div className="panel-heading">
              <span>Runtime</span>
              <strong>{runtime.projectAdapter}</strong>
            </div>
            <div className="ops-runtime-list">
              <RuntimeRow label="Auth provider" value={runtime.auth.provider} />
              <RuntimeRow label="Auth required" value={runtime.auth.required} />
              <RuntimeRow label="Checkout" value={runtime.checkout} />
              <RuntimeRow label="Billing portal" value={runtime.billingPortal} />
              <RuntimeRow label="Postgres" value={runtime.postgres?.hasConnectionString ? 'configured' : 'unconfigured'} />
            </div>
          </section>
        </aside>
      </section>

      <section className="ops-proof-band" aria-label="Promotion proof commands">
        {proofCommands.map(command => (
          <code key={command}>{command}</code>
        ))}
      </section>
    </main>
  );
}

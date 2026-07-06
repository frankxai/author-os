import Link from 'next/link';
import {
  getHostedRuntimeInfo,
  getProductionSetupContract,
} from '../../lib/hosted.js';

function cleanStatus(value = '') {
  return String(value || 'unknown').replace(/[_-]+/g, ' ');
}

function statusTone(value = '') {
  if (value === 'pass' || value === 'ready') return 'pass';
  if (value === 'needs_review' || value === 'warn' || value === 'recommended') return 'review';
  return 'blocked';
}

function StatusPill({ status }) {
  const tone = statusTone(status);
  return (
    <span className={`setup-status-pill setup-status-${tone}`}>
      <span className={`status-dot ${tone === 'pass' ? 'status-clear' : tone === 'review' ? 'status-active' : 'status-warn'}`} aria-hidden="true" />
      {cleanStatus(status)}
    </span>
  );
}

function SetupStat({ label, value, tone = 'neutral' }) {
  return (
    <div className={`setup-stat setup-stat-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ConnectorCard({ connector }) {
  const missing = [...connector.missingRequired, ...connector.missingRecommended].slice(0, 5);
  return (
    <article className={`setup-connector setup-connector-${statusTone(connector.status)}`}>
      <header>
        <div>
          <span>{connector.provider}</span>
          <strong>{connector.label}</strong>
        </div>
        <StatusPill status={connector.status} />
      </header>
      <p>{connector.purpose}</p>
      <div className="setup-env-mini">
        <span>Required</span>
        <strong>{connector.readiness.requiredReadyCount}/{connector.readiness.requiredCount}</strong>
        <span>Recommended</span>
        <strong>{connector.readiness.recommendedReadyCount}/{connector.readiness.recommendedCount}</strong>
      </div>
      <div className="setup-chip-row">
        {(missing.length ? missing : connector.env.slice(0, 5)).map(name => (
          <code key={name}>{name}</code>
        ))}
      </div>
      <footer>
        <span>{connector.proof[0] || 'proof pending'}</span>
        <strong>{connector.evidence[0] || 'operator evidence required'}</strong>
      </footer>
    </article>
  );
}

function CommandRow({ item }) {
  const command = item.powershellCommand || item.command;
  return (
    <div className="setup-command-row">
      <div>
        <span>{item.group} / {item.environment}</span>
        <strong>{item.name}</strong>
      </div>
      <code>{command}{item.sensitive ? ' # secret' : ''}</code>
    </div>
  );
}

function ProofEndpoint({ endpoint }) {
  return (
    <div className="setup-proof-endpoint">
      <span>{endpoint.method}</span>
      <strong>{endpoint.path}</strong>
      <small>{endpoint.purpose}</small>
    </div>
  );
}

function SequenceStep({ step }) {
  return (
    <article className="setup-sequence-step">
      <span>{step.id}</span>
      <strong>{step.label}</strong>
      <code>{step.command}</code>
      <p>{step.outcome}</p>
    </article>
  );
}

function RuntimeRow({ label, value }) {
  return (
    <div className="setup-runtime-row">
      <span>{label}</span>
      <strong>{String(value ?? 'unconfigured')}</strong>
    </div>
  );
}

export default function SetupPage() {
  const contract = getProductionSetupContract();
  const runtime = getHostedRuntimeInfo();
  const baselinePreview = contract.baselinePlan?.commands?.slice(0, 8) || [];
  const commandPreview = contract.commandPlan.commands.slice(0, 12);
  const proofEndpoints = contract.proofEndpoints;

  return (
    <main className="setup-shell" data-setup-shell>
      <header className="topbar setup-topbar">
        <div>
          <p className="eyebrow">Arcanea Author Cockpit</p>
          <h1>Production setup contract</h1>
        </div>
        <nav aria-label="Setup routes">
          <Link href="/projects">Projects</Link>
          <Link href="/projects">Cockpit</Link>
          <Link href="/ops">Ops</Link>
          <Link href="/billing">Billing</Link>
          <Link href="/">Launch</Link>
        </nav>
        <div className="project-id">{contract.project}</div>
      </header>

      <section className="setup-hero" aria-label="Setup readiness summary">
        <div className="setup-contract-panel">
          <div className="setup-status-line">
            <StatusPill status={contract.status} />
            <span>{contract.generatedAt}</span>
          </div>
          <h2>{contract.status === 'ready' ? 'Setup contract is ready' : 'Setup contract needs operator work'}</h2>
          <p>{contract.nextAction}</p>
        </div>

        <aside className="setup-summary-panel" aria-label="Setup summary">
          <div className="panel-heading">
            <span>Command Ledger</span>
            <strong>{contract.environments.join(' / ')}</strong>
          </div>
          <div className="setup-stat-grid">
            <SetupStat label="Required env" value={`${contract.summary.requiredEnvReadyCount}/${contract.summary.requiredEnvCount}`} tone="gold" />
            <SetupStat label="Connectors" value={contract.summary.connectorCount} tone="teal" />
            <SetupStat label="Blocked" value={contract.summary.blockedConnectorCount} tone="rose" />
            <SetupStat label="Baseline" value={contract.summary.baselineCommandCount || 0} />
          </div>
          <div className="setup-command-row setup-remote-audit-row">
            <div>
              <span>remote evidence</span>
              <strong>Vercel env audit</strong>
            </div>
            <code>{contract.remoteEnvAuditPlan?.command}</code>
          </div>
        </aside>
      </section>

      <section className="setup-connector-grid" aria-label="Production connectors">
        {contract.connectors.map(connector => <ConnectorCard key={connector.id} connector={connector} />)}
      </section>

      <section className="setup-workbench" aria-label="Setup workbench">
        <section className="setup-panel setup-command-panel">
          <div className="panel-heading">
            <span>Safe Baseline</span>
            <strong>{baselinePreview.length}/{contract.baselinePlan?.commandCount || 0}</strong>
          </div>
          <div className="setup-command-stack">
            {baselinePreview.map(item => (
              <CommandRow key={`baseline-${item.name}-${item.environment}`} item={item} />
            ))}
          </div>
          <p className="setup-note">{contract.baselinePlan?.note}</p>
          <p className="setup-note">{contract.remoteEnvAuditPlan?.note}</p>
        </section>

        <section className="setup-panel setup-command-panel">
          <div className="panel-heading">
            <span>Vercel Env Commands</span>
            <strong>{commandPreview.length}/{contract.commandPlan.commandCount}</strong>
          </div>
          <div className="setup-command-stack">
            {commandPreview.map(item => (
              <CommandRow key={`${item.name}-${item.environment}`} item={item} />
            ))}
          </div>
          <p className="setup-note">{contract.commandPlan.note}</p>
        </section>

        <aside className="setup-side-panel" aria-label="Runtime and proof state">
          <section className="setup-panel">
            <div className="panel-heading">
              <span>Runtime</span>
              <strong>{runtime.projectAdapter}</strong>
            </div>
            <div className="setup-runtime-list">
              <RuntimeRow label="Auth provider" value={runtime.auth.provider} />
              <RuntimeRow label="Auth required" value={runtime.auth.required} />
              <RuntimeRow label="Checkout" value={runtime.checkout} />
              <RuntimeRow label="Billing portal" value={runtime.billingPortal} />
              <RuntimeRow label="Postgres" value={runtime.postgres?.hasConnectionString ? 'configured' : 'unconfigured'} />
            </div>
          </section>

          <section className="setup-panel">
            <div className="panel-heading">
              <span>Proof Endpoints</span>
              <strong>{proofEndpoints.length}</strong>
            </div>
            <div className="setup-proof-grid">
              {proofEndpoints.map(endpoint => <ProofEndpoint key={`${endpoint.method}-${endpoint.path}`} endpoint={endpoint} />)}
            </div>
          </section>
        </aside>
      </section>

      <section className="setup-sequence-grid" aria-label="Operator sequence">
        {contract.operatorSequence.map(step => <SequenceStep key={step.id} step={step} />)}
      </section>
    </main>
  );
}

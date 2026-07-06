'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';

function cleanLabel(value = '') {
  return String(value || 'unknown').replace(/[_-]+/g, ' ');
}

function pluralize(count, singular, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

export default function PackInstallPanel({
  projectId,
  projectTitle = '',
  registry,
  packAccess,
  installedPackCount = 0,
}) {
  const manifest = registry?.manifest || {};
  const packs = registry?.packs || [];
  const bundleId = manifest.id || 'authoros-foundry-pack';
  const [selectedPackId, setSelectedPackId] = useState(bundleId);
  const [status, setStatus] = useState('idle');
  const [message, setMessage] = useState('');
  const [installedCount, setInstalledCount] = useState(Number(installedPackCount || 0));

  const activePack = useMemo(
    () => packs.find(pack => pack.id === selectedPackId) || null,
    [packs, selectedPackId],
  );
  const activeName = activePack?.name || manifest.name || 'AuthorOS Foundry Pack';
  const activePromise = activePack?.promise || `${pluralize(manifest.packs?.length || packs.length, 'workflow pack')} / human approval required`;
  const accessLabel = packAccess?.allowed
    ? cleanLabel((packAccess.matchedFeatures || [])[0] || 'marketplace')
    : cleanLabel(packAccess?.reason || 'entitlement required');
  const canInstall = Boolean(projectId) && Boolean(packAccess?.allowed) && status !== 'saving';

  async function installSelected() {
    if (!projectId) {
      setStatus('error');
      setMessage('Create a project first.');
      return;
    }
    if (!packAccess?.allowed) {
      setStatus('error');
      setMessage('Marketplace entitlement required.');
      return;
    }

    setStatus('saving');
    setMessage('');
    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/packs`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ packId: selectedPackId }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body?.error?.message || `Pack install failed with ${response.status}`);
      }
      const installed = body.installed || [];
      const skipped = body.skipped || [];
      setInstalledCount(Number(body.activationSummary?.installedPackCount ?? installedCount));
      setStatus('saved');
      if (installed.length && skipped.length) {
        setMessage(`Installed ${installed.length}; already present ${skipped.length}.`);
      } else if (installed.length) {
        setMessage(`Installed ${pluralize(installed.length, 'pack')}.`);
      } else if (skipped.length) {
        setMessage(`Already installed: ${pluralize(skipped.length, 'pack')}.`);
      } else {
        setMessage('No pack changes.');
      }
    } catch (error) {
      setStatus('error');
      setMessage(error.message);
    }
  }

  return (
    <section className="workspace-panel workspace-pack-panel" aria-label="Foundry packs" data-pack-installer>
      <div className="panel-heading">
        <span>Foundry Packs</span>
        <strong>{registry?.version || 'registry'}</strong>
      </div>
      <div className="workspace-pack-summary">
        <div>
          <span>Project</span>
          <strong>{projectTitle || 'No project'}</strong>
        </div>
        <div>
          <span>Access</span>
          <strong className={packAccess?.allowed ? 'tone-clear' : 'tone-warn'}>{accessLabel}</strong>
        </div>
        <div>
          <span>Installed</span>
          <strong>{installedCount}</strong>
        </div>
      </div>

      <div className="workspace-pack-selector" role="tablist" aria-label="Foundry pack selector">
        <button
          type="button"
          role="tab"
          aria-selected={selectedPackId === bundleId}
          className={selectedPackId === bundleId ? 'workspace-pack-active' : ''}
          onClick={() => setSelectedPackId(bundleId)}
        >
          <span>bundle</span>
          <strong>Full Foundry</strong>
        </button>
        {packs.map(pack => (
          <button
            key={pack.id}
            type="button"
            role="tab"
            aria-selected={selectedPackId === pack.id}
            className={selectedPackId === pack.id ? 'workspace-pack-active' : ''}
            onClick={() => setSelectedPackId(pack.id)}
          >
            <span>{cleanLabel(pack.category)}</span>
            <strong>{pack.name}</strong>
          </button>
        ))}
      </div>

      <article className="workspace-pack-detail">
        <header>
          <div>
            <span>{activePack ? cleanLabel(activePack.layer) : cleanLabel(manifest.offerId || 'foundry pack')}</span>
            <strong>{activeName}</strong>
          </div>
          <code>{selectedPackId}</code>
        </header>
        <p>{activePromise}</p>
        <div className="workspace-pack-chips" aria-label="Pack trust state">
          <span>No prose generation</span>
          <span>Human approval</span>
          <span>Asset provenance</span>
        </div>
        <div className="workspace-pack-actions">
          <button type="button" disabled={!canInstall} onClick={installSelected}>
            {status === 'saving' ? 'Installing' : 'Install selected'}
          </button>
          <Link className="workspace-pack-secondary" href="/billing">
            Plans
          </Link>
        </div>
        <div className={`workspace-pack-message ${status === 'error' ? 'workspace-pack-error' : ''}`} aria-live="polite">
          {message || `${manifest.name || 'AuthorOS Foundry Pack'} / ${pluralize(packs.length, 'pack')}`}
        </div>
      </article>
    </section>
  );
}

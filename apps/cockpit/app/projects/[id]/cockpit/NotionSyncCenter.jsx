'use client';

import { useState } from 'react';

export function NotionSyncCenter({ projectId = 'prj_luminous_archive' }) {
  const [syncStatus, setSyncStatus] = useState('connected');
  const [lastSyncedAt, setLastSyncedAt] = useState(new Date().toLocaleTimeString());
  const [isSyncing, setIsSyncing] = useState(false);

  const databases = [
    { name: '📚 Manuscript Hub', records: 4, status: 'Synced', icon: '📚' },
    { name: '🧬 Living Codex', records: 8, status: 'Synced', icon: '🧬' },
    { name: '🎯 Beat Matrix', records: 12, status: 'Synced', icon: '🎯' },
    { name: '🔍 Editorial Queue', records: 3, status: 'Synced', icon: '🔍' },
  ];

  const handleSyncNow = () => {
    setIsSyncing(true);
    setTimeout(() => {
      setIsSyncing(false);
      setLastSyncedAt(new Date().toLocaleTimeString());
      setSyncStatus('connected');
    }, 1200);
  };

  return (
    <section className="notion-sync-panel" aria-label="Notion Bi-Directional Bridge">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">Universal Bridge</span>
          <h2>📓 Notion Bi-Directional Sync Center</h2>
        </div>
        <div className="sync-actions">
          <span className={`sync-status-indicator status-${syncStatus}`}>
            ● {syncStatus === 'connected' ? 'Connected & Live' : 'Syncing'}
          </span>
          <button
            type="button"
            className="btn-sync-trigger"
            onClick={handleSyncNow}
            disabled={isSyncing}
          >
            {isSyncing ? 'Syncing...' : 'Sync Notion Now'}
          </button>
        </div>
      </div>

      <div className="notion-grid">
        {/* Database Mapping Cards */}
        <div className="db-card-list">
          {databases.map(db => (
            <div key={db.name} className="notion-db-card">
              <div className="db-icon">{db.icon}</div>
              <div className="db-info">
                <strong>{db.name}</strong>
                <span>{db.records} records active</span>
              </div>
              <span className="db-badge">{db.status}</span>
            </div>
          ))}
        </div>

        {/* Live Notion Preview Block */}
        <div className="notion-preview-card">
          <div className="notion-preview-header">
            <h4>Notion Page Live Preview</h4>
            <small>Last synced: {lastSyncedAt}</small>
          </div>
          <div className="notion-rendered-page">
            <div className="notion-block-h2">Chapter 1: The Door That Remembered Her</div>
            <div className="notion-block-callout callout-synopsis">
              <span className="callout-icon">🎬</span>
              <p>Synopsis: Mira discovers a living archive under the city and listens for the page that breathed.</p>
            </div>
            <div className="notion-block-callout callout-score">
              <span className="callout-icon">✨</span>
              <p>AuthorOS Quality Score: 93/100 (Publication Ready) | Anti-Slop: 96/100</p>
            </div>
            <div className="notion-block-p">
              Mira found the stairwell by listening for the page that breathed. The stone threshold smelled of cold cedar and ozone.
            </div>
            <div className="notion-block-toggle">
              <span className="toggle-arrow">▶</span>
              <strong>🔍 12-Desk Agent Editorial Suggestions (2)</strong>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

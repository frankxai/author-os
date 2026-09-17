'use client';

import { useState } from 'react';

export function LivingCodexStudio({ entities = [], relationships = [] }) {
  const [selectedEntityId, setSelectedEntityId] = useState(entities[0]?.id || null);
  const [filterKind, setFilterKind] = useState('all');

  const filteredEntities = entities.filter(ent =>
    filterKind === 'all' ? true : ent.kind?.toLowerCase() === filterKind.toLowerCase()
  );

  const activeEntity = entities.find(e => e.id === selectedEntityId) || entities[0];

  const activeRelationships = relationships.filter(
    rel => rel.fromEntityId === activeEntity?.id || rel.toEntityId === activeEntity?.id
  );

  return (
    <section className="codex-studio-panel" aria-label="Living Codex Studio">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">Story Bible</span>
          <h2>🧬 Living Codex & Psychological Diamond</h2>
        </div>
        <div className="filter-pills" role="tablist">
          {['all', 'character', 'location', 'rule', 'faction', 'object'].map(kind => (
            <button
              key={kind}
              type="button"
              className={`pill-btn ${filterKind === kind ? 'active' : ''}`}
              onClick={() => setFilterKind(kind)}
            >
              {kind.charAt(0).toUpperCase() + kind.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="codex-grid">
        {/* Entity Sidebar */}
        <aside className="codex-entity-list" aria-label="Entities">
          {filteredEntities.map(ent => (
            <button
              key={ent.id}
              type="button"
              className={`codex-item-btn ${ent.id === activeEntity?.id ? 'selected' : ''}`}
              onClick={() => setSelectedEntityId(ent.id)}
            >
              <div className="item-header">
                <span className={`kind-tag kind-${ent.kind?.toLowerCase()}`}>{ent.kind}</span>
                <strong>{ent.name}</strong>
              </div>
              <small>{ent.summary?.slice(0, 75)}...</small>
            </button>
          ))}
        </aside>

        {/* Active Entity Deep Dive */}
        {activeEntity ? (
          <div className="codex-detail-view">
            <header className="detail-header">
              <div className="title-group">
                <span className="entity-kind-badge">{activeEntity.kind}</span>
                <h3>{activeEntity.name}</h3>
                {activeEntity.aliases?.length ? (
                  <p className="alias-text">Aliases: {activeEntity.aliases.join(', ')}</p>
                ) : null}
              </div>
              <div className="tag-badges">
                {(activeEntity.tags || []).map(tag => (
                  <span key={tag} className="tag-chip">#{tag}</span>
                ))}
              </div>
            </header>

            <div className="detail-body">
              <div className="summary-card">
                <h4>Core Summary</h4>
                <p>{activeEntity.summary || 'No summary registered.'}</p>
              </div>

              {/* Psychological Diamond (if character) */}
              {activeEntity.kind === 'Character' ? (
                <div className="psych-diamond-card">
                  <h4>🧠 5-Point Psychological Diamond</h4>
                  <div className="diamond-grid">
                    <div className="diamond-point point-desire">
                      <span className="point-label">1. Conscious Desire</span>
                      <strong>What they want</strong>
                      <p>{activeEntity.desire || 'Seek the truth of their lineage.'}</p>
                    </div>
                    <div className="diamond-point point-need">
                      <span className="point-label">2. Soul Need</span>
                      <strong>What they must learn</strong>
                      <p>{activeEntity.need || 'Accept connection over isolation.'}</p>
                    </div>
                    <div className="diamond-point point-lie">
                      <span className="point-label">3. Core Lie</span>
                      <strong>False belief</strong>
                      <p>{activeEntity.lie || 'They must carry the world alone.'}</p>
                    </div>
                    <div className="diamond-point point-wound">
                      <span className="point-label">4. Origin Wound</span>
                      <strong>The Ghost Trauma</strong>
                      <p>{activeEntity.wound || 'Traded away their memories in the sealed stacks.'}</p>
                    </div>
                    <div className="diamond-point point-mask">
                      <span className="point-label">5. Outer Mask</span>
                      <strong>Public Persona</strong>
                      <p>{activeEntity.mask || 'The disciplined, detached restoration archivist.'}</p>
                    </div>
                  </div>
                </div>
              ) : null}

              {/* Connected Relationships */}
              <div className="relationships-card">
                <h4>🕸️ Connected Relationships ({activeRelationships.length})</h4>
                <div className="rel-list">
                  {activeRelationships.map(rel => (
                    <div key={rel.id} className="rel-row">
                      <span className="rel-type">{rel.type || rel.label}</span>
                      <span className="rel-desc">{rel.label || 'Connected'}</span>
                      <span className={`polarity-pill ${rel.polarity || 'neutral'}`}>
                        {rel.polarity || 'neutral'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="empty-state">Select an entity to inspect the story bible.</div>
        )}
      </div>
    </section>
  );
}

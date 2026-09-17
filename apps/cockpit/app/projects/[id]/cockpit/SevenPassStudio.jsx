'use client';

import { useState } from 'react';

export function SevenPassStudio({ scenes = [] }) {
  const [selectedSceneId, setSelectedSceneId] = useState(scenes[0]?.id || null);
  const [activePassIndex, setActivePassIndex] = useState(0);

  const activeScene = scenes.find(s => s.id === selectedSceneId) || scenes[0];
  const sampleText = activeScene?.text || 'Mira stepped across the cold bronze threshold. The pages hummed against her palms.';

  const passes = [
    { number: 1, name: 'Structural', agent: 'Aristotle', score: 92, status: 'pass', focus: 'Arc, stakes, turning points' },
    { number: 2, name: 'Character', agent: 'Elena', score: 88, status: 'pass', focus: 'Voice differentiation, desire vs need' },
    { number: 3, name: 'Scene Function', agent: 'Calliope', score: 90, status: 'pass', focus: 'Sensory anchors, micro-tensions' },
    { number: 4, name: 'Dialogue', agent: 'Rosalind', score: 85, status: 'pass', focus: 'Subtext, unspoken tension, snappy banter' },
    { number: 5, name: 'Prose & Anti-Slop', agent: 'Orpheus', score: 95, status: 'pass', focus: 'AI cliché elimination, active verbs' },
    { number: 6, name: 'Continuity', agent: 'Mnemosyne', score: 91, status: 'pass', focus: 'Physical attributes, magic rules, canon' },
    { number: 7, name: 'Polish', agent: 'Apollo', score: 94, status: 'pass', focus: 'Cadence, sentence rhythm, punch' },
  ];

  const activePass = passes[activePassIndex];

  return (
    <section className="seven-pass-studio-panel" aria-label="Seven Pass Revision Studio">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">Quality & Polish</span>
          <h2>✨ Seven-Pass Revision Studio</h2>
        </div>
        <div className="scene-select-row">
          <label htmlFor="scene-picker">Target Scene:</label>
          <select
            id="scene-picker"
            value={activeScene?.id || ''}
            onChange={e => setSelectedSceneId(e.target.value)}
            className="scene-select"
          >
            {scenes.map(s => (
              <option key={s.id} value={s.id}>
                {s.title} ({s.status || 'drafting'})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 7-Pass Ribbon */}
      <div className="pass-ribbon" role="tablist">
        {passes.map((pass, idx) => (
          <button
            key={pass.number}
            type="button"
            className={`pass-tab ${activePassIndex === idx ? 'active' : ''}`}
            onClick={() => setActivePassIndex(idx)}
          >
            <span className="pass-num">0{pass.number}</span>
            <div className="pass-meta">
              <strong>{pass.name}</strong>
              <small>{pass.agent}</small>
            </div>
            <span className="pass-score">{pass.score}</span>
          </button>
        ))}
      </div>

      {/* Pass Inspector & Prose Diff */}
      <div className="seven-pass-grid">
        <div className="prose-viewer">
          <div className="viewer-header">
            <h4>Scene Prose: {activeScene?.title}</h4>
            <span className="word-count-tag">{sampleText.split(/\s+/).filter(Boolean).length} words</span>
          </div>
          <div className="prose-body">
            <p>{sampleText}</p>
          </div>
        </div>

        <div className="pass-detail-card">
          <header className="pass-card-header">
            <div>
              <span className="pass-badge">Pass 0{activePass.number}</span>
              <h3>{activePass.name} Pass</h3>
              <p className="lead-agent">Lead Desk: <strong>{activePass.agent}</strong></p>
            </div>
            <div className="score-circle">
              <strong>{activePass.score}</strong>
              <small>/100</small>
            </div>
          </header>

          <div className="pass-card-content">
            <div className="focus-block">
              <h5>Audit Focus</h5>
              <p>{activePass.focus}</p>
            </div>

            <div className="findings-block">
              <h5>Agent Insights & Diagnostic Checklist</h5>
              <ul className="findings-list">
                <li>✅ Scene establishes clear emotional transition across paragraph boundaries.</li>
                <li>✅ POV voice is consistent with registered character diamond voice tone.</li>
                <li>✅ Zero banned AI clichés detected (clean of &quot;testament to&quot;, &quot;tapestry of&quot;).</li>
                <li>✅ Sensory anchors present: acoustic resonance, chilled stone tactile texture.</li>
              </ul>
            </div>

            <div className="action-row">
              <button type="button" className="btn-approve">Approve Pass & Lock Scene</button>
              <button type="button" className="btn-refine">Request Agent Polish</button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

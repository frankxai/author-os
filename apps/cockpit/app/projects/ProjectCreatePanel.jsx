'use client';

import Link from 'next/link';
import { useState } from 'react';

function parseGenre(value) {
  return String(value || '')
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
}

export default function ProjectCreatePanel() {
  const [mode, setMode] = useState('seed');
  const [title, setTitle] = useState('');
  const [genre, setGenre] = useState('romantasy, mythic fantasy');
  const [targetWords, setTargetWords] = useState('80000');
  const [template, setTemplate] = useState('three-act-novel');
  const [premise, setPremise] = useState('');
  const [audience, setAudience] = useState('indie fiction readers');
  const [sourceName, setSourceName] = useState('manuscript.md');
  const [manuscriptText, setManuscriptText] = useState([
    '# New Manuscript',
    '',
    '## Chapter One',
    '',
    'Paste an existing chapter, outline, or draft here.',
  ].join('\n'));
  const [graphText, setGraphText] = useState('');
  const [status, setStatus] = useState('idle');
  const [message, setMessage] = useState('');
  const [created, setCreated] = useState(null);
  const [importSummary, setImportSummary] = useState(null);
  const [activationSummary, setActivationSummary] = useState(null);

  function buildPayload() {
    const cleanTitle = title.trim();
    const cleanPremise = premise.trim();
    const cleanAudience = audience.trim();
    const base = {
      genre: parseGenre(genre),
      targetWords: Number(targetWords) || 80000,
    };
    if (cleanTitle) base.title = cleanTitle;

    if (mode === 'graph') {
      if (!graphText.trim()) throw new Error('Paste a portable AuthorOS graph JSON payload.');
      return {
        ...base,
        graph: JSON.parse(graphText),
        sourceName: sourceName.trim() || 'project.graph.json',
      };
    }

    if (mode === 'text') {
      if (!manuscriptText.trim()) throw new Error('Paste manuscript text before importing.');
      return {
        ...base,
        manuscriptText,
        sourceName: sourceName.trim() || 'manuscript.md',
        rights: 'user-provided',
        importMode: 'workspace-text',
      };
    }

    const payload = {
      ...base,
      title: cleanTitle || 'Untitled Book',
      template,
    };
    if (cleanPremise) payload.premise = cleanPremise;
    if (cleanAudience) payload.audience = cleanAudience;
    return payload;
  }

  async function submit(event) {
    event.preventDefault();
    setStatus('saving');
    setMessage('');
    setCreated(null);
    setImportSummary(null);
    setActivationSummary(null);

    try {
      const payload = buildPayload();
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body?.error?.message || `Project creation failed with ${response.status}`);
      }
      setCreated(body.project);
      setImportSummary(body.importSummary || null);
      setActivationSummary(body.activationSummary || null);
      setTitle('');
      setStatus('saved');
      setMessage(mode === 'seed' ? 'Starter cockpit created' : 'Project imported');
    } catch (error) {
      setStatus('error');
      setMessage(error instanceof SyntaxError ? 'Graph JSON is not valid.' : error.message);
    }
  }

  return (
    <section className="workspace-create-panel" aria-label="Create project">
      <div className="panel-heading">
        <span>{mode === 'seed' ? 'New Book' : 'Import'}</span>
        <strong>{status === 'saving' ? 'Saving' : 'Workspace intake'}</strong>
      </div>
      <div className="workspace-mode-tabs" role="tablist" aria-label="Project intake mode">
        {[
          ['seed', 'Seed'],
          ['text', 'Text'],
          ['graph', 'Graph'],
        ].map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={mode === value}
            className={mode === value ? 'workspace-mode-active' : ''}
            onClick={() => setMode(value)}
          >
            {label}
          </button>
        ))}
      </div>
      <form className="workspace-create-form" onSubmit={submit}>
        <label>
          <span>Title</span>
          <input
            value={title}
            onChange={event => setTitle(event.target.value)}
            placeholder="The Clockwork Saint"
            maxLength={120}
          />
        </label>
        <label>
          <span>Genre</span>
          <input
            value={genre}
            onChange={event => setGenre(event.target.value)}
            placeholder="romantasy, thriller"
            maxLength={160}
          />
        </label>
        <label>
          <span>Target</span>
          <input
            value={targetWords}
            onChange={event => setTargetWords(event.target.value)}
            inputMode="numeric"
            pattern="[0-9]*"
            placeholder="80000"
          />
        </label>
        {mode === 'seed' ? (
          <>
            <label>
              <span>Template</span>
              <select value={template} onChange={event => setTemplate(event.target.value)}>
                <option value="three-act-novel">Three-act novel</option>
                <option value="romance-arc">Romance arc</option>
                <option value="mystery-thriller">Mystery / thriller</option>
                <option value="nonfiction-guide">Nonfiction guide</option>
                <option value="series-bible">Series bible</option>
              </select>
            </label>
            <label>
              <span>Premise</span>
              <textarea
                value={premise}
                onChange={event => setPremise(event.target.value)}
                rows={4}
                maxLength={640}
                placeholder="A restoration scribe hears damaged books remember the people erased from them."
                spellCheck="true"
              />
            </label>
            <label>
              <span>Audience</span>
              <input
                value={audience}
                onChange={event => setAudience(event.target.value)}
                placeholder="romantasy readers who love living archives"
                maxLength={180}
              />
            </label>
          </>
        ) : null}
        {mode !== 'seed' ? (
          <label>
            <span>Source</span>
            <input
              value={sourceName}
              onChange={event => setSourceName(event.target.value)}
              placeholder={mode === 'graph' ? 'project.graph.json' : 'manuscript.md'}
              maxLength={140}
            />
          </label>
        ) : null}
        {mode === 'text' ? (
          <label>
            <span>Manuscript</span>
            <textarea
              value={manuscriptText}
              onChange={event => setManuscriptText(event.target.value)}
              rows={7}
              spellCheck="true"
            />
          </label>
        ) : null}
        {mode === 'graph' ? (
          <label>
            <span>Graph JSON</span>
            <textarea
              value={graphText}
              onChange={event => setGraphText(event.target.value)}
              rows={7}
              spellCheck="false"
              placeholder='{"graphVersion":"2026.07.v1","project":{"title":"Imported Book"}}'
            />
          </label>
        ) : null}
        <button type="submit" disabled={status === 'saving'}>
          {status === 'saving' ? 'Saving' : mode === 'seed' ? 'Create project' : 'Import project'}
        </button>
      </form>
      <div className={`workspace-create-result workspace-create-${status}`} aria-live="polite">
        {created ? (
          <>
            <span>
              {activationSummary
                ? `${message}: ${activationSummary.chapterCount} chapters / ${activationSummary.sceneCount} scenes / ${activationSummary.taskCount} tasks`
                : importSummary
                ? `${message}: ${importSummary.chapterCount} chapters / ${importSummary.sceneCount} scenes`
                : message}
            </span>
            <Link href={`/projects/${created.id}/cockpit`}>Open cockpit</Link>
          </>
        ) : (
          <span>{message || (mode === 'seed' ? 'POST /api/projects' : 'POST /api/projects import')}</span>
        )}
      </div>
    </section>
  );
}

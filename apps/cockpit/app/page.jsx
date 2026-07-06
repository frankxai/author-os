import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="launch-shell">
      <section className="launch-panel">
        <p className="eyebrow">Agentic Author OS</p>
        <h1>Arcanea Author Cockpit</h1>
        <p>
          A Vercel-first workspace for manuscripts, living canon, visual story boards,
          agent runs, assets, and publishing operations.
        </p>
        <div className="launch-actions">
          <Link className="primary-link" href="/projects">
            Open workspace
          </Link>
          <Link className="secondary-link" href="/projects">
            Create or import a book
          </Link>
          <Link className="secondary-link" href="/ops">
            Production ops
          </Link>
          <Link className="secondary-link" href="/setup">
            Setup contract
          </Link>
          <Link className="secondary-link" href="/billing">
            Billing command deck
          </Link>
        </div>
      </section>
    </main>
  );
}

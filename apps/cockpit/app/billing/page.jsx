import Link from 'next/link';
import { headers } from 'next/headers';
import { offerCatalog } from '@author-os/core';
import { createBillingAccountSnapshot } from '@author-os/cloud';
import {
  createTenantContextFromHeaders,
  getHostedBillingAdapter,
} from '../../lib/hosted.js';
import BillingActions from './BillingActions.jsx';

function getOffer(offerId) {
  return offerCatalog.find(offer => offer.id === offerId) || offerCatalog[0];
}

function formatMoney(value = 0) {
  return `$${Number(value || 0).toFixed(0)}`;
}

function formatStatus(value = '') {
  return String(value || 'unconfigured').replace(/[_-]+/g, ' ');
}

function StatTile({ label, value, tone = 'neutral' }) {
  return (
    <div className={`billing-stat billing-stat-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function EvidenceRow({ label, value }) {
  return (
    <div className="billing-evidence-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function OfferCard({ offer, active }) {
  return (
    <article className={`billing-offer-card${active ? ' billing-offer-active' : ''}`}>
      <div>
        <span>{active ? 'Current' : offer.cloudIncluded ? 'Cloud' : 'Local'}</span>
        <strong>{offer.layer}</strong>
      </div>
      <p>{offer.promise}</p>
      <footer>
        <span>{offer.buyer}</span>
        <strong>{offer.price}</strong>
      </footer>
    </article>
  );
}

async function readBillingContext(requestHeaders) {
  try {
    return {
      tenant: await createTenantContextFromHeaders(requestHeaders, null),
      setupError: null,
    };
  } catch (error) {
    return {
      tenant: {
        mode: 'setup-required',
        workspaceId: 'wrk_setup_required',
        plan: process.env.AUTHOROS_DEFAULT_PLAN || 'open-core',
        entitlementSource: 'setup-required',
      },
      setupError: {
        code: error.code || 'SETUP_REQUIRED',
        message: error.message,
        status: error.status || 503,
      },
    };
  }
}

async function readBillingSnapshot(billingAdapter, tenant) {
  try {
    return {
      billing: typeof billingAdapter.getBillingStatus === 'function'
        ? await billingAdapter.getBillingStatus(tenant.workspaceId, { fallbackPlan: tenant.plan })
        : createBillingAccountSnapshot({ workspaceId: tenant.workspaceId, fallbackPlan: tenant.plan }),
      billingError: null,
    };
  } catch (error) {
    return {
      billing: createBillingAccountSnapshot({ workspaceId: tenant.workspaceId, fallbackPlan: tenant.plan }),
      billingError: {
        code: error.code || 'BILLING_STATUS_UNAVAILABLE',
        message: error.message,
        status: error.status || 503,
      },
    };
  }
}

export default async function BillingPage() {
  const requestHeaders = await headers();
  const { tenant, setupError } = await readBillingContext(requestHeaders);
  const billingAdapter = getHostedBillingAdapter();
  const { billing, billingError } = await readBillingSnapshot(billingAdapter, tenant);

  const currentOffer = getOffer(billing.plan);
  const cloudOffers = ['cloud-creator', 'cloud-studio', 'agency-small-press']
    .map(getOffer);
  const launchOffers = ['foundry-pack', 'founder-lifetime-local', 'concierge-setup']
    .map(getOffer);
  const primaryOfferId = billing.plan === 'open-core' || billing.plan === 'pro-local'
    ? 'cloud-creator'
    : billing.plan === 'cloud-creator'
      ? 'cloud-studio'
      : billing.plan;
  const entitlements = billing.entitlements || {};
  const limits = entitlements.limits || {};
  const trust = entitlements.trust || {};
  const credits = billing.entitlements?.aiCreditsIncludedUsd ?? currentOffer.aiCreditsIncludedUsd ?? 0;

  return (
    <main className="billing-shell" data-billing-shell>
      <header className="topbar billing-topbar">
        <div>
          <p className="eyebrow">Arcanea Author Cockpit</p>
          <h1>Billing command deck</h1>
        </div>
        <nav aria-label="Account routes">
          <Link href="/projects">Projects</Link>
          <Link href="/projects">Cockpit</Link>
          <Link href="/setup">Setup</Link>
          <Link href="/ops">Ops</Link>
          <Link href="/">Launch</Link>
        </nav>
        <div className="project-id">{tenant.workspaceId}</div>
      </header>

      <section className="billing-hero" aria-label="Billing account status">
        <div className="billing-plan-panel">
          <p className="eyebrow">Workspace Plan</p>
          <h2>{currentOffer.layer}</h2>
          <p>{currentOffer.promise}</p>
          {setupError ? (
            <p className="billing-setup-note">
              Setup required: {setupError.code.replace(/_/g, ' ').toLowerCase()}
            </p>
          ) : null}
          <div className="billing-status-line">
            <span className={`status-dot ${billing.status === 'active' ? 'status-clear' : 'status-warn'}`} aria-hidden="true" />
            <strong>{formatStatus(billing.status)}</strong>
            <span>{billing.source}</span>
          </div>
        </div>

        <div className="billing-action-panel">
          <div className="panel-heading">
            <span>Revenue Controls</span>
            <strong>{billing.hasStripeCustomer ? 'Customer linked' : 'No customer link'}</strong>
          </div>
          <BillingActions
            hasStripeCustomer={billing.hasStripeCustomer}
            primaryOfferId={primaryOfferId}
            offers={cloudOffers.map(offer => ({
              id: offer.id,
              layer: offer.layer,
              price: offer.price,
            }))}
          />
        </div>
      </section>

      <section className="billing-grid" aria-label="Plan capabilities and audit">
        <section className="billing-panel">
          <div className="panel-heading">
            <span>Entitlements</span>
            <strong>{entitlements.offerId || billing.plan}</strong>
          </div>
          <div className="billing-stat-grid">
            <StatTile label="Managed credits" value={formatMoney(credits)} tone="gold" />
            <StatTile label="Projects" value={limits.projects ?? 'n/a'} />
            <StatTile label="Seats" value={limits.seats ?? 'n/a'} tone="teal" />
            <StatTile label="Export anytime" value={trust.exportAnytime ? 'Yes' : 'No'} tone="green" />
          </div>
          <div className="billing-feature-list">
            {(entitlements.features || []).slice(0, 8).map(feature => (
              <span key={feature}>{feature.replace(/-/g, ' ')}</span>
            ))}
          </div>
        </section>

        <section className="billing-panel">
          <div className="panel-heading">
            <span>Billing Evidence</span>
            <strong>{billing.hasStripeCustomer ? 'Stripe linked' : 'Pending checkout'}</strong>
          </div>
          <div className="billing-evidence-list">
            <EvidenceRow label="Entitlement source" value={billing.source} />
            <EvidenceRow label="Latest entitlement" value={billing.entitlement?.id || 'none'} />
            <EvidenceRow label="Latest billing event" value={billing.lastBillingEvent?.eventType || 'none'} />
            <EvidenceRow label="Subscription linked" value={billing.stripeSubscriptionId ? 'yes' : 'no'} />
            <EvidenceRow label="Setup status" value={setupError ? setupError.code : billingError ? billingError.code : 'ready'} />
          </div>
        </section>
      </section>

      <section className="billing-offer-grid" aria-label="Cloud plans">
        {cloudOffers.map(offer => (
          <OfferCard key={offer.id} offer={offer} active={offer.id === billing.plan} />
        ))}
      </section>

      <section className="billing-ops-band" aria-label="Launch offers and service operations">
        <div>
          <span>Launch Packs</span>
          <strong>{launchOffers.map(offer => offer.layer).join(' / ')}</strong>
        </div>
        <div>
          <span>Trust Contract</span>
          <strong>Checkout does not grant access until webhook entitlement is recorded</strong>
        </div>
        <div>
          <span>Portal</span>
          <strong>{billing.hasStripeCustomer ? 'Ready for self-serve management' : 'Available after Stripe customer linkage'}</strong>
        </div>
      </section>
    </main>
  );
}

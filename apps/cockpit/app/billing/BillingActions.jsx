'use client';

import { useState } from 'react';

async function requestBillingAction(path, body = {}) {
  const response = await fetch(path, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.success) {
    const message = payload.error?.message || `Billing action failed with ${response.status}.`;
    throw new Error(message);
  }
  return payload;
}

export default function BillingActions({ hasStripeCustomer, primaryOfferId = 'cloud-creator', offers = [] }) {
  const [pendingAction, setPendingAction] = useState(null);
  const [message, setMessage] = useState('');

  async function startCheckout(offerId) {
    setPendingAction(`checkout:${offerId}`);
    setMessage('');
    try {
      const payload = await requestBillingAction('/api/billing/stripe/checkout', {
        offerId,
        successUrl: '/billing?checkout=success',
        cancelUrl: '/billing?checkout=cancelled',
      });
      window.location.assign(payload.checkout.url);
    } catch (error) {
      setMessage(error.message);
      setPendingAction(null);
    }
  }

  async function openPortal() {
    setPendingAction('portal');
    setMessage('');
    try {
      const payload = await requestBillingAction('/api/billing/stripe/portal', {
        returnUrl: '/billing',
      });
      window.location.assign(payload.portal.url);
    } catch (error) {
      setMessage(error.message);
      setPendingAction(null);
    }
  }

  return (
    <div className="billing-action-stack">
      <div className="billing-action-row">
        <button
          type="button"
          className="billing-primary-action"
          onClick={() => startCheckout(primaryOfferId)}
          disabled={Boolean(pendingAction)}
        >
          {pendingAction === `checkout:${primaryOfferId}` ? 'Opening checkout' : 'Activate cloud plan'}
        </button>
        <button
          type="button"
          className="billing-secondary-action"
          onClick={openPortal}
          disabled={Boolean(pendingAction) || !hasStripeCustomer}
        >
          {pendingAction === 'portal' ? 'Opening portal' : 'Manage billing'}
        </button>
      </div>

      <div className="billing-offer-buttons" aria-label="Checkout offers">
        {offers.map(offer => (
          <button
            type="button"
            key={offer.id}
            onClick={() => startCheckout(offer.id)}
            disabled={Boolean(pendingAction)}
          >
            <span>{offer.layer}</span>
            <strong>{pendingAction === `checkout:${offer.id}` ? 'Opening' : offer.price}</strong>
          </button>
        ))}
      </div>

      <p className="billing-action-message" role="status" aria-live="polite">
        {message || (hasStripeCustomer ? 'Stripe customer linked' : 'Checkout will link a Stripe customer after payment')}
      </p>
    </div>
  );
}

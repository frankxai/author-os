import {
  createBillingLedgerEntryFromGrant,
  createEntitlementMutationFromBillingEvent,
  normalizeBillingEvent,
  verifyStripeWebhookSignature,
} from '@author-os/cloud';
import {
  errorResponse,
  getHostedBillingAdapter,
} from '../../../../../lib/hosted.js';

export const runtime = 'nodejs';

export async function POST(request) {
  try {
    const payload = await request.text();
    const signature = request.headers.get('stripe-signature');
    const requireSignature = String(process.env.AUTHOROS_REQUIRE_AUTH || '').toLowerCase() === 'true' ||
      String(process.env.AUTHOROS_DEMO_MODE ?? 'true').toLowerCase() === 'false';

    if (process.env.STRIPE_WEBHOOK_SECRET || requireSignature) {
      verifyStripeWebhookSignature(payload, signature, process.env.STRIPE_WEBHOOK_SECRET);
    }

    const event = JSON.parse(payload);
    const billingEvent = normalizeBillingEvent(event, process.env);
    const entitlementMutation = createEntitlementMutationFromBillingEvent(billingEvent, process.env);
    const creditLedgerEntry = entitlementMutation.creditGrant
      ? createBillingLedgerEntryFromGrant(entitlementMutation.creditGrant)
      : null;
    const billingAdapter = getHostedBillingAdapter();
    const persistedBillingEventId = await billingAdapter.recordBillingEvent(billingEvent);
    const persistedEntitlementEventId = await billingAdapter.recordEntitlementMutation(entitlementMutation);
    const persistedCreditGrantId = entitlementMutation.creditGrant
      ? await billingAdapter.recordCreditGrant(entitlementMutation.creditGrant)
      : null;

    return Response.json({
      success: true,
      mode: process.env.STRIPE_WEBHOOK_SECRET ? 'verified' : 'demo-unverified',
      persistence: String(process.env.AUTHOROS_DEMO_MODE ?? 'true').toLowerCase() !== 'false'
        ? 'demo_memory'
        : 'adapter_save_called',
      persisted: {
        billingEventId: persistedBillingEventId,
        entitlementEventId: persistedEntitlementEventId,
        creditGrantId: persistedCreditGrantId,
      },
      billingEvent,
      entitlementMutation,
      creditLedgerEntry,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

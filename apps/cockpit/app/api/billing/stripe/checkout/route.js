import {
  createStripeCheckoutSessionPlan,
  sanitizeStripeCheckoutSessionPlan,
} from '@author-os/cloud';
import {
  createTenantContextFromRequest,
  errorResponse,
  getHostedBillingAdapter,
  getHostedCheckoutClient,
} from '../../../../../lib/hosted.js';

export const runtime = 'nodejs';

function relativePath(value, fallback) {
  const text = String(value || '').trim();
  return text.startsWith('/') && !text.startsWith('//') ? text : fallback;
}

export async function POST(request) {
  try {
    const tenant = await createTenantContextFromRequest(request, null);
    const body = await request.json().catch(() => ({}));
    const requestOrigin = new URL(request.url).origin;
    const plan = createStripeCheckoutSessionPlan({
      ...body,
      workspaceId: tenant.workspaceId,
      userId: tenant.userId,
      baseUrl: process.env.NEXT_PUBLIC_APP_URL || requestOrigin,
      successUrl: relativePath(body.successUrl, '/checkout/success?session_id={CHECKOUT_SESSION_ID}'),
      cancelUrl: relativePath(body.cancelUrl, '/checkout/cancel'),
      allowLookupPrice: tenant.mode === 'demo',
    }, process.env);

    const checkoutClient = getHostedCheckoutClient();
    const checkout = await checkoutClient.createCheckoutSession(plan);
    const sanitizedPlan = sanitizeStripeCheckoutSessionPlan(plan);
    const billingEvent = {
      id: `checkout_${checkout.id}`,
      provider: 'stripe',
      providerEventId: checkout.id,
      eventType: 'checkout.session.created',
      workspaceId: tenant.workspaceId,
      userId: tenant.userId,
      offerId: plan.offerId,
      stripeCustomerId: checkout.customerId || null,
      stripeSubscriptionId: null,
      status: checkout.status || 'open',
      payload: {
        checkout: {
          id: checkout.id,
          url: checkout.url,
          status: checkout.status,
          mode: checkout.mode,
          livemode: checkout.livemode,
          offerId: plan.offerId,
          priceId: plan.priceId,
        },
        plan: sanitizedPlan,
      },
    };
    const billingAdapter = getHostedBillingAdapter();
    const persistedBillingEventId = await billingAdapter.recordBillingEvent(billingEvent);

    return Response.json({
      success: true,
      mode: checkoutClient.mode === 'demo' ? 'demo' : 'stripe',
      persistence: tenant.mode === 'demo' ? 'demo_memory' : 'adapter_save_called',
      persisted: {
        billingEventId: persistedBillingEventId,
      },
      tenant: {
        mode: tenant.mode,
        workspaceId: tenant.workspaceId,
        plan: tenant.plan,
      },
      checkout: {
        id: checkout.id,
        url: checkout.url,
        status: checkout.status,
        mode: checkout.mode,
        offerId: plan.offerId,
        priceId: plan.priceId,
      },
      plan: sanitizedPlan,
    }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

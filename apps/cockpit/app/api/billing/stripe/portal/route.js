import {
  createBillingAccountSnapshot,
  createStripeBillingPortalSessionPlan,
  sanitizeStripeBillingPortalSessionPlan,
} from '@author-os/cloud';
import {
  createTenantContextFromRequest,
  errorResponse,
  getHostedBillingAdapter,
  getHostedBillingPortalClient,
} from '../../../../../lib/hosted.js';

export const runtime = 'nodejs';

function codedError(message, code, status = 400) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  return error;
}

function relativePath(value, fallback) {
  const text = String(value || '').trim();
  return text.startsWith('/') && !text.startsWith('//') ? text : fallback;
}

export async function POST(request) {
  try {
    const tenant = await createTenantContextFromRequest(request, null);
    const body = await request.json().catch(() => ({}));
    const requestOrigin = new URL(request.url).origin;
    const billingAdapter = getHostedBillingAdapter();
    const billing = typeof billingAdapter.getBillingStatus === 'function'
      ? await billingAdapter.getBillingStatus(tenant.workspaceId, { fallbackPlan: tenant.plan })
      : createBillingAccountSnapshot({ workspaceId: tenant.workspaceId, fallbackPlan: tenant.plan });

    if (!billing.stripeCustomerId) {
      throw codedError('No Stripe customer is linked to this workspace yet. Complete checkout before opening billing management.', 'STRIPE_CUSTOMER_REQUIRED', 409);
    }

    const plan = createStripeBillingPortalSessionPlan({
      stripeCustomerId: billing.stripeCustomerId,
      workspaceId: tenant.workspaceId,
      userId: tenant.userId,
      baseUrl: process.env.NEXT_PUBLIC_APP_URL || requestOrigin,
      returnUrl: relativePath(body.returnUrl, '/billing'),
      locale: body.locale,
    }, process.env);
    const portalClient = getHostedBillingPortalClient();
    const portal = await portalClient.createBillingPortalSession(plan);
    const sanitizedPlan = sanitizeStripeBillingPortalSessionPlan(plan);
    const billingEvent = {
      id: `portal_${portal.id}`,
      provider: 'stripe',
      providerEventId: portal.id,
      eventType: 'billing_portal.session.created',
      workspaceId: tenant.workspaceId,
      userId: tenant.userId,
      offerId: billing.plan,
      stripeCustomerId: billing.stripeCustomerId,
      stripeSubscriptionId: billing.stripeSubscriptionId || null,
      status: 'created',
      payload: {
        portal: {
          id: portal.id,
          url: portal.url,
          livemode: portal.livemode,
          returnUrl: portal.returnUrl,
        },
        plan: sanitizedPlan,
        billing: {
          plan: billing.plan,
          status: billing.status,
          source: billing.source,
          entitlementId: billing.entitlement?.id || null,
        },
      },
    };
    const persistedBillingEventId = await billingAdapter.recordBillingEvent(billingEvent);

    return Response.json({
      success: true,
      mode: portalClient.mode === 'demo' ? 'demo' : 'stripe',
      persistence: tenant.mode === 'demo' ? 'demo_memory' : 'adapter_save_called',
      persisted: {
        billingEventId: persistedBillingEventId,
      },
      tenant: {
        mode: tenant.mode,
        workspaceId: tenant.workspaceId,
        plan: tenant.plan,
        entitlementSource: tenant.entitlementSource || 'request-context',
      },
      portal: {
        id: portal.id,
        url: portal.url,
        returnUrl: portal.returnUrl,
      },
      plan: sanitizedPlan,
    }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

import { createBillingAccountSnapshot } from '@author-os/cloud';
import {
  createTenantContextFromRequest,
  errorResponse,
  getHostedBillingAdapter,
} from '../../../../lib/hosted.js';

function sanitizeBillingStatus(status = {}) {
  return {
    workspaceId: status.workspaceId,
    generatedAt: status.generatedAt,
    plan: status.plan,
    status: status.status,
    source: status.source,
    hasStripeCustomer: Boolean(status.stripeCustomerId || status.hasStripeCustomer),
    hasStripeSubscription: Boolean(status.stripeSubscriptionId),
    entitlement: status.entitlement,
    entitlements: status.entitlements,
    lastBillingEvent: status.lastBillingEvent,
  };
}

export async function GET(request) {
  try {
    const tenant = await createTenantContextFromRequest(request, null);
    const billingAdapter = getHostedBillingAdapter();
    const status = typeof billingAdapter.getBillingStatus === 'function'
      ? await billingAdapter.getBillingStatus(tenant.workspaceId, { fallbackPlan: tenant.plan })
      : createBillingAccountSnapshot({ workspaceId: tenant.workspaceId, fallbackPlan: tenant.plan });

    return Response.json({
      success: true,
      tenant: {
        mode: tenant.mode,
        workspaceId: tenant.workspaceId,
        plan: tenant.plan,
        entitlementSource: tenant.entitlementSource || 'request-context',
      },
      billing: sanitizeBillingStatus(status),
    });
  } catch (error) {
    return errorResponse(error);
  }
}

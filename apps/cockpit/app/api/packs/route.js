import { buildPackRegistry, createEntitlementSnapshot } from '@author-os/core';
import {
  createTenantContextFromRequest,
  errorResponse,
  getHostedProjectService,
} from '../../../lib/hosted.js';

function createSetupLockedPackListing(error) {
  const status = error.status || 503;
  return {
    success: true,
    generatedAt: new Date().toISOString(),
    tenant: null,
    access: {
      allowed: false,
      reason: error.code || 'SETUP_REQUIRED',
      entitlements: createEntitlementSnapshot('open-core'),
    },
    packAccess: {
      allowed: false,
      reason: 'setup_required',
      requiredPlan: 'cloud-creator',
    },
    registry: buildPackRegistry(),
    setupError: {
      code: error.code || 'SETUP_REQUIRED',
      message: error.message,
      status,
    },
  };
}

export async function GET(request) {
  try {
    const tenant = await createTenantContextFromRequest(request, null);
    const service = getHostedProjectService();
    return Response.json(await service.listPacks(tenant));
  } catch (error) {
    if (error.status === 401 || error.status === 503) {
      return Response.json(createSetupLockedPackListing(error));
    }
    return errorResponse(error);
  }
}

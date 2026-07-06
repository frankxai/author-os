import { createServiceIntake } from '@author-os/cloud';
import {
  createTenantContextFromRequest,
  errorResponse,
  getHostedBillingAdapter,
} from '../../../lib/hosted.js';

export async function POST(request) {
  try {
    const tenant = await createTenantContextFromRequest(request, null);
    const body = await request.json();
    const intake = createServiceIntake({
      workspaceId: tenant.workspaceId,
      userId: tenant.userId,
      offerId: body.offerId || 'concierge-setup',
      authorName: body.authorName,
      email: body.email,
      projectTitle: body.projectTitle,
      manuscriptState: body.manuscriptState,
      goals: Array.isArray(body.goals) ? body.goals : [],
      constraints: Array.isArray(body.constraints) ? body.constraints : [],
      requestedServices: Array.isArray(body.requestedServices) ? body.requestedServices : [],
    });
    const billingAdapter = getHostedBillingAdapter();
    const persistenceId = await billingAdapter.recordServiceIntake(intake);

    return Response.json({
      success: true,
      persistence: tenant.mode === 'demo' ? 'demo_memory' : 'adapter_save_called',
      persistenceId,
      tenant: {
        mode: tenant.mode,
        workspaceId: tenant.workspaceId,
        plan: tenant.plan,
      },
      intake,
    }, { status: 202 });
  } catch (error) {
    return errorResponse(error);
  }
}

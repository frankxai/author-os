import {
  createTenantContextFromRequest,
  errorResponse,
  getHostedProjectService,
} from '../../../lib/hosted.js';

export async function GET(request) {
  try {
    const tenant = await createTenantContextFromRequest(request, null);
    const service = getHostedProjectService();
    return Response.json(await service.listPacks(tenant));
  } catch (error) {
    return errorResponse(error);
  }
}

import {
  createTenantContextFromRequest,
  errorResponse,
  getHostedProjectService,
} from '../../../../../lib/hosted.js';

export async function GET(request, { params }) {
  const { id } = await params;
  try {
    const tenant = await createTenantContextFromRequest(request, id);
    const service = getHostedProjectService();
    return Response.json(await service.readProjectContext(id, tenant));
  } catch (error) {
    return errorResponse(error);
  }
}

import {
  createTenantContextFromRequest,
  errorResponse,
  getHostedProjectService,
} from '../../../../../lib/hosted.js';

export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const tenant = await createTenantContextFromRequest(request, id);
    const body = await request.json().catch(() => ({}));
    const service = getHostedProjectService();
    return Response.json(await service.installPack(id, tenant, body), { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

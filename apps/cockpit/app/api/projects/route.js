import {
  createTenantContextFromRequest,
  errorResponse,
  getHostedProjectService,
} from '../../../lib/hosted.js';

export async function GET(request) {
  try {
    const tenant = await createTenantContextFromRequest(request, null);
    const url = new URL(request.url);
    const limit = Number(url.searchParams.get('limit') || 50);
    const service = getHostedProjectService();
    return Response.json(await service.listProjects(tenant, { limit }));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request) {
  try {
    const tenant = await createTenantContextFromRequest(request, null);
    const body = await request.json().catch(() => ({}));
    const service = getHostedProjectService();
    return Response.json(await service.createProject(tenant, body), { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

import {
  createTenantContextFromRequest,
  errorResponse,
  getHostedWorkflowService,
} from '../../../../../../../lib/hosted.js';

export async function POST(request, { params }) {
  const { id, suggestionId } = await params;
  try {
    const tenant = await createTenantContextFromRequest(request, id);
    const body = await request.json();
    const service = getHostedWorkflowService();
    return Response.json(await service.decideSuggestion(id, tenant, suggestionId, body), { status: 202 });
  } catch (error) {
    return errorResponse(error);
  }
}

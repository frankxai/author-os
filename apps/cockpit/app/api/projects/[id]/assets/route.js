import {
  createTenantContextFromRequest,
  errorResponse,
  getHostedAssetService,
} from '../../../../../lib/hosted.js';

export async function GET(request, { params }) {
  const { id } = await params;
  try {
    const tenant = await createTenantContextFromRequest(request, id);
    const url = new URL(request.url);
    const service = getHostedAssetService();
    return Response.json(await service.listAssets(id, tenant, {
      limit: Number(url.searchParams.get('limit') || 100),
      type: url.searchParams.get('type') || null,
    }));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request, { params }) {
  const { id } = await params;
  try {
    const tenant = await createTenantContextFromRequest(request, id);
    const body = await request.json().catch(() => ({}));
    const service = getHostedAssetService();
    return Response.json(await service.createAsset(id, tenant, body), { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

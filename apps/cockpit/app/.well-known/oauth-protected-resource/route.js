import { getMcpProtectedResourceMetadata } from '../../../lib/hosted.js';

export async function GET(request) {
  return Response.json(getMcpProtectedResourceMetadata(request), {
    headers: {
      'cache-control': 'no-store',
    },
  });
}

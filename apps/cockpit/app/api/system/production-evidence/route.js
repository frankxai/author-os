import {
  getHostedProductionEvidence,
} from '../../../../lib/hosted.js';

export async function GET() {
  return Response.json(getHostedProductionEvidence());
}

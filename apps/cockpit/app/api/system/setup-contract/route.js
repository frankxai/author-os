import {
  getHostedRuntimeInfo,
  getProductionSetupContract,
} from '../../../../lib/hosted.js';

export async function GET() {
  return Response.json({
    service: 'arcanea-author-cockpit',
    generatedAt: new Date().toISOString(),
    setupContract: getProductionSetupContract(),
    runtime: getHostedRuntimeInfo(),
  });
}

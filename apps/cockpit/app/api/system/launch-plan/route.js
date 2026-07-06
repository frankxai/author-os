import {
  getHostedRuntimeInfo,
  getLaunchOperationsPlan,
} from '../../../../lib/hosted.js';

export async function GET() {
  return Response.json({
    service: 'arcanea-author-cockpit',
    generatedAt: new Date().toISOString(),
    launchPlan: getLaunchOperationsPlan(),
    runtime: getHostedRuntimeInfo(),
  });
}

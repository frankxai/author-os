import {
  getCloudReadiness,
  getHostedRuntimeInfo,
  getProductionLaunchReadiness,
} from '../../../../lib/hosted.js';

export async function GET() {
  return Response.json({
    service: 'arcanea-author-cockpit',
    generatedAt: new Date().toISOString(),
    cloud: getCloudReadiness(),
    launch: getProductionLaunchReadiness(),
    runtime: getHostedRuntimeInfo(),
  });
}

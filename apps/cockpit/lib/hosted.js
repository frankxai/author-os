import {
  createAiGatewayAdapter,
  createDryRunAiAdapter,
  createModelDeploymentConfigFromEnv,
  createUnconfiguredAiAdapter,
} from '@author-os/ai';
import {
  createBlobAssetAdapter,
  createDemoBillingPortalClient,
  createDemoCheckoutClient,
  createDemoAssetAdapter,
  createCloudReadinessChecklist,
  createDemoBillingAdapter,
  createDemoProjectAdapter,
  createHostedAssetService,
  createHostedProjectService,
  createHostedWorkflowService,
  createHostedRequestContext,
  createMcpProtectedResourceMetadata,
  createMcpWwwAuthenticateHeader,
  createLaunchOperationsPlan,
  createProductionEvidenceReport,
  createProductionLaunchChecklist,
  createProductionSetupContract,
  createStripeBillingPortalClient,
  createStripeCheckoutClient,
  createUnconfiguredAssetAdapter,
  createUnconfiguredBillingAdapter,
  createUnconfiguredBillingPortalClient,
  createUnconfiguredCheckoutClient,
  createUnconfiguredProjectAdapter,
  isAuthorOsDemoMode,
  isHostedProductionTarget,
} from '@author-os/cloud';
import {
  createVercelMarketplacePostgresBillingAdapter,
  createVercelMarketplacePostgresProjectAdapter,
  getPostgresRuntimeInfo,
} from './postgres.js';
import { resolveHostedAuthContext } from './auth.js';

function isDemoRuntime(env = process.env) {
  return isAuthorOsDemoMode(env);
}

function hasPostgresConnectionString(env = process.env) {
  return Boolean(env.POSTGRES_URL || env.DATABASE_URL || env.POSTGRES_PRISMA_URL);
}

function createRuntimeProjectAdapter(env = process.env) {
  if (isDemoRuntime(env)) return createDemoProjectAdapter();
  if (env.AUTHOROS_PROJECT_ADAPTER === 'postgres') {
    if (!hasPostgresConnectionString(env)) {
      return createUnconfiguredProjectAdapter({
        reason: 'Postgres project adapter is selected, but no POSTGRES_URL or DATABASE_URL is configured yet.',
      });
    }
    return createVercelMarketplacePostgresProjectAdapter({ env });
  }
  return createUnconfiguredProjectAdapter({
    reason: 'Production project adapter is not configured. Set AUTHOROS_PROJECT_ADAPTER=postgres and wire a tenant-scoped Vercel Postgres adapter before serving author data.',
  });
}

function createRuntimeBillingAdapter(env = process.env) {
  if (isDemoRuntime(env)) return createDemoBillingAdapter();
  if (env.AUTHOROS_PROJECT_ADAPTER === 'postgres') {
    if (!hasPostgresConnectionString(env)) {
      return createUnconfiguredBillingAdapter({
        reason: 'Postgres billing adapter is selected, but no POSTGRES_URL or DATABASE_URL is configured yet.',
      });
    }
    return createVercelMarketplacePostgresBillingAdapter({ env });
  }
  return createUnconfiguredBillingAdapter({
    reason: 'Production billing adapter is not configured. Set AUTHOROS_PROJECT_ADAPTER=postgres and attach Marketplace Postgres before accepting billing or service-intake writes.',
  });
}

function createRuntimeAssetAdapter(env = process.env) {
  if (isDemoRuntime(env)) return createDemoAssetAdapter();
  if (!env.BLOB_READ_WRITE_TOKEN) {
    return createUnconfiguredAssetAdapter({
      reason: 'Production asset storage is not configured. Attach Vercel Blob and set BLOB_READ_WRITE_TOKEN before accepting binary asset uploads.',
    });
  }
  return createBlobAssetAdapter({
    put: async (...args) => {
      const { put } = await import('@vercel/blob');
      return put(...args);
    },
    remove: async (...args) => {
      const { del } = await import('@vercel/blob');
      return del(...args);
    },
  });
}

function createRuntimeAiAdapter(env = process.env) {
  if (isDemoRuntime(env)) {
    return createDryRunAiAdapter({ env, environment: 'demo' });
  }
  if (!env.AI_GATEWAY_API_KEY && !env.VERCEL_AI_GATEWAY_API_KEY && !env.VERCEL_OIDC_TOKEN) {
    return createUnconfiguredAiAdapter({
      reason: 'Production AI Gateway is not configured. Enable Vercel AI Gateway with OIDC or set AI_GATEWAY_API_KEY before accepting managed model runs.',
    });
  }
  return createAiGatewayAdapter({
    env,
    deploymentConfig: createModelDeploymentConfigFromEnv(env),
    generateText: async (...args) => {
      const { generateText } = await import('ai');
      return generateText(...args);
    },
    fallbackAdapter: createDryRunAiAdapter({ env, environment: env.VERCEL_ENV || 'production' }),
  });
}

function createRuntimeCheckoutClient(env = process.env) {
  if (isDemoRuntime(env)) return createDemoCheckoutClient();
  if (!env.STRIPE_SECRET_KEY) {
    return createUnconfiguredCheckoutClient({
      reason: 'Production Stripe checkout is not configured. Set STRIPE_SECRET_KEY before accepting paid checkouts.',
    });
  }
  return createStripeCheckoutClient({
    secretKey: env.STRIPE_SECRET_KEY,
    fetchImpl: fetch,
  });
}

function createRuntimeBillingPortalClient(env = process.env) {
  if (isDemoRuntime(env)) return createDemoBillingPortalClient();
  if (!env.STRIPE_SECRET_KEY) {
    return createUnconfiguredBillingPortalClient({
      reason: 'Production Stripe billing portal is not configured. Set STRIPE_SECRET_KEY and enable Customer Portal before accepting subscription management.',
    });
  }
  return createStripeBillingPortalClient({
    secretKey: env.STRIPE_SECRET_KEY,
    fetchImpl: fetch,
  });
}

const projectAdapter = createRuntimeProjectAdapter(process.env);
const billingAdapter = createRuntimeBillingAdapter(process.env);
const assetAdapter = createRuntimeAssetAdapter(process.env);
const aiAdapter = createRuntimeAiAdapter(process.env);
const checkoutClient = createRuntimeCheckoutClient(process.env);
const billingPortalClient = createRuntimeBillingPortalClient(process.env);
const hostedProjectService = createHostedProjectService({ projectAdapter });
const hostedWorkflowService = createHostedWorkflowService({ projectAdapter, aiAdapter });
const hostedAssetService = createHostedAssetService({ projectAdapter, assetAdapter });

async function applyBillingEntitlementContext(context) {
  if (!context?.workspaceId || typeof billingAdapter.getLatestEntitlement !== 'function') {
    return context;
  }
  const latest = await billingAdapter.getLatestEntitlement(context.workspaceId);
  if (!latest) return context;
  const billingPlan = latest.status === 'active'
    ? latest.offerId
    : latest.status === 'cancelled'
      ? 'open-core'
      : null;
  if (!billingPlan) return context;
  return {
    ...context,
    plan: billingPlan,
    entitlementSource: 'billing',
    billingEntitlementId: latest.id,
    billingEntitlementStatus: latest.status,
  };
}

export async function createTenantContextFromHeaders(headers, projectId) {
  const auth = await resolveHostedAuthContext({
    headers,
    projectId,
    env: process.env,
  });
  return applyBillingEntitlementContext(createHostedRequestContext({
    headers,
    projectId,
    env: process.env,
    auth,
  }));
}

export async function createTenantContextFromRequest(request, projectId) {
  const auth = await resolveHostedAuthContext({
    request,
    projectId,
    env: process.env,
  });
  return applyBillingEntitlementContext(createHostedRequestContext({
    request,
    projectId,
    env: process.env,
    auth,
  }));
}

export function getHostedProjectService() {
  return hostedProjectService;
}

export function getHostedWorkflowService() {
  return hostedWorkflowService;
}

export function getHostedAssetService() {
  return hostedAssetService;
}

export function getHostedBillingAdapter() {
  return billingAdapter;
}

export function getHostedCheckoutClient() {
  return checkoutClient;
}

export function getHostedBillingPortalClient() {
  return billingPortalClient;
}

export function getCloudReadiness() {
  return createCloudReadinessChecklist(process.env);
}

export function getProductionLaunchReadiness() {
  return createProductionLaunchChecklist(process.env);
}

export function getLaunchOperationsPlan() {
  return createLaunchOperationsPlan({
    env: process.env,
    project: process.env.VERCEL_PROJECT_ID || 'author-os',
  });
}

export function getProductionSetupContract() {
  return createProductionSetupContract({
    env: process.env,
    project: process.env.VERCEL_PROJECT_ID || 'author-os',
    environments: ['production', 'preview'],
  });
}

export function getHostedProductionEvidence() {
  return createProductionEvidenceReport({
    env: process.env,
    project: process.env.VERCEL_PROJECT_ID || 'author-os',
    environments: ['production', 'preview'],
    runtime: getHostedRuntimeInfo(),
    previewVerified: String(process.env.AUTHOROS_PREVIEW_VERIFIED || '').toLowerCase() === 'true',
  });
}

export function getMcpProtectedResourceMetadata(request) {
  return createMcpProtectedResourceMetadata({
    env: process.env,
    requestUrl: request?.url,
    resourcePath: '/api/mcp',
  });
}

export function getMcpWwwAuthenticateHeader(request, scopes = []) {
  return createMcpWwwAuthenticateHeader({
    env: process.env,
    requestUrl: request?.url,
    resourcePath: '/api/mcp',
    scopes,
    error: 'invalid_token',
    errorDescription: 'Authenticate with an AuthorOS token scoped to the hosted MCP resource.',
  });
}

export function getHostedRuntimeInfo() {
  const productionTarget = isHostedProductionTarget(process.env);
  return {
    projectAdapter: isDemoRuntime(process.env)
      ? 'demo'
      : process.env.AUTHOROS_PROJECT_ADAPTER || 'unconfigured',
    auth: {
      provider: process.env.AUTHOROS_AUTH_PROVIDER || (isDemoRuntime(process.env) ? 'header-demo' : 'unconfigured'),
      required: productionTarget || String(process.env.AUTHOROS_REQUIRE_AUTH || '').toLowerCase() === 'true',
      trustedHeaderAuth: String(process.env.AUTHOROS_ALLOW_TRUSTED_AUTH_HEADERS || '').toLowerCase() === 'true',
    },
    postgres: getPostgresRuntimeInfo(process.env),
    checkout: isDemoRuntime(process.env)
      ? 'demo'
      : process.env.STRIPE_SECRET_KEY ? 'stripe' : 'unconfigured',
    billingPortal: isDemoRuntime(process.env)
      ? 'demo'
      : process.env.STRIPE_SECRET_KEY ? 'stripe' : 'unconfigured',
  };
}

export function errorResponse(error, options = {}) {
  return Response.json({
    success: false,
    error: {
      code: error.code || 'HOSTED_AUTHOR_OS_ERROR',
      message: error.message,
    },
  }, {
    status: error.status || 500,
    headers: options.headers || undefined,
  });
}

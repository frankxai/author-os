function envFlag(env, key, expected = 'true') {
  return String(env[key] ?? '').toLowerCase() === expected;
}

function createAuthError(message, code, status = 401) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  return error;
}

function readPath(source, path) {
  return String(path).split('.').reduce((value, part) => {
    if (!value || typeof value !== 'object') return null;
    return value[part] ?? null;
  }, source);
}

function readClaim(claims = {}, names = []) {
  for (const name of names) {
    const direct = readPath(claims, name);
    if (direct) return direct;
    const publicValue = readPath(claims.publicMetadata, name) || readPath(claims.metadata, name);
    if (publicValue) return publicValue;
  }
  return null;
}

function splitList(value) {
  if (Array.isArray(value)) return value.map(item => String(item).trim()).filter(Boolean);
  if (!value) return [];
  return String(value).split(',').map(item => item.trim()).filter(Boolean);
}

function normalizeWorkspaceId(value) {
  if (!value) return null;
  return String(value).replace(/[^a-zA-Z0-9_-]/g, '_');
}

function mapClerkRole(value) {
  if (!value) return null;
  const role = String(value).toLowerCase().replace(/^org:/, '');
  if (role === 'admin' || role === 'owner') return 'owner';
  if (role === 'member' || role === 'editor') return 'editor';
  if (role === 'viewer') return 'viewer';
  return role;
}

function createRoleList(authResult = {}, claims = {}, env = process.env, workspaceId = null, userId = null) {
  const claimRoles = splitList(readClaim(claims, [
    'authorosRoles',
    'authorOsRoles',
    'author_roles',
    'roles',
  ]));
  const roles = [
    mapClerkRole(authResult.orgRole),
    ...claimRoles.map(mapClerkRole),
  ].filter(Boolean);

  if (roles.length) return [...new Set(roles)];
  const defaultRole = env.AUTHOROS_DEFAULT_AUTH_ROLE || (workspaceId === `usr_${normalizeWorkspaceId(userId)}` ? 'owner' : 'editor');
  return [mapClerkRole(defaultRole) || 'editor'];
}

export async function resolveHostedAuthContext(input = {}) {
  const env = input.env || process.env;
  const requireAuth = envFlag(env, 'AUTHOROS_REQUIRE_AUTH');
  const provider = String(env.AUTHOROS_AUTH_PROVIDER || '').toLowerCase();
  const allowTrustedHeaderAuth = envFlag(env, 'AUTHOROS_ALLOW_TRUSTED_AUTH_HEADERS');

  if (provider !== 'clerk') {
    if (requireAuth && !allowTrustedHeaderAuth) {
      throw createAuthError(
        'Hosted AuthorOS requires AUTHOROS_AUTH_PROVIDER=clerk or an explicitly trusted gateway header configuration.',
        'AUTH_PROVIDER_NOT_CONFIGURED',
        503,
      );
    }
    return null;
  }

  if (requireAuth && !env.CLERK_SECRET_KEY) {
    throw createAuthError(
      'Clerk auth is required, but CLERK_SECRET_KEY is not configured.',
      'AUTH_PROVIDER_NOT_CONFIGURED',
      503,
    );
  }

  if (!requireAuth && !env.CLERK_SECRET_KEY && !env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    return null;
  }

  let authResult;
  try {
    const { auth } = await import('@clerk/nextjs/server');
    authResult = await auth();
  } catch (error) {
    if (!requireAuth) return null;
    throw createAuthError(
      `Clerk authentication could not be initialized: ${error.message}`,
      'AUTH_PROVIDER_NOT_CONFIGURED',
      503,
    );
  }

  if (!authResult?.userId) {
    if (!requireAuth) return null;
    throw createAuthError(
      'Hosted AuthorOS requires an authenticated Clerk user.',
      'AUTH_REQUIRED',
      401,
    );
  }

  const claims = authResult.sessionClaims || {};
  const userId = String(authResult.userId);
  const workspaceId = normalizeWorkspaceId(
    authResult.orgId ||
    readClaim(claims, [
      'authorosWorkspaceId',
      'authorOsWorkspaceId',
      'workspaceId',
      'workspace_id',
    ]) ||
    `usr_${normalizeWorkspaceId(userId)}`,
  );

  return {
    verified: true,
    source: 'clerk',
    authProvider: 'clerk',
    userId,
    workspaceId,
    plan: readClaim(claims, [
      'authorosPlan',
      'authorOsPlan',
      'plan',
      'planId',
      'offerId',
    ]) || env.AUTHOROS_DEFAULT_PLAN || 'cloud-creator',
    roles: createRoleList(authResult, claims, env, workspaceId, userId),
  };
}

const DEFAULT_WORKSPACE_REDIRECT = '/projects';

function normalizePublicOrigin(value) {
  if (!value) return null;
  try {
    const url = new URL(String(value).startsWith('http') ? value : `https://${value}`);
    if (url.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(url.hostname)) return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function normalizeWorkspaceRedirect(value, env = process.env) {
  const rawValue = String(value || '').trim();
  if (!rawValue) return DEFAULT_WORKSPACE_REDIRECT;
  if (rawValue.startsWith('/') && !rawValue.startsWith('//')) return rawValue;

  const allowedOrigin = normalizePublicOrigin(env.NEXT_PUBLIC_APP_URL);
  if (!allowedOrigin) return DEFAULT_WORKSPACE_REDIRECT;

  try {
    const url = new URL(rawValue);
    if (url.origin !== allowedOrigin) return DEFAULT_WORKSPACE_REDIRECT;
    return `${url.pathname || DEFAULT_WORKSPACE_REDIRECT}${url.search}${url.hash}`;
  } catch {
    return DEFAULT_WORKSPACE_REDIRECT;
  }
}

export function getAuthRedirectConfig(env = process.env) {
  return {
    signInFallbackRedirectUrl: normalizeWorkspaceRedirect(
      env.NEXT_PUBLIC_AUTHOROS_AFTER_SIGN_IN_URL
        || env.NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL
        || env.NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL,
      env,
    ),
    signUpFallbackRedirectUrl: normalizeWorkspaceRedirect(
      env.NEXT_PUBLIC_AUTHOROS_AFTER_SIGN_UP_URL
        || env.NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL
        || env.NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL,
      env,
    ),
  };
}

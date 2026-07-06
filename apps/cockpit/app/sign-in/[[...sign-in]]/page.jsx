import { SignIn } from '@clerk/nextjs';
import { getAuthRedirectConfig } from '../../../lib/auth-redirects.js';

export default function SignInPage() {
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  const redirects = getAuthRedirectConfig(process.env);

  return (
    <main className="auth-shell">
      <section className="auth-panel" aria-label="Sign in">
        <p className="eyebrow">Arcanea Author Cockpit</p>
        <h1>Sign in to your author workspace</h1>
        {publishableKey ? (
          <SignIn routing="path" path="/sign-in" signUpUrl="/sign-up" fallbackRedirectUrl={redirects.signInFallbackRedirectUrl} />
        ) : (
          <p>Clerk is not configured for this environment yet.</p>
        )}
      </section>
    </main>
  );
}

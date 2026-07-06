import { SignUp } from '@clerk/nextjs';
import { getAuthRedirectConfig } from '../../../lib/auth-redirects.js';

export default function SignUpPage() {
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  const redirects = getAuthRedirectConfig(process.env);

  return (
    <main className="auth-shell">
      <section className="auth-panel" aria-label="Sign up">
        <p className="eyebrow">Arcanea Author Cockpit</p>
        <h1>Create your author workspace</h1>
        {publishableKey ? (
          <SignUp routing="path" path="/sign-up" signInUrl="/sign-in" fallbackRedirectUrl={redirects.signUpFallbackRedirectUrl} />
        ) : (
          <p>Clerk is not configured for this environment yet.</p>
        )}
      </section>
    </main>
  );
}

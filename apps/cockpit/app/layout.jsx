import { ClerkProvider } from '@clerk/nextjs';
import './globals.css';

export const metadata = {
  title: 'Arcanea Author Cockpit',
  description: 'Agentic Author OS hosted cockpit for manuscripts, canon, canvas, agents, assets, and publishing ops.',
};

export default function RootLayout({ children }) {
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  const body = publishableKey
    ? (
        <ClerkProvider publishableKey={publishableKey}>
          {children}
        </ClerkProvider>
      )
    : children;

  return (
    <html lang="en">
      <body>{body}</body>
    </html>
  );
}

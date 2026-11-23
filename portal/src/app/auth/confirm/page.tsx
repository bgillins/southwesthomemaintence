import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { verifyLink } from '@/app/actions/auth';

export const metadata: Metadata = { title: 'Confirm sign in' };

export default async function ConfirmPage({ searchParams }: { searchParams: Promise<{ token_hash?: string }> }) {
  const { token_hash: tokenHash } = await searchParams;
  if (!tokenHash) redirect('/login');

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5">
      <div className="card p-6 text-center">
        <h1 className="text-2xl">Almost there</h1>
        <p className="mt-2 text-navy-muted">Tap the button to finish signing in on this device.</p>
        <form action={verifyLink} className="mt-5">
          <input type="hidden" name="token_hash" value={tokenHash} />
          <button type="submit" className="btn btn-primary w-full">Sign in</button>
        </form>
      </div>
    </main>
  );
}

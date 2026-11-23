import type { Metadata } from 'next';
import Image from 'next/image';
import { LoginForm } from './LoginForm';

export const metadata: Metadata = { title: 'Sign in' };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ expired?: string }> }) {
  const { expired } = await searchParams;
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-10">
      <Image src="/logo.png" alt="Southwest Home Maintenance" width={1200} height={497} priority className="mx-auto h-auto w-56" />
      <div className="card mt-8 p-6">
        <h1 className="text-2xl">Team sign in</h1>
        {expired ? (
          <p className="mt-3 rounded-xl bg-gold-tint px-3.5 py-3 text-sm text-gold-ink">That sign-in link has expired or was already used. Ask for a new code below.</p>
        ) : null}
        <LoginForm />
      </div>
    </main>
  );
}

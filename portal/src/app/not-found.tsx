import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 text-center">
      <h1 className="text-3xl">We could not find that page</h1>
      <p className="mt-2 text-navy-muted">The link may be mistyped or no longer active.</p>
      <Link href="/" className="btn btn-primary mx-auto mt-6">Go to the portal</Link>
    </main>
  );
}

import { redirect } from 'next/navigation';
import { signOut } from '@/app/actions/auth';
import { Nav } from '@/components/Nav';
import { getStaff } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

// Everything inside (app) is for signed-in staff only.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const staff = await getStaff();

  if (!staff) {
    // Signed in to Supabase but not on this team (for example, a login from
    // another app on the same account system). Show a dead end, not the data.
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    if (!data.user) redirect('/login');
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5">
        <div className="card p-6">
          <h1 className="text-2xl">No access yet</h1>
          <p className="mt-2 text-navy-muted">
            {data.user.email} is not on the Southwest Home Maintenance team. Ask the owner to add you on the Team page.
          </p>
          <form action={signOut} className="mt-5">
            <button type="submit" className="btn btn-quiet w-full">Sign out</button>
          </form>
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-dvh pb-24">
      <div className="no-print bg-navy text-white">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-2.5">
          <span className="font-heading text-lg font-semibold">Southwest Home Maintenance</span>
          <form action={signOut}>
            <button type="submit" className="min-h-10 text-sm font-semibold text-white/80 underline-offset-2 hover:underline" title={`Signed in as ${staff.full_name}`}>
              Sign out
            </button>
          </form>
        </div>
      </div>
      <main className="mx-auto max-w-2xl px-4 py-5">{children}</main>
      <Nav isOwner={staff.role === 'owner'} />
    </div>
  );
}

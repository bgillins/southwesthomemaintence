import type { Metadata } from 'next';
import Link from 'next/link';
import { Empty, PageHeader, PlanBadge } from '@/components/ui';
import { requireStaff } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import type { HomeStatus, PlanTier } from '@/lib/types';

export const metadata: Metadata = { title: 'Homes' };

interface Row {
  id: string;
  address: string;
  city: string;
  plan: PlanTier;
  status: HomeStatus;
  customer: { name: string };
}

export default async function HomesPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireStaff();
  const { q } = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase.from('homes').select('id, address, city, plan, status, customer:customers(name)').order('address');

  // The list is small (hundreds of homes at most), so searching in memory is
  // simpler than a database query and lets one box match name or address.
  const term = (q ?? '').trim().toLowerCase();
  const homes = ((data ?? []) as unknown as Row[]).filter(
    (home) => !term || home.customer.name.toLowerCase().includes(term) || home.address.toLowerCase().includes(term),
  );

  return (
    <>
      <PageHeader title="Homes" action={<Link href="/homes/new" className="btn btn-primary btn-small">Add home</Link>} />
      <form className="mb-4" role="search">
        <label htmlFor="q" className="sr-only">Search by name or address</label>
        <input id="q" name="q" type="search" defaultValue={q} placeholder="Search name or address" className="input" />
      </form>
      {homes.length ? (
        <ul className="space-y-2">
          {homes.map((home) => (
            <li key={home.id}>
              <Link href={`/homes/${home.id}`} className="card flex items-center gap-3 hover:border-olive">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-bold">{home.customer.name}</div>
                  <div className="truncate text-sm text-navy-muted">{home.address}, {home.city}</div>
                </div>
                {home.status !== 'active' ? <span className="tag bg-navy-tint capitalize text-navy">{home.status}</span> : null}
                <PlanBadge plan={home.plan} />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <Empty>{term ? 'No homes match that search.' : 'No homes yet. Add your first member.'}</Empty>
      )}
    </>
  );
}

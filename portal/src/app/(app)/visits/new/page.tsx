import type { Metadata } from 'next';
import { PageHeader } from '@/components/ui';
import { requireStaff } from '@/lib/auth';
import { isUuid } from '@/lib/form';
import { createClient } from '@/lib/supabase/server';
import { addDays, localDate } from '@/lib/time';
import type { Staff } from '@/lib/types';
import { NewVisitForm } from './NewVisitForm';

export const metadata: Metadata = { title: 'Schedule a visit' };

export default async function NewVisitPage({ searchParams }: { searchParams: Promise<{ home?: string }> }) {
  const staff = await requireStaff();
  const { home: homeParam } = await searchParams;
  const supabase = await createClient();

  const [homesResult, staffResult, visitsResult] = await Promise.all([
    supabase.from('homes').select('id, address, customer:customers(name)').eq('status', 'active').order('address'),
    supabase.from('staff').select('id, full_name').eq('active', true).order('full_name'),
    supabase.from('visits').select('home_id').neq('status', 'cancelled'),
  ]);

  const homes = ((homesResult.data ?? []) as unknown as { id: string; address: string; customer: { name: string } }[]).map((home) => ({
    id: home.id,
    label: `${home.customer.name} · ${home.address}`,
  }));
  // Homes that have never been visited start with the assessment.
  const visited = new Set((visitsResult.data ?? []).map((visit) => visit.home_id as string));

  return (
    <>
      <PageHeader title="Schedule a visit" back={{ href: '/schedule', label: 'Schedule' }} />
      <NewVisitForm
        homes={homes}
        staff={(staffResult.data ?? []) as Pick<Staff, 'id' | 'full_name'>[]}
        unvisitedHomeIds={homes.filter((home) => !visited.has(home.id)).map((home) => home.id)}
        defaultHomeId={isUuid(homeParam) ? homeParam : ''}
        defaultTechId={staff.id}
        defaultWhen={`${addDays(localDate(), 1)}T09:00`}
      />
    </>
  );
}

import type { Metadata } from 'next';
import { setStaffActive } from '@/app/actions/team';
import { PageHeader } from '@/components/ui';
import { requireOwner } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import type { Staff } from '@/lib/types';
import { AddStaffForm } from './AddStaffForm';

export const metadata: Metadata = { title: 'Team' };

export default async function TeamPage() {
  const owner = await requireOwner();
  const supabase = await createClient();
  const { data } = await supabase.from('staff').select('*').order('active', { ascending: false }).order('full_name');
  const team = (data ?? []) as Staff[];

  return (
    <>
      <PageHeader title="Team" />
      <ul className="mb-6 space-y-2">
        {team.map((person) => (
          <li key={person.id} className={`card flex items-center justify-between gap-3 ${person.active ? '' : 'opacity-60'}`}>
            <div className="min-w-0">
              <div className="truncate font-bold">{person.full_name}</div>
              <div className="truncate text-sm text-navy-muted">{person.email}</div>
              <span className={`tag mt-1 capitalize ${person.role === 'owner' ? 'bg-navy text-white' : 'bg-navy-tint text-navy'}`}>{person.role}</span>
            </div>
            {person.id === owner.id ? (
              <span className="text-sm text-navy-muted">You</span>
            ) : (
              <form action={setStaffActive}>
                <input type="hidden" name="id" value={person.id} />
                <input type="hidden" name="active" value={person.active ? 'false' : 'true'} />
                <button type="submit" className="btn btn-quiet btn-small">{person.active ? 'Turn off access' : 'Turn access back on'}</button>
              </form>
            )}
          </li>
        ))}
      </ul>
      <h2 className="mb-2 text-xl">Add someone</h2>
      <AddStaffForm />
    </>
  );
}

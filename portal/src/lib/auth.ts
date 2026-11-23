// ------- Who is signed in -------
import 'server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { Staff } from '@/lib/types';

// cache() means a page that asks several times only hits the database once.
export const getStaff = cache(async (): Promise<Staff | null> => {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const { data } = await supabase.from('staff').select('*').eq('id', auth.user.id).eq('active', true).maybeSingle();
  return (data as Staff | null) ?? null;
});

export async function requireStaff(): Promise<Staff> {
  const staff = await getStaff();
  if (!staff) redirect('/login');
  return staff;
}

export async function requireOwner(): Promise<Staff> {
  const staff = await requireStaff();
  if (staff.role !== 'owner') redirect('/');
  return staff;
}

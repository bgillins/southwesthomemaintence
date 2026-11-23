'use server';

// ------- Team management (owners only) -------
import { revalidatePath } from 'next/cache';
import { requireOwner } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { isUuid, text } from '@/lib/form';
import type { ActionResult } from '@/lib/types';

export async function addStaff(_previous: ActionResult | null, formData: FormData): Promise<ActionResult> {
  await requireOwner();
  const name = text(formData, 'full_name');
  const email = text(formData, 'email')?.toLowerCase();
  const role = formData.get('role') === 'owner' ? 'owner' : 'tech';
  if (!name) return { ok: false, error: 'Add their name.' };
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: false, error: 'Add a valid email address.' };

  // A staff record is tied to a login. generateLink finds the login for this
  // email, or creates one, and hands back its id. The link itself is thrown away;
  // the person signs in from the login page whenever they are ready.
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email });
  if (error || !data.user) return { ok: false, error: error?.message ?? 'Could not set up their login.' };

  const { error: insertError } = await admin.from('staff').upsert(
    { id: data.user.id, full_name: name, email, phone: text(formData, 'phone'), role, active: true },
    { onConflict: 'id' },
  );
  if (insertError) return { ok: false, error: insertError.message };

  revalidatePath('/team');
  return { ok: true };
}

export async function setStaffActive(formData: FormData) {
  const owner = await requireOwner();
  const id = String(formData.get('id'));
  // Owners cannot switch themselves off, so there is always someone who can get in.
  if (!isUuid(id) || id === owner.id) return;
  const supabase = await createClient();
  await supabase.from('staff').update({ active: formData.get('active') === 'true' }).eq('id', id);
  revalidatePath('/team');
}

'use server';

// ------- Visits: schedule, work the checklist, finish and send the report -------
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireOwner, requireStaff } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { appUrl, PHOTO_BUCKET } from '@/lib/env';
import { reportEmail, sendEmail } from '@/lib/email';
import { isUuid, text } from '@/lib/form';
import { buildVisitItems, READINGS, VISITS_PER_YEAR } from '@/lib/plan';
import { formatLongDay, fromLocalInput } from '@/lib/time';
import type { ActionResult, ItemStatus, PlanTier, VisitType } from '@/lib/types';

type Supabase = Awaited<ReturnType<typeof createClient>>;

// ------- Schedule a visit -------
export async function createVisit(_previous: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const staff = await requireStaff();
  const supabase = await createClient();
  const homeId = String(formData.get('home_id'));
  const when = text(formData, 'scheduled_for');
  const techId = text(formData, 'tech_id');
  const visitType: VisitType = formData.get('visit_type') === 'assessment' ? 'assessment' : 'maintenance';
  if (!isUuid(homeId)) return { ok: false, error: 'Choose a home.' };
  if (!when) return { ok: false, error: 'Choose a date and time.' };

  const { data: home } = await supabase.from('homes').select('id, plan, features').eq('id', homeId).single();
  if (!home) return { ok: false, error: 'That home could not be found.' };
  const plan = home.plan as PlanTier;

  // Where this visit falls in the plan year: the 5th maintenance visit on a
  // 4-visit plan is visit 1 of the next year.
  const { count } = await supabase
    .from('visits')
    .select('id', { count: 'exact', head: true })
    .eq('home_id', homeId)
    .eq('visit_type', 'maintenance')
    .neq('status', 'cancelled');
  const seq = visitType === 'assessment' ? 1 : ((count ?? 0) % VISITS_PER_YEAR[plan]) + 1;

  const { data: visit, error } = await supabase
    .from('visits')
    .insert({
      home_id: homeId,
      tech_id: isUuid(techId) ? techId : null,
      visit_type: visitType,
      seq,
      plan,
      scheduled_for: fromLocalInput(when).toISOString(),
      created_by: staff.id,
    })
    .select('id')
    .single();
  if (error) return { ok: false, error: error.message };

  const items = buildVisitItems({ visitType, plan, seq, features: home.features ?? [] });
  const { error: itemsError } = await supabase.from('visit_items').insert(items.map((item) => ({ ...item, visit_id: visit.id })));
  if (itemsError) return { ok: false, error: itemsError.message };

  redirect(`/visits/${visit.id}`);
}

// Change the time or the tech on a visit that has not been finished.
export async function updateVisitDetails(formData: FormData) {
  await requireStaff();
  const visitId = String(formData.get('visit_id'));
  const when = text(formData, 'scheduled_for');
  const techId = text(formData, 'tech_id');
  if (!isUuid(visitId) || !when) return;
  const supabase = await createClient();
  await supabase
    .from('visits')
    .update({ scheduled_for: fromLocalInput(when).toISOString(), tech_id: isUuid(techId) ? techId : null })
    .eq('id', visitId)
    .in('status', ['scheduled', 'in_progress']);
  revalidatePath(`/visits/${visitId}`);
}

export async function cancelVisit(formData: FormData) {
  await requireStaff();
  const visitId = String(formData.get('visit_id'));
  if (!isUuid(visitId)) return;
  const supabase = await createClient();
  await supabase.from('visits').update({ status: 'cancelled' }).eq('id', visitId).eq('status', 'scheduled');
  redirect('/schedule');
}

// ------- During the visit -------
export async function startVisit(formData: FormData) {
  const staff = await requireStaff();
  const visitId = String(formData.get('visit_id'));
  if (!isUuid(visitId)) return;
  const supabase = await createClient();
  const { data: visit } = await supabase.from('visits').select('tech_id').eq('id', visitId).single();
  await supabase
    .from('visits')
    .update({ status: 'in_progress', started_at: new Date().toISOString(), tech_id: visit?.tech_id ?? staff.id })
    .eq('id', visitId)
    .eq('status', 'scheduled');
  revalidatePath(`/visits/${visitId}`);
}

// A finished visit is a record the customer has already seen, so it is locked.
async function isOpen(supabase: Supabase, visitId: string): Promise<boolean> {
  const { data } = await supabase.from('visits').select('status').eq('id', visitId).single();
  return data?.status === 'in_progress';
}

export async function updateItem(
  itemId: string,
  visitId: string,
  change: { status?: ItemStatus; note?: string | null },
): Promise<ActionResult> {
  const staff = await requireStaff();
  if (!isUuid(itemId) || !isUuid(visitId)) return { ok: false, error: 'That item could not be found.' };
  const supabase = await createClient();
  if (!(await isOpen(supabase, visitId))) return { ok: false, error: 'Start the visit before filling in the checklist.' };

  const update: Record<string, unknown> = { updated_by: staff.id, updated_at: new Date().toISOString() };
  if (change.status && ['pending', 'done', 'attention', 'na'].includes(change.status)) update.status = change.status;
  if (change.note !== undefined) update.note = change.note?.trim() || null;

  const { error } = await supabase.from('visit_items').update(update).eq('id', itemId).eq('visit_id', visitId);
  return error ? { ok: false, error: error.message } : { ok: true };
}

// The phone uploads the photo straight to storage, then calls this to record it.
export async function recordPhoto(input: {
  visitId: string;
  itemId: string | null;
  path: string;
  width: number;
  height: number;
}): Promise<ActionResult & { id?: string; url?: string }> {
  const staff = await requireStaff();
  if (!isUuid(input.visitId)) return { ok: false, error: 'That visit could not be found.' };
  // Photos must sit in this visit's own folder.
  if (!input.path.startsWith(`${input.visitId}/`) || input.path.includes('..')) return { ok: false, error: 'Bad photo path.' };
  const supabase = await createClient();
  if (!(await isOpen(supabase, input.visitId))) return { ok: false, error: 'Start the visit before adding photos.' };

  const { data, error } = await supabase
    .from('visit_photos')
    .insert({
      visit_id: input.visitId,
      item_id: isUuid(input.itemId) ? input.itemId : null,
      storage_path: input.path,
      width: Math.round(input.width) || null,
      height: Math.round(input.height) || null,
      taken_by: staff.id,
    })
    .select('id')
    .single();
  if (error) return { ok: false, error: error.message };

  const { data: signed } = await supabase.storage.from(PHOTO_BUCKET).createSignedUrl(input.path, 3600);
  return { ok: true, id: data.id, url: signed?.signedUrl };
}

export async function deletePhoto(photoId: string, visitId: string): Promise<ActionResult> {
  await requireStaff();
  if (!isUuid(photoId) || !isUuid(visitId)) return { ok: false, error: 'That photo could not be found.' };
  const supabase = await createClient();
  if (!(await isOpen(supabase, visitId))) return { ok: false, error: 'This visit is finished.' };
  const { data: photo } = await supabase.from('visit_photos').select('storage_path').eq('id', photoId).eq('visit_id', visitId).single();
  if (!photo) return { ok: false, error: 'That photo could not be found.' };
  await supabase.storage.from(PHOTO_BUCKET).remove([photo.storage_path]);
  const { error } = await supabase.from('visit_photos').delete().eq('id', photoId);
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function saveReading(visitId: string, key: string, value: number | null): Promise<ActionResult> {
  await requireStaff();
  if (!isUuid(visitId) || !READINGS.some((reading) => reading.key === key)) return { ok: false, error: 'Unknown reading.' };
  const supabase = await createClient();
  if (!(await isOpen(supabase, visitId))) return { ok: false, error: 'This visit is not in progress.' };
  const { error } =
    value === null || !Number.isFinite(value)
      ? await supabase.from('visit_readings').delete().eq('visit_id', visitId).eq('key', key)
      : await supabase.from('visit_readings').upsert({ visit_id: visitId, key, value }, { onConflict: 'visit_id,key' });
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function addVisitSupply(visitId: string, name: string, qty: number): Promise<ActionResult & { id?: string }> {
  await requireStaff();
  const cleanName = name.trim();
  if (!isUuid(visitId) || !cleanName) return { ok: false, error: 'Say what was used.' };
  const supabase = await createClient();
  if (!(await isOpen(supabase, visitId))) return { ok: false, error: 'This visit is not in progress.' };
  const { data, error } = await supabase
    .from('visit_supplies')
    .insert({ visit_id: visitId, name: cleanName, qty: Math.max(1, Math.round(qty) || 1) })
    .select('id')
    .single();
  return error ? { ok: false, error: error.message } : { ok: true, id: data.id };
}

export async function removeVisitSupply(id: string, visitId: string): Promise<ActionResult> {
  await requireStaff();
  if (!isUuid(id) || !isUuid(visitId)) return { ok: false, error: 'Not found.' };
  const supabase = await createClient();
  if (!(await isOpen(supabase, visitId))) return { ok: false, error: 'This visit is not in progress.' };
  const { error } = await supabase.from('visit_supplies').delete().eq('id', id).eq('visit_id', visitId);
  return error ? { ok: false, error: error.message } : { ok: true };
}

// ------- Finish the visit -------
// The report is the product, so the visit cannot be closed half-documented:
// every item needs an answer, and every problem needs a note saying what was seen.
export async function completeVisit(visitId: string, summary: string): Promise<ActionResult & { notice?: string }> {
  await requireStaff();
  if (!isUuid(visitId)) return { ok: false, error: 'That visit could not be found.' };
  const supabase = await createClient();
  if (!(await isOpen(supabase, visitId))) return { ok: false, error: 'This visit is not in progress.' };

  const { data: items } = await supabase.from('visit_items').select('name, status, note').eq('visit_id', visitId);
  const pending = (items ?? []).filter((item) => item.status === 'pending');
  if (pending.length) return { ok: false, error: `${pending.length} checklist ${pending.length === 1 ? 'item still needs' : 'items still need'} an answer.` };
  const missingNote = (items ?? []).find((item) => item.status === 'attention' && !item.note);
  if (missingNote) return { ok: false, error: `Add a note for “${missingNote.name}” so the customer knows what you saw.` };

  const { error } = await supabase
    .from('visits')
    .update({ status: 'completed', completed_at: new Date().toISOString(), summary: summary.trim() || null })
    .eq('id', visitId);
  if (error) return { ok: false, error: error.message };

  const notice = await sendReport(supabase, visitId);
  revalidatePath(`/visits/${visitId}`);
  return { ok: true, notice };
}

export async function resendReport(visitId: string): Promise<ActionResult & { notice?: string }> {
  await requireStaff();
  if (!isUuid(visitId)) return { ok: false, error: 'That visit could not be found.' };
  const supabase = await createClient();
  const notice = await sendReport(supabase, visitId);
  revalidatePath(`/visits/${visitId}`);
  return { ok: true, notice };
}

// Owners can unlock a finished visit to fix a mistake. The report link stays the same.
export async function reopenVisit(formData: FormData) {
  await requireOwner();
  const visitId = String(formData.get('visit_id'));
  if (!isUuid(visitId)) return;
  const supabase = await createClient();
  await supabase.from('visits').update({ status: 'in_progress', completed_at: null }).eq('id', visitId).eq('status', 'completed');
  revalidatePath(`/visits/${visitId}`);
}

// Emails the report link to the customer, plus the family member if allowed.
// Returns a short sentence saying what happened, shown to the tech.
async function sendReport(supabase: Supabase, visitId: string): Promise<string> {
  const { data: visit } = await supabase
    .from('visits')
    .select('id, report_token, summary, completed_at, scheduled_for, tech:staff!visits_tech_id_fkey(full_name), home:homes(address, city, report_cc_email, report_cc_ok, customer:customers(name, email))')
    .eq('id', visitId)
    .single();
  if (!visit) return 'The visit is saved, but the report could not be loaded to email.';

  // Supabase types embedded rows loosely; these are single rows.
  const home = visit.home as unknown as { address: string; city: string; report_cc_email: string | null; report_cc_ok: boolean; customer: { name: string; email: string | null } };
  const tech = visit.tech as unknown as { full_name: string } | null;

  const recipients = [home.customer.email, home.report_cc_ok ? home.report_cc_email : null].filter((email): email is string => Boolean(email));
  if (!recipients.length) return 'Visit saved. No email on file for this customer, so share the report link yourself.';

  const { data: items } = await supabase.from('visit_items').select('name, status').eq('visit_id', visitId).order('sort');
  const email = reportEmail({
    customerName: home.customer.name,
    address: home.address,
    visitDay: formatLongDay(visit.completed_at ?? visit.scheduled_for),
    techName: tech?.full_name ?? 'Your technician',
    summary: visit.summary,
    doneCount: (items ?? []).filter((item) => item.status === 'done').length,
    attentionNames: (items ?? []).filter((item) => item.status === 'attention').map((item) => item.name),
    link: `${appUrl()}/r/${visit.report_token}`,
  });

  const result = await sendEmail({ to: recipients, ...email });
  await supabase.from('message_log').insert(
    recipients.map((recipient) => ({
      visit_id: visitId,
      template: 'visit_report',
      recipient,
      status: result.ok ? 'sent' : 'failed',
      provider_id: result.id ?? null,
      error: result.error ?? null,
    })),
  );
  if (!result.ok) return `Visit saved, but the report email failed: ${result.error}`;

  await supabase.from('visits').update({ report_sent_at: new Date().toISOString() }).eq('id', visitId);
  return `Report emailed to ${recipients.join(' and ')}.`;
}

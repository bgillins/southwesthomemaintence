'use server';

// ------- Customers, homes and the home profile -------
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireStaff } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { int, isUuid, text } from '@/lib/form';
import { FEATURES } from '@/lib/plan';
import type { ActionResult, PlanTier } from '@/lib/types';

const PLANS: PlanTier[] = ['essentials', 'plus', 'premier'];

// Pull the home's fields out of the form (shared by "new" and "edit").
function readHome(formData: FormData) {
  const plan = String(formData.get('plan')) as PlanTier;
  const email = text(formData, 'report_cc_email');
  return {
    address: text(formData, 'address'),
    city: text(formData, 'city') ?? 'Las Vegas',
    zip: text(formData, 'zip'),
    plan: PLANS.includes(plan) ? plan : 'essentials',
    member_since: text(formData, 'member_since'),
    features: FEATURES.map((feature) => feature.id).filter((id) => formData.get(`feature_${id}`) === 'on'),
    access_notes: text(formData, 'access_notes'),
    shutoffs: {
      main_water: text(formData, 'shutoff_main_water') ?? undefined,
      water_heater: text(formData, 'shutoff_water_heater') ?? undefined,
      gas: text(formData, 'shutoff_gas') ?? undefined,
      irrigation: text(formData, 'shutoff_irrigation') ?? undefined,
      panel: text(formData, 'shutoff_panel') ?? undefined,
    },
    report_cc_name: text(formData, 'report_cc_name'),
    report_cc_email: email?.toLowerCase() ?? null,
    // A copy only goes out when there is an address AND the permission box is ticked.
    report_cc_ok: Boolean(email) && formData.get('report_cc_ok') === 'on',
  };
}

function readCustomer(formData: FormData) {
  return {
    name: text(formData, 'name'),
    email: text(formData, 'email')?.toLowerCase() ?? null,
    phone: text(formData, 'phone'),
    notes: text(formData, 'notes'),
  };
}

export async function createHome(_previous: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const staff = await requireStaff();
  const supabase = await createClient();
  const customer = readCustomer(formData);
  const home = readHome(formData);
  if (!customer.name) return { ok: false, error: 'Add the customer’s name.' };
  if (!home.address) return { ok: false, error: 'Add the street address.' };

  const { data: createdCustomer, error: customerError } = await supabase
    .from('customers')
    .insert({ ...customer, created_by: staff.id })
    .select('id')
    .single();
  if (customerError) return { ok: false, error: customerError.message };

  const { data: createdHome, error: homeError } = await supabase
    .from('homes')
    .insert({ ...home, customer_id: createdCustomer.id })
    .select('id')
    .single();
  if (homeError) return { ok: false, error: homeError.message };

  redirect(`/homes/${createdHome.id}`);
}

export async function updateHome(_previous: ActionResult | null, formData: FormData): Promise<ActionResult> {
  await requireStaff();
  const supabase = await createClient();
  const homeId = String(formData.get('home_id'));
  const customerId = String(formData.get('customer_id'));
  if (!isUuid(homeId) || !isUuid(customerId)) return { ok: false, error: 'That home could not be found.' };

  const customer = readCustomer(formData);
  const home = readHome(formData);
  if (!customer.name) return { ok: false, error: 'Add the customer’s name.' };
  if (!home.address) return { ok: false, error: 'Add the street address.' };
  const status = String(formData.get('status'));

  const { error: customerError } = await supabase.from('customers').update(customer).eq('id', customerId);
  if (customerError) return { ok: false, error: customerError.message };
  const { error: homeError } = await supabase
    .from('homes')
    .update({ ...home, status: ['active', 'paused', 'cancelled'].includes(status) ? status : 'active' })
    .eq('id', homeId);
  if (homeError) return { ok: false, error: homeError.message };

  redirect(`/homes/${homeId}`);
}

// ------- Equipment record -------
export async function addEquipment(formData: FormData) {
  await requireStaff();
  const homeId = String(formData.get('home_id'));
  const kind = text(formData, 'kind');
  if (!isUuid(homeId) || !kind) return;
  const supabase = await createClient();
  await supabase.from('home_equipment').insert({
    home_id: homeId,
    kind,
    make: text(formData, 'make'),
    model: text(formData, 'model'),
    serial: text(formData, 'serial'),
    install_year: int(formData, 'install_year'),
    location: text(formData, 'location'),
    notes: text(formData, 'notes'),
  });
  revalidatePath(`/homes/${homeId}`);
}

export async function deleteEquipment(formData: FormData) {
  await requireStaff();
  const id = String(formData.get('id'));
  const homeId = String(formData.get('home_id'));
  if (!isUuid(id)) return;
  const supabase = await createClient();
  await supabase.from('home_equipment').delete().eq('id', id);
  revalidatePath(`/homes/${homeId}`);
}

// ------- Supplies list (what to bring) -------
export async function addSupply(formData: FormData) {
  await requireStaff();
  const homeId = String(formData.get('home_id'));
  const kind = text(formData, 'kind');
  const spec = text(formData, 'spec');
  if (!isUuid(homeId) || !kind || !spec) return;
  const supabase = await createClient();
  await supabase.from('home_supplies').insert({
    home_id: homeId,
    kind,
    spec,
    qty: Math.max(1, int(formData, 'qty') ?? 1),
    location: text(formData, 'location'),
  });
  revalidatePath(`/homes/${homeId}`);
}

export async function deleteSupply(formData: FormData) {
  await requireStaff();
  const id = String(formData.get('id'));
  const homeId = String(formData.get('home_id'));
  if (!isUuid(id)) return;
  const supabase = await createClient();
  await supabase.from('home_supplies').delete().eq('id', id);
  revalidatePath(`/homes/${homeId}`);
}

// ------- The customer's list of small jobs -------
export async function addTask(formData: FormData) {
  const staff = await requireStaff();
  const homeId = String(formData.get('home_id'));
  const title = text(formData, 'title');
  if (!isUuid(homeId) || !title) return;
  const supabase = await createClient();
  await supabase.from('home_tasks').insert({ home_id: homeId, title, created_by: staff.id });
  revalidatePath(`/homes/${homeId}`);
  const visitId = String(formData.get('visit_id') ?? '');
  if (isUuid(visitId)) revalidatePath(`/visits/${visitId}`);
}

// Mark a job done (on a visit) or put it back on the list.
export async function setTaskDone(taskId: string, visitId: string | null, done: boolean, minutes: number | null): Promise<ActionResult> {
  await requireStaff();
  if (!isUuid(taskId)) return { ok: false, error: 'That task could not be found.' };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('home_tasks')
    .update(
      done
        ? { status: 'done', done_visit_id: visitId, done_at: new Date().toISOString(), minutes }
        : { status: 'open', done_visit_id: null, done_at: null, minutes: null },
    )
    .eq('id', taskId)
    .select('home_id')
    .single();
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/homes/${data.home_id}`);
  return { ok: true };
}

export async function deleteTask(formData: FormData) {
  await requireStaff();
  const id = String(formData.get('id'));
  const homeId = String(formData.get('home_id'));
  if (!isUuid(id)) return;
  const supabase = await createClient();
  await supabase.from('home_tasks').delete().eq('id', id);
  revalidatePath(`/homes/${homeId}`);
}

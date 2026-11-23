import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/ui';
import { requireStaff } from '@/lib/auth';
import { PHOTO_BUCKET } from '@/lib/env';
import { isUuid } from '@/lib/form';
import { createClient } from '@/lib/supabase/server';
import type { Customer, Home, HomeTask, Reading, Staff, Supply, Visit, VisitItem, VisitPhoto, VisitSupply } from '@/lib/types';
import { VisitRunner } from './VisitRunner';

export const metadata: Metadata = { title: 'Visit' };

// ------- One visit: loads everything, then hands it to the interactive screen -------
export default async function VisitPage({ params }: { params: Promise<{ id: string }> }) {
  const staff = await requireStaff();
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const supabase = await createClient();

  const { data: visitRow } = await supabase
    .from('visits')
    .select('*, tech:staff!visits_tech_id_fkey(full_name), home:homes(*, customer:customers(*))')
    .eq('id', id)
    .maybeSingle();
  if (!visitRow) notFound();
  const { home: homeRow, tech, ...visit } = visitRow as Visit & { tech: { full_name: string } | null; home: Home & { customer: Customer } };
  const { customer, ...home } = homeRow;

  const [itemsResult, photosResult, readingsResult, suppliesResult, tasksResult, homeSuppliesResult, staffResult] = await Promise.all([
    supabase.from('visit_items').select('*').eq('visit_id', id).order('sort'),
    supabase.from('visit_photos').select('*').eq('visit_id', id).order('created_at'),
    supabase.from('visit_readings').select('*').eq('visit_id', id),
    supabase.from('visit_supplies').select('*').eq('visit_id', id).order('created_at'),
    // Jobs still open for this home, plus the ones ticked off on this visit.
    supabase.from('home_tasks').select('*').eq('home_id', home.id).or(`status.eq.open,done_visit_id.eq.${id}`).order('created_at'),
    supabase.from('home_supplies').select('*').eq('home_id', home.id).order('kind'),
    supabase.from('staff').select('id, full_name').eq('active', true).order('full_name'),
  ]);

  // The bucket is private, so each photo gets a link that works for one hour.
  const photos = (photosResult.data ?? []) as VisitPhoto[];
  if (photos.length) {
    const { data: signed } = await supabase.storage.from(PHOTO_BUCKET).createSignedUrls(photos.map((photo) => photo.storage_path), 3600);
    signed?.forEach((link, index) => {
      photos[index].url = link.signedUrl ?? undefined;
    });
  }

  return (
    <>
      <PageHeader title={customer.name} back={{ href: '/', label: 'Today' }} />
      <VisitRunner
        // Keyed by visit so moving between visits never carries over typed notes.
        key={visit.id}
        visit={visit}
        techName={tech?.full_name ?? null}
        home={home}
        customer={customer}
        items={(itemsResult.data ?? []) as VisitItem[]}
        photos={photos}
        readings={(readingsResult.data ?? []) as Reading[]}
        supplies={(suppliesResult.data ?? []) as VisitSupply[]}
        tasks={(tasksResult.data ?? []) as HomeTask[]}
        homeSupplies={(homeSuppliesResult.data ?? []) as Supply[]}
        staffList={(staffResult.data ?? []) as Pick<Staff, 'id' | 'full_name'>[]}
        isOwner={staff.role === 'owner'}
      />
    </>
  );
}

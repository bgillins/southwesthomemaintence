import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { updateHome } from '@/app/actions/homes';
import { PageHeader } from '@/components/ui';
import { requireStaff } from '@/lib/auth';
import { isUuid } from '@/lib/form';
import { createClient } from '@/lib/supabase/server';
import type { Customer, Home } from '@/lib/types';
import { HomeForm } from '../../HomeForm';

export const metadata: Metadata = { title: 'Edit home' };

export default async function EditHomePage({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff();
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const supabase = await createClient();
  const { data } = await supabase.from('homes').select('*, customer:customers(*)').eq('id', id).maybeSingle();
  if (!data) notFound();
  const { customer, ...home } = data as Home & { customer: Customer };

  return (
    <>
      <PageHeader title="Edit home" back={{ href: `/homes/${id}`, label: customer.name }} />
      <HomeForm action={updateHome} home={home} customer={customer} />
    </>
  );
}

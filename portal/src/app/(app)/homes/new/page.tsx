import type { Metadata } from 'next';
import { createHome } from '@/app/actions/homes';
import { PageHeader } from '@/components/ui';
import { requireStaff } from '@/lib/auth';
import { HomeForm } from '../HomeForm';

export const metadata: Metadata = { title: 'Add home' };

export default async function NewHomePage() {
  await requireStaff();
  return (
    <>
      <PageHeader title="Add a home" back={{ href: '/homes', label: 'Homes' }} />
      <HomeForm action={createHome} />
    </>
  );
}

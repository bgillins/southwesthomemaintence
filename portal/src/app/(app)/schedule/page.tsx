import type { Metadata } from 'next';
import Link from 'next/link';
import { Empty, PageHeader } from '@/components/ui';
import { VISIT_CARD_SELECT, VisitCard, type VisitCardData } from '@/components/VisitCard';
import { requireStaff } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { dayBounds, formatLongDay, localDate } from '@/lib/time';

export const metadata: Metadata = { title: 'Schedule' };

export default async function SchedulePage() {
  await requireStaff();
  const supabase = await createClient();
  const { start } = dayBounds(localDate());

  const [upcomingResult, overdueResult, recentResult] = await Promise.all([
    supabase.from('visits').select(VISIT_CARD_SELECT).gte('scheduled_for', start.toISOString()).in('status', ['scheduled', 'in_progress']).order('scheduled_for').limit(200),
    // Scheduled for a day that has passed and never started: needs rescheduling.
    supabase.from('visits').select(VISIT_CARD_SELECT).lt('scheduled_for', start.toISOString()).in('status', ['scheduled', 'in_progress']).order('scheduled_for'),
    supabase.from('visits').select(VISIT_CARD_SELECT).eq('status', 'completed').order('completed_at', { ascending: false }).limit(10),
  ]);
  const upcoming = (upcomingResult.data ?? []) as unknown as VisitCardData[];
  const overdue = (overdueResult.data ?? []) as unknown as VisitCardData[];
  const recent = (recentResult.data ?? []) as unknown as VisitCardData[];

  // Group upcoming visits under a heading for each day.
  const days = new Map<string, VisitCardData[]>();
  for (const visit of upcoming) {
    const day = localDate(new Date(visit.scheduled_for));
    days.set(day, [...(days.get(day) ?? []), visit]);
  }

  return (
    <>
      <PageHeader title="Schedule" action={<Link href="/visits/new" className="btn btn-primary btn-small">New visit</Link>} />

      {overdue.length ? (
        <section className="mb-6">
          <h2 className="mb-2 text-lg text-alert-ink">Overdue</h2>
          <div className="space-y-2">{overdue.map((visit) => <VisitCard key={visit.id} visit={visit} showDay />)}</div>
        </section>
      ) : null}

      {days.size ? (
        [...days.entries()].map(([day, visits]) => (
          <section key={day} className="mb-5">
            <h2 className="mb-2 text-lg">{formatLongDay(visits[0].scheduled_for)}</h2>
            <div className="space-y-2">{visits.map((visit) => <VisitCard key={visit.id} visit={visit} />)}</div>
          </section>
        ))
      ) : (
        <Empty>Nothing scheduled. Add a visit to get started.</Empty>
      )}

      {recent.length ? (
        <section className="mt-8">
          <h2 className="mb-2 text-lg">Recently completed</h2>
          <div className="space-y-2">{recent.map((visit) => <VisitCard key={visit.id} visit={visit} showDay />)}</div>
        </section>
      ) : null}
    </>
  );
}

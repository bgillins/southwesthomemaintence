import type { Metadata } from 'next';
import Link from 'next/link';
import { Empty } from '@/components/ui';
import { VISIT_CARD_SELECT, VisitCard, type VisitCardData } from '@/components/VisitCard';
import { requireStaff } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { addDays, dayBounds, formatLongDay, localDate } from '@/lib/time';

export const metadata: Metadata = { title: 'Today' };

// ------- Today: the first screen a tech sees -------
export default async function TodayPage({ searchParams }: { searchParams: Promise<{ all?: string }> }) {
  const staff = await requireStaff();
  const supabase = await createClient();
  const { all } = await searchParams;
  // Techs see their own visits plus anything unassigned. Owners see everyone's.
  const showAll = staff.role === 'owner' ? all !== '0' : all === '1';

  const today = localDate();
  const { start, end } = dayBounds(today);
  const weekEnd = dayBounds(addDays(today, 7)).end;

  const mine = <T extends { or: (filter: string) => T }>(query: T) => (showAll ? query : query.or(`tech_id.eq.${staff.id},tech_id.is.null`));

  const [todayResult, openResult, upcomingResult] = await Promise.all([
    mine(supabase.from('visits').select(VISIT_CARD_SELECT).gte('scheduled_for', start.toISOString()).lt('scheduled_for', end.toISOString()).neq('status', 'cancelled')).order('scheduled_for'),
    // Visits started on an earlier day and never finished: easy to forget, so they sit on top.
    mine(supabase.from('visits').select(VISIT_CARD_SELECT).eq('status', 'in_progress').lt('scheduled_for', start.toISOString())).order('scheduled_for'),
    mine(supabase.from('visits').select(VISIT_CARD_SELECT).gte('scheduled_for', end.toISOString()).lt('scheduled_for', weekEnd.toISOString()).eq('status', 'scheduled')).order('scheduled_for'),
  ]);

  const todays = (todayResult.data ?? []) as unknown as VisitCardData[];
  const unfinished = (openResult.data ?? []) as unknown as VisitCardData[];
  const upcoming = (upcomingResult.data ?? []) as unknown as VisitCardData[];

  return (
    <>
      <p className="eyebrow">{formatLongDay(new Date())}</p>
      <div className="mb-5 flex items-end justify-between gap-3">
        <h1 className="text-3xl">Hi, {staff.full_name.split(' ')[0]}</h1>
        <Link href={showAll ? '/?all=0' : '/?all=1'} className="btn btn-quiet btn-small shrink-0">
          {showAll ? 'Only mine' : 'Everyone’s'}
        </Link>
      </div>

      {unfinished.length ? (
        <section className="mb-6">
          <h2 className="mb-2 text-lg">Still open from earlier</h2>
          <div className="space-y-2">{unfinished.map((visit) => <VisitCard key={visit.id} visit={visit} showDay />)}</div>
        </section>
      ) : null}

      <section className="mb-6">
        <h2 className="mb-2 text-lg">Today’s visits</h2>
        {todays.length ? (
          <div className="space-y-2">{todays.map((visit) => <VisitCard key={visit.id} visit={visit} />)}</div>
        ) : (
          <Empty>No visits on the calendar today.</Empty>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-lg">Next 7 days</h2>
        {upcoming.length ? (
          <div className="space-y-2">{upcoming.map((visit) => <VisitCard key={visit.id} visit={visit} showDay />)}</div>
        ) : (
          <Empty>Nothing else scheduled this week.</Empty>
        )}
      </section>
    </>
  );
}

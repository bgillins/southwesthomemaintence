import Link from 'next/link';
import { PlanBadge, VisitStatusBadge } from '@/components/ui';
import { formatDay, formatTime } from '@/lib/time';
import type { PlanTier, VisitStatus, VisitType } from '@/lib/types';

// The shape returned by VISIT_CARD_SELECT below.
export interface VisitCardData {
  id: string;
  status: VisitStatus;
  visit_type: VisitType;
  plan: PlanTier;
  scheduled_for: string;
  home: { address: string; city: string; customer: { name: string } };
  tech: { full_name: string } | null;
}

export const VISIT_CARD_SELECT =
  'id, status, visit_type, plan, scheduled_for, tech_id, home:homes(address, city, customer:customers(name)), tech:staff!visits_tech_id_fkey(full_name)';

export function VisitCard({ visit, showDay = false }: { visit: VisitCardData; showDay?: boolean }) {
  return (
    <Link href={`/visits/${visit.id}`} className="card flex items-center gap-3 transition-colors hover:border-olive">
      <div className="w-16 shrink-0 text-center">
        {showDay ? <div className="text-xs font-bold text-navy-muted">{formatDay(visit.scheduled_for)}</div> : null}
        <div className="text-base font-bold">{formatTime(visit.scheduled_for)}</div>
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate font-bold">{visit.home.customer.name}</div>
        <div className="truncate text-sm text-navy-muted">
          {visit.home.address}, {visit.home.city}
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <VisitStatusBadge status={visit.status} />
          <PlanBadge plan={visit.plan} />
          {visit.visit_type === 'assessment' ? <span className="tag bg-navy-tint text-navy">Assessment</span> : null}
          <span className="text-xs text-navy-muted">{visit.tech?.full_name ?? 'Unassigned'}</span>
        </div>
      </div>
      <span aria-hidden="true" className="text-xl text-navy-muted">›</span>
    </Link>
  );
}

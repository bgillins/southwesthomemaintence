// ------- Small shared pieces of UI (server-safe) -------
import Link from 'next/link';
import { PLAN_NAME } from '@/lib/plan';
import type { PlanTier, VisitStatus } from '@/lib/types';

export function PlanBadge({ plan }: { plan: PlanTier }) {
  const tone = plan === 'premier' ? 'bg-navy text-white' : plan === 'plus' ? 'bg-gold-tint text-gold-ink' : 'bg-olive-tint text-olive-ink';
  return <span className={`tag ${tone}`}>{PLAN_NAME[plan]}</span>;
}

const STATUS: Record<VisitStatus, { label: string; tone: string }> = {
  scheduled: { label: 'Scheduled', tone: 'bg-navy-tint text-navy' },
  in_progress: { label: 'In progress', tone: 'bg-gold-tint text-gold-ink' },
  completed: { label: 'Completed', tone: 'bg-olive-tint text-olive-ink' },
  cancelled: { label: 'Cancelled', tone: 'bg-alert-tint text-alert-ink' },
};

export function VisitStatusBadge({ status }: { status: VisitStatus }) {
  return <span className={`tag ${STATUS[status].tone}`}>{STATUS[status].label}</span>;
}

export function PageHeader({ title, back, action }: { title: string; back?: { href: string; label: string }; action?: React.ReactNode }) {
  return (
    <header className="mb-5">
      {back ? (
        <Link href={back.href} className="mb-2 inline-flex min-h-10 items-center text-sm font-semibold text-navy-muted">
          ← {back.label}
        </Link>
      ) : null}
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-3xl">{title}</h1>
        {action}
      </div>
    </header>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-2xl border border-dashed border-line px-4 py-8 text-center text-navy-muted">{children}</p>;
}

// A Google Maps link, so one tap starts directions to the home.
export function mapsUrl(address: string, city: string, zip: string | null) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${address}, ${city}, NV ${zip ?? ''}`)}`;
}

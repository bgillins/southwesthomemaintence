import type { Metadata } from 'next';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { referred } from '@/data/checklist';
import { PHOTO_BUCKET } from '@/lib/env';
import { PLAN_NAME, READINGS, VISITS_PER_YEAR } from '@/lib/plan';
import { createAdminClient } from '@/lib/supabase/admin';
import { formatLongDay } from '@/lib/time';
import type { Customer, Home, HomeTask, Reading, Visit, VisitItem, VisitPhoto, VisitSupply } from '@/lib/types';

export const metadata: Metadata = { title: 'Your home report' };

// ------- The customer's report -------
// No login: the long random token in the link is the key. The page is built on
// the server with the service role, and only ever loads the one visit whose
// token matches, so a customer can never see another home.
export default async function ReportPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[0-9a-f]{64}$/.test(token)) notFound();
  const admin = createAdminClient();

  const { data: visitRow } = await admin
    .from('visits')
    .select('*, tech:staff!visits_tech_id_fkey(full_name), home:homes(*, customer:customers(name))')
    .eq('report_token', token)
    .maybeSingle();
  if (!visitRow) notFound();
  const { home: homeRow, tech, ...visit } = visitRow as Visit & { tech: { full_name: string } | null; home: Home & { customer: Pick<Customer, 'name'> } };

  // Reopened by the office to fix something: do not show a half-edited report.
  if (visit.status !== 'completed') {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 text-center">
        <h1 className="text-2xl">This report is being updated</h1>
        <p className="mt-2 text-navy-muted">Please check back in a little while.</p>
      </main>
    );
  }

  const [itemsResult, photosResult, readingsResult, suppliesResult, tasksResult, nextResult] = await Promise.all([
    admin.from('visit_items').select('*').eq('visit_id', visit.id).order('sort'),
    admin.from('visit_photos').select('*').eq('visit_id', visit.id).order('created_at'),
    admin.from('visit_readings').select('*').eq('visit_id', visit.id),
    admin.from('visit_supplies').select('*').eq('visit_id', visit.id).order('created_at'),
    admin.from('home_tasks').select('*').eq('done_visit_id', visit.id).order('done_at'),
    admin.from('visits').select('scheduled_for').eq('home_id', visit.home_id).eq('status', 'scheduled').gt('scheduled_for', new Date().toISOString()).order('scheduled_for').limit(1),
  ]);

  const items = (itemsResult.data ?? []) as VisitItem[];
  const photos = (photosResult.data ?? []) as VisitPhoto[];
  const readings = (readingsResult.data ?? []) as Reading[];
  const supplies = (suppliesResult.data ?? []) as VisitSupply[];
  const tasks = (tasksResult.data ?? []) as HomeTask[];
  const nextVisit = nextResult.data?.[0]?.scheduled_for as string | undefined;

  // Photo links last a day, long enough to read the report, short enough not to linger.
  if (photos.length) {
    const { data: signed } = await admin.storage.from(PHOTO_BUCKET).createSignedUrls(photos.map((photo) => photo.storage_path), 86400);
    signed?.forEach((link, index) => {
      photos[index].url = link.signedUrl ?? undefined;
    });
  }
  const photosFor = (itemId: string | null) => photos.filter((photo) => photo.item_id === itemId && photo.url);

  const attention = items.filter((item) => item.status === 'attention');
  const done = items.filter((item) => item.status === 'done');
  const firstName = homeRow.customer.name.split(' ')[0];

  // Group completed items by area of the home.
  const areas = new Map<string, VisitItem[]>();
  for (const item of done) areas.set(item.category_title, [...(areas.get(item.category_title) ?? []), item]);

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <Image src="/logo.png" alt="Southwest Home Maintenance" width={1200} height={497} priority className="h-auto w-44" />

      {/* ------- Header ------- */}
      <header className="mt-6">
        <p className="eyebrow">{visit.visit_type === 'assessment' ? 'Home Health Assessment' : `${PLAN_NAME[visit.plan]} plan · visit ${visit.seq} of ${VISITS_PER_YEAR[visit.plan]}`}</p>
        <h1 className="mt-1 text-3xl sm:text-4xl">Your home report</h1>
        <p className="mt-2 text-navy-muted">
          {formatLongDay(visit.completed_at ?? visit.scheduled_for)} · {homeRow.address}, {homeRow.city}
          {tech ? ` · Visit by ${tech.full_name}` : ''}
        </p>
      </header>

      {/* ------- At a glance ------- */}
      <section className="mt-6 grid grid-cols-3 gap-2 text-center">
        <div className="card px-2">
          <div className="font-heading text-3xl font-semibold text-olive-dark">{done.length}</div>
          <div className="text-xs font-bold text-navy-muted">items completed</div>
        </div>
        <div className="card px-2">
          <div className={`font-heading text-3xl font-semibold ${attention.length ? 'text-alert' : 'text-olive-dark'}`}>{attention.length}</div>
          <div className="text-xs font-bold text-navy-muted">need a look</div>
        </div>
        <div className="card px-2">
          <div className="font-heading text-3xl font-semibold text-olive-dark">{photos.length}</div>
          <div className="text-xs font-bold text-navy-muted">photos</div>
        </div>
      </section>

      {visit.summary ? (
        <section className="card mt-4 border-l-4 border-l-gold">
          <p className="eyebrow">A note from {tech?.full_name.split(' ')[0] ?? 'your technician'}</p>
          <p className="mt-1.5 whitespace-pre-line text-lg">Hi {firstName}, {visit.summary}</p>
        </section>
      ) : null}

      {/* ------- What needs attention ------- */}
      <section className="mt-8">
        <h2 className="text-2xl">Needs your attention</h2>
        {attention.length ? (
          <ul className="mt-3 space-y-3">
            {attention.map((item) => (
              <li key={item.id} className="card border-alert/40">
                <p className="eyebrow !text-alert-ink">{item.category_title}</p>
                <h3 className="mt-0.5 text-lg">{item.name}</h3>
                {item.note ? <p className="mt-1.5 whitespace-pre-line">{item.note}</p> : null}
                <Photos photos={photosFor(item.id)} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 rounded-2xl bg-olive-tint px-4 py-4 font-semibold text-olive-ink">Nothing this visit. Everything we checked looked good.</p>
        )}
      </section>

      {/* ------- Small jobs from the customer's list ------- */}
      {tasks.length ? (
        <section className="mt-8">
          <h2 className="text-2xl">From your to-do list</h2>
          <ul className="card mt-3 divide-y divide-line">
            {tasks.map((task) => (
              <li key={task.id} className="flex items-center gap-3 py-2"><Tick />{task.title}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* ------- Parts and readings ------- */}
      {supplies.length || readings.length ? (
        <section className="mt-8 grid gap-4 sm:grid-cols-2">
          {supplies.length ? (
            <div>
              <h2 className="text-2xl">Parts we supplied</h2>
              <ul className="card mt-3 divide-y divide-line">
                {supplies.map((supply) => <li key={supply.id} className="py-2">{supply.qty} × {supply.name}</li>)}
              </ul>
            </div>
          ) : null}
          {readings.length ? (
            <div>
              <h2 className="text-2xl">Readings</h2>
              <dl className="card mt-3 divide-y divide-line">
                {READINGS.filter((reading) => readings.some((row) => row.key === reading.key)).map((reading) => (
                  <div key={reading.key} className="py-2">
                    <div className="flex justify-between gap-3">
                      <dt>{reading.label}</dt>
                      <dd className="font-bold">{readings.find((row) => row.key === reading.key)!.value} {reading.unit}</dd>
                    </div>
                    <p className="text-xs text-navy-muted">{reading.hint}</p>
                  </div>
                ))}
              </dl>
            </div>
          ) : null}
        </section>
      ) : null}

      {/* ------- Everything completed ------- */}
      <section className="mt-8">
        <h2 className="text-2xl">What we did and checked</h2>
        <div className="mt-3 space-y-3">
          {[...areas.entries()].map(([area, areaItems]) => (
            <div key={area} className="card">
              <h3 className="text-lg">{area}</h3>
              <ul className="mt-2 space-y-2.5">
                {areaItems.map((item) => (
                  <li key={item.id} className="flex gap-3">
                    <Tick />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold leading-snug">{item.name}</p>
                      {item.note ? <p className="text-sm text-navy-muted">{item.note}</p> : null}
                      <Photos photos={photosFor(item.id)} />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {photosFor(null).length ? (
        <section className="mt-8">
          <h2 className="text-2xl">More photos</h2>
          <div className="card mt-3"><Photos photos={photosFor(null)} /></div>
        </section>
      ) : null}

      {/* ------- Next steps ------- */}
      <footer className="mt-10 border-t border-line pt-6 text-sm text-navy-muted">
        {nextVisit ? <p className="mb-3 text-base font-semibold text-navy">Your next visit is {formatLongDay(nextVisit)}.</p> : null}
        {attention.length ? (
          <p className="mb-3">
            Some repairs are left to licensed professionals, including {referred.slice(0, 3).join('; ')}. If something above needs one, we are glad to point you to someone we trust.
          </p>
        ) : null}
        <p>Southwest Home Maintenance · Home maintenance made easy.</p>
        <p className="no-print mt-1">Keep this link: it is your record of the visit. Photos reload each time you open it.</p>
      </footer>
    </main>
  );
}

function Tick() {
  return (
    <svg viewBox="0 0 24 24" className="mt-0.5 size-5 shrink-0 text-olive" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </svg>
  );
}

function Photos({ photos }: { photos: VisitPhoto[] }) {
  if (!photos.length) return null;
  return (
    <div className="mt-2.5 grid grid-cols-2 gap-2 sm:grid-cols-3">
      {photos.map((photo) => (
        <a key={photo.id} href={photo.url} target="_blank" rel="noreferrer">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo.url} alt="Photo from the visit" loading="lazy" className="aspect-[4/3] w-full rounded-xl border border-line object-cover" />
        </a>
      ))}
    </div>
  );
}

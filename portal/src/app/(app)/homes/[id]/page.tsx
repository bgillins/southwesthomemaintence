import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { addEquipment, addSupply, addTask, deleteEquipment, deleteSupply, deleteTask } from '@/app/actions/homes';
import { SubmitButton } from '@/components/SubmitButton';
import { Empty, mapsUrl, PageHeader, PlanBadge, VisitStatusBadge } from '@/components/ui';
import { requireStaff } from '@/lib/auth';
import { isUuid } from '@/lib/form';
import { EQUIPMENT_KINDS, FEATURES, READINGS, SUPPLY_KINDS, VISITS_PER_YEAR } from '@/lib/plan';
import { createClient } from '@/lib/supabase/server';
import { formatDay, formatTime } from '@/lib/time';
import type { Customer, Equipment, Home, HomeTask, Reading, Supply, Visit } from '@/lib/types';

export const metadata: Metadata = { title: 'Home' };

// ------- Home profile: everything we know about one house -------
export default async function HomePage({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff();
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const supabase = await createClient();

  const [homeResult, equipmentResult, suppliesResult, tasksResult, visitsResult] = await Promise.all([
    supabase.from('homes').select('*, customer:customers(*)').eq('id', id).maybeSingle(),
    supabase.from('home_equipment').select('*').eq('home_id', id).order('kind'),
    supabase.from('home_supplies').select('*').eq('home_id', id).order('kind'),
    supabase.from('home_tasks').select('*').eq('home_id', id).order('created_at'),
    supabase.from('visits').select('*, readings:visit_readings(*)').eq('home_id', id).neq('status', 'cancelled').order('scheduled_for', { ascending: false }),
  ]);
  if (!homeResult.data) notFound();

  const { customer, ...home } = homeResult.data as Home & { customer: Customer };
  const equipment = (equipmentResult.data ?? []) as Equipment[];
  const supplies = (suppliesResult.data ?? []) as Supply[];
  const tasks = (tasksResult.data ?? []) as HomeTask[];
  const visits = (visitsResult.data ?? []) as (Visit & { readings: Reading[] })[];
  const openTasks = tasks.filter((task) => task.status === 'open');
  const shutoffs = Object.entries(home.shutoffs ?? {}).filter(([, value]) => value);
  const features = FEATURES.filter((feature) => home.features.includes(feature.id));
  const year = new Date().getFullYear();

  return (
    <>
      <PageHeader
        title={customer.name}
        back={{ href: '/homes', label: 'Homes' }}
        action={<Link href={`/homes/${id}/edit`} className="btn btn-quiet btn-small">Edit</Link>}
      />

      {/* ------- Contact and plan ------- */}
      <section className="card mb-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <PlanBadge plan={home.plan} />
          <span className="text-sm text-navy-muted">{VISITS_PER_YEAR[home.plan]} visits a year</span>
          {home.status !== 'active' ? <span className="tag bg-alert-tint capitalize text-alert-ink">{home.status}</span> : null}
        </div>
        <a href={mapsUrl(home.address, home.city, home.zip)} target="_blank" rel="noreferrer" className="block font-semibold underline decoration-line underline-offset-4">
          {home.address}, {home.city}, {home.state} {home.zip}
        </a>
        <div className="flex flex-wrap gap-2">
          {customer.phone ? <a href={`tel:${customer.phone}`} className="btn btn-quiet btn-small">Call {customer.phone}</a> : null}
          {customer.email ? <a href={`mailto:${customer.email}`} className="btn btn-quiet btn-small">Email</a> : null}
        </div>
        {home.access_notes ? (
          <p className="rounded-xl bg-gold-tint px-3.5 py-3 text-gold-ink"><strong>Access:</strong> {home.access_notes}</p>
        ) : null}
        {customer.notes ? <p className="text-sm text-navy-muted">{customer.notes}</p> : null}
        {home.report_cc_ok && home.report_cc_email ? (
          <p className="text-sm text-navy-muted">Report copies go to {home.report_cc_name ?? home.report_cc_email}.</p>
        ) : null}
        <Link href={`/visits/new?home=${id}`} className="btn btn-primary w-full">Schedule a visit</Link>
      </section>

      {/* ------- Visits ------- */}
      <section className="mb-6">
        <h2 className="mb-2 text-xl">Visits</h2>
        {visits.length ? (
          <ul className="space-y-2">
            {visits.map((visit) => (
              <li key={visit.id}>
                <Link href={`/visits/${visit.id}`} className="card flex items-center justify-between gap-3 hover:border-olive">
                  <div>
                    <div className="font-bold">{formatDay(visit.scheduled_for)}{new Date(visit.scheduled_for).getFullYear() !== year ? `, ${new Date(visit.scheduled_for).getFullYear()}` : ''} · {formatTime(visit.scheduled_for)}</div>
                    <div className="text-sm text-navy-muted">
                      {visit.visit_type === 'assessment' ? 'Home Health Assessment' : `Visit ${visit.seq} of ${VISITS_PER_YEAR[visit.plan]}`}
                    </div>
                  </div>
                  <VisitStatusBadge status={visit.status} />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <Empty>No visits yet. Start with the Home Health Assessment.</Empty>
        )}
      </section>

      {/* ------- The customer's list ------- */}
      <section className="mb-6">
        <h2 className="mb-2 text-xl">Their to-do list</h2>
        <div className="card space-y-3">
          {openTasks.length ? (
            <ul className="divide-y divide-line">
              {openTasks.map((task) => (
                <li key={task.id} className="flex items-center justify-between gap-3 py-2">
                  <span>{task.title}</span>
                  <form action={deleteTask}>
                    <input type="hidden" name="id" value={task.id} />
                    <input type="hidden" name="home_id" value={id} />
                    <button type="submit" className="min-h-10 px-2 text-sm font-semibold text-navy-muted underline">Remove</button>
                  </form>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-navy-muted">Nothing waiting. Jobs added here show up on the next visit.</p>
          )}
          <form action={addTask} className="flex gap-2">
            <input type="hidden" name="home_id" value={id} />
            <label htmlFor="task-title" className="sr-only">New job</label>
            <input id="task-title" name="title" required placeholder="Hang a picture, tighten a hinge…" className="input" />
            <SubmitButton className="btn btn-navy shrink-0" pendingLabel="…">Add</SubmitButton>
          </form>
        </div>
      </section>

      {/* ------- Supplies: what to bring ------- */}
      <section className="mb-6">
        <h2 className="mb-2 text-xl">What to bring</h2>
        <div className="card space-y-3">
          {supplies.length ? (
            <ul className="divide-y divide-line">
              {supplies.map((supply) => (
                <li key={supply.id} className="flex items-center justify-between gap-3 py-2">
                  <div>
                    <div className="font-semibold">{supply.qty} × {supply.spec}</div>
                    <div className="text-sm text-navy-muted">{supply.kind}{supply.location ? ` · ${supply.location}` : ''}</div>
                  </div>
                  <form action={deleteSupply}>
                    <input type="hidden" name="id" value={supply.id} />
                    <input type="hidden" name="home_id" value={id} />
                    <button type="submit" className="min-h-10 px-2 text-sm font-semibold text-navy-muted underline">Remove</button>
                  </form>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-navy-muted">Filter sizes, bulb types and batteries, so nobody arrives without the right part.</p>
          )}
          <details>
            <summary className="btn btn-quiet btn-small cursor-pointer list-none">Add a supply</summary>
            <form action={addSupply} className="mt-3 grid grid-cols-2 gap-3">
              <input type="hidden" name="home_id" value={id} />
              <div>
                <label htmlFor="supply-kind" className="label">Type</label>
                <select id="supply-kind" name="kind" className="input">{SUPPLY_KINDS.map((kind) => <option key={kind}>{kind}</option>)}</select>
              </div>
              <div>
                <label htmlFor="supply-qty" className="label">How many</label>
                <input id="supply-qty" name="qty" type="number" min={1} defaultValue={1} inputMode="numeric" className="input" />
              </div>
              <div className="col-span-2">
                <label htmlFor="supply-spec" className="label">Size or type</label>
                <input id="supply-spec" name="spec" required placeholder="20x25x1 MERV 11" className="input" />
              </div>
              <div className="col-span-2">
                <label htmlFor="supply-location" className="label">Where it goes</label>
                <input id="supply-location" name="location" placeholder="Hallway return" className="input" />
              </div>
              <SubmitButton className="btn btn-navy col-span-2">Save supply</SubmitButton>
            </form>
          </details>
        </div>
      </section>

      {/* ------- Equipment record ------- */}
      <section className="mb-6">
        <h2 className="mb-2 text-xl">Equipment record</h2>
        <div className="card space-y-3">
          {equipment.length ? (
            <ul className="divide-y divide-line">
              {equipment.map((item) => (
                <li key={item.id} className="flex items-start justify-between gap-3 py-2">
                  <div>
                    <div className="font-semibold">{item.kind}{item.install_year ? ` · ${item.install_year} (${year - item.install_year} yr)` : ''}</div>
                    <div className="text-sm text-navy-muted">
                      {[item.make, item.model].filter(Boolean).join(' ') || 'Make and model not recorded'}
                      {item.serial ? ` · S/N ${item.serial}` : ''}
                      {item.location ? ` · ${item.location}` : ''}
                    </div>
                    {item.notes ? <div className="text-sm">{item.notes}</div> : null}
                  </div>
                  <form action={deleteEquipment}>
                    <input type="hidden" name="id" value={item.id} />
                    <input type="hidden" name="home_id" value={id} />
                    <button type="submit" className="min-h-10 px-2 text-sm font-semibold text-navy-muted underline">Remove</button>
                  </form>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-navy-muted">Recorded at the Home Health Assessment: make, model, serial and age.</p>
          )}
          <details>
            <summary className="btn btn-quiet btn-small cursor-pointer list-none">Add equipment</summary>
            <form action={addEquipment} className="mt-3 grid grid-cols-2 gap-3">
              <input type="hidden" name="home_id" value={id} />
              <div className="col-span-2">
                <label htmlFor="eq-kind" className="label">What is it</label>
                <select id="eq-kind" name="kind" className="input">{EQUIPMENT_KINDS.map((kind) => <option key={kind}>{kind}</option>)}</select>
              </div>
              <div>
                <label htmlFor="eq-make" className="label">Make</label>
                <input id="eq-make" name="make" className="input" />
              </div>
              <div>
                <label htmlFor="eq-model" className="label">Model</label>
                <input id="eq-model" name="model" autoCapitalize="characters" className="input" />
              </div>
              <div>
                <label htmlFor="eq-serial" className="label">Serial</label>
                <input id="eq-serial" name="serial" autoCapitalize="characters" className="input" />
              </div>
              <div>
                <label htmlFor="eq-year" className="label">Year installed</label>
                <input id="eq-year" name="install_year" type="number" inputMode="numeric" min={1970} max={year} className="input" />
              </div>
              <div className="col-span-2">
                <label htmlFor="eq-location" className="label">Where</label>
                <input id="eq-location" name="location" placeholder="Garage, attic, side yard" className="input" />
              </div>
              <div className="col-span-2">
                <label htmlFor="eq-notes" className="label">Notes</label>
                <input id="eq-notes" name="notes" className="input" />
              </div>
              <SubmitButton className="btn btn-navy col-span-2">Save equipment</SubmitButton>
            </form>
          </details>
        </div>
      </section>

      {/* ------- Shutoffs and features ------- */}
      <section className="mb-6">
        <h2 className="mb-2 text-xl">Shutoffs</h2>
        <div className="card">
          {shutoffs.length ? (
            <dl className="divide-y divide-line">
              {shutoffs.map(([key, value]) => (
                <div key={key} className="flex justify-between gap-4 py-2">
                  <dt className="font-semibold capitalize">{key.replace('_', ' ')}</dt>
                  <dd className="text-right text-navy-muted">{value}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="text-navy-muted">Not recorded yet. Add them under Edit after the assessment.</p>
          )}
          {features.length ? <p className="mt-3 text-sm text-navy-muted">This home has: {features.map((feature) => feature.label.toLowerCase()).join(', ')}.</p> : null}
        </div>
      </section>

      {/* ------- Readings over time ------- */}
      {visits.some((visit) => visit.readings.length) ? (
        <section>
          <h2 className="mb-2 text-xl">Readings over time</h2>
          <div className="card overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-navy-muted">
                  <th className="py-1.5 pr-3 font-semibold">Visit</th>
                  {READINGS.map((reading) => <th key={reading.key} className="py-1.5 pr-3 font-semibold">{reading.label}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {visits.filter((visit) => visit.readings.length).map((visit) => (
                  <tr key={visit.id}>
                    <td className="py-1.5 pr-3 font-semibold">{formatDay(visit.scheduled_for)}</td>
                    {READINGS.map((reading) => {
                      const found = visit.readings.find((row) => row.key === reading.key);
                      return <td key={reading.key} className="py-1.5 pr-3">{found ? `${found.value} ${reading.unit}` : '–'}</td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </>
  );
}

'use client';

// ------- The tech's screen for one visit -------
// How it works: every tap changes the screen straight away (so it feels instant
// on a slow signal), then saves in the background. If a save fails, the change
// is undone and a message says so. Nothing is lost silently.
import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { addTask, setTaskDone } from '@/app/actions/homes';
import {
  addVisitSupply,
  cancelVisit,
  completeVisit,
  deletePhoto,
  recordPhoto,
  removeVisitSupply,
  reopenVisit,
  resendReport,
  saveReading,
  startVisit,
  updateItem,
  updateVisitDetails,
} from '@/app/actions/visits';
import { SubmitButton } from '@/components/SubmitButton';
import { mapsUrl, PlanBadge, VisitStatusBadge } from '@/components/ui';
import { PHOTO_BUCKET } from '@/lib/env';
import { shrinkPhoto } from '@/lib/photo';
import { READINGS, TASK_MINUTES, VISIT_MINUTES, VISITS_PER_YEAR } from '@/lib/plan';
import { createClient } from '@/lib/supabase/client';
import { formatLongDay, formatTime, toLocalInput } from '@/lib/time';
import type { ActionResult, Customer, Home, HomeTask, ItemStatus, Reading, Staff, Supply, Visit, VisitItem, VisitPhoto, VisitSupply } from '@/lib/types';

interface Props {
  visit: Visit;
  techName: string | null;
  home: Home;
  customer: Customer;
  items: VisitItem[];
  photos: VisitPhoto[];
  readings: Reading[];
  supplies: VisitSupply[];
  tasks: HomeTask[];
  homeSupplies: Supply[];
  staffList: Pick<Staff, 'id' | 'full_name'>[];
  isOwner: boolean;
}

export function VisitRunner(props: Props) {
  const { visit, home, customer } = props;
  const router = useRouter();
  const [items, setItems] = useState(props.items);
  const [photos, setPhotos] = useState(props.photos);
  const [supplies, setSupplies] = useState(props.supplies);
  const [summary, setSummary] = useState(visit.summary ?? '');
  // Ticks on the to-do list show at once; the saved value catches up after.
  const [taskTicks, setTaskTicks] = useState<Record<string, boolean>>({});
  const [message, setMessage] = useState<{ tone: 'error' | 'ok'; text: string } | null>(null);
  const [busy, startTransition] = useTransition();

  const editable = visit.status === 'in_progress';
  const answered = items.filter((item) => item.status !== 'pending').length;
  const issues = items.filter((item) => item.status === 'attention').length;
  const plannedMinutes = items.reduce((total, item) => total + (item.minutes ?? 0), 0);

  const fail = (text: string) => setMessage({ tone: 'error', text });

  // ------- Saving -------
  // Every change goes through here. It counts saves in flight (for the
  // "Saving…" label), and if a save is refused OR never reaches the server
  // (no signal), it undoes the change on screen and says so. The screen must
  // never show something as saved when it is not.
  const [saving, setSaving] = useState(0);
  async function save<T extends ActionResult>(action: () => Promise<T>, undo: () => void): Promise<T | null> {
    setSaving((count) => count + 1);
    try {
      const result = await action();
      if (result.ok) return result;
      undo();
      fail(result.error);
    } catch {
      undo();
      fail('Not saved: no connection. Check your signal and try again.');
    } finally {
      setSaving((count) => count - 1);
    }
    return null;
  }

  // Warn before closing the page while something is still being saved.
  useEffect(() => {
    if (!saving) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [saving]);

  // ------- Checklist -------
  function changeItem(item: VisitItem, change: { status?: ItemStatus; note?: string | null }) {
    // Remember only this item's old values. Undoing must not disturb answers
    // given to other items while this one was saving.
    const previous = { status: item.status, note: item.note };
    const apply = (values: Partial<VisitItem>) => setItems((list) => list.map((row) => (row.id === item.id ? { ...row, ...values } : row)));
    apply(change);
    void save(() => updateItem(item.id, visit.id, change), () => apply(change.status === undefined ? { note: previous.note } : { status: previous.status }));
  }

  // ------- Photos -------
  async function addPhoto(file: File, itemId: string | null) {
    setSaving((count) => count + 1);
    try {
      const { blob, width, height } = await shrinkPhoto(file);
      const path = `${visit.id}/${crypto.randomUUID()}.jpg`;
      const { error } = await createClient().storage.from(PHOTO_BUCKET).upload(path, blob, { contentType: 'image/jpeg' });
      if (error) throw new Error(error.message);
      const result = await recordPhoto({ visitId: visit.id, itemId, path, width, height });
      if (!result.ok) throw new Error(result.error);
      setPhotos((list) => [...list, { id: result.id!, visit_id: visit.id, item_id: itemId, storage_path: path, caption: null, width, height, url: result.url }]);
    } catch (error) {
      fail(`Photo not saved: ${error instanceof Error ? error.message : 'unknown problem'}. Check your signal and try again.`);
    } finally {
      setSaving((count) => count - 1);
    }
  }

  function removePhoto(photo: VisitPhoto) {
    setPhotos((list) => list.filter((row) => row.id !== photo.id));
    void save(() => deletePhoto(photo.id, visit.id), () => setPhotos((list) => [...list, photo]));
  }

  // ------- Parts used -------
  async function addSupply(name: string, qty: number) {
    const result = await save(() => addVisitSupply(visit.id, name, qty), () => {});
    if (result) setSupplies((list) => [...list, { id: result.id!, visit_id: visit.id, name: name.trim(), qty }]);
  }

  function removeSupply(supply: VisitSupply) {
    setSupplies((list) => list.filter((row) => row.id !== supply.id));
    void save(() => removeVisitSupply(supply.id, visit.id), () => setSupplies((list) => [...list, supply]));
  }

  // ------- Finish -------
  function finish() {
    if (!window.confirm('Finish this visit and email the report to the customer?')) return;
    startTransition(async () => {
      const result = await save(() => completeVisit(visit.id, summary), () => {});
      if (!result) return;
      setMessage({ tone: 'ok', text: result.notice ?? 'Visit finished.' });
      router.refresh();
    });
  }

  function sendAgain() {
    startTransition(async () => {
      const result = await save(() => resendReport(visit.id), () => {});
      if (result) setMessage({ tone: 'ok', text: result.notice ?? 'Sent.' });
    });
  }

  // Group the flat list of items under their category headings.
  const categories: { id: string; title: string; items: VisitItem[] }[] = [];
  for (const item of items) {
    const last = categories[categories.length - 1];
    if (last?.id === item.category_id) last.items.push(item);
    else categories.push({ id: item.category_id, title: item.category_title, items: [item] });
  }

  return (
    <div className="space-y-4">
      {/* ------- Where and who ------- */}
      <section className="card space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <VisitStatusBadge status={visit.status} />
          <PlanBadge plan={visit.plan} />
          <span className="text-sm font-semibold text-navy-muted">
            {visit.visit_type === 'assessment' ? 'Home Health Assessment' : `Visit ${visit.seq} of ${VISITS_PER_YEAR[visit.plan]}`}
          </span>
        </div>
        <p className="font-semibold">
          {formatLongDay(visit.scheduled_for)} at {formatTime(visit.scheduled_for)}
          <span className="font-normal text-navy-muted"> · {props.techName ?? 'Unassigned'}</span>
        </p>
        <div className="flex flex-wrap gap-2">
          <a href={mapsUrl(home.address, home.city, home.zip)} target="_blank" rel="noreferrer" className="btn btn-quiet btn-small">
            Directions: {home.address}
          </a>
          {customer.phone ? <a href={`tel:${customer.phone}`} className="btn btn-quiet btn-small">Call</a> : null}
          <a href={`/homes/${home.id}`} className="btn btn-quiet btn-small">Home profile</a>
        </div>
        {home.access_notes ? (
          <p className="rounded-xl bg-gold-tint px-3.5 py-3 text-gold-ink"><strong>Access:</strong> {home.access_notes}</p>
        ) : null}
        {props.homeSupplies.length ? (
          <p className="text-sm text-navy-muted">
            <strong className="text-navy">Bring:</strong> {props.homeSupplies.map((supply) => `${supply.qty} × ${supply.spec}`).join(', ')}
          </p>
        ) : null}
      </section>

      {/* ------- Before the visit starts ------- */}
      {visit.status === 'scheduled' ? (
        <section className="card space-y-3">
          <p className="text-navy-muted">
            {items.length} checklist items, about {plannedMinutes} minutes of a {VISIT_MINUTES[visit.plan]}-minute visit.
          </p>
          <form action={startVisit}>
            <input type="hidden" name="visit_id" value={visit.id} />
            <SubmitButton className="btn btn-primary w-full" pendingLabel="Starting…">Start visit</SubmitButton>
          </form>
          <details>
            <summary className="cursor-pointer text-sm font-semibold text-navy-muted underline">Reschedule, reassign or cancel</summary>
            <form action={updateVisitDetails} className="mt-3 space-y-3">
              <input type="hidden" name="visit_id" value={visit.id} />
              <div>
                <label htmlFor="scheduled_for" className="label">Date and time (Las Vegas)</label>
                <input id="scheduled_for" name="scheduled_for" type="datetime-local" required defaultValue={toLocalInput(new Date(visit.scheduled_for))} className="input" />
              </div>
              <div>
                <label htmlFor="tech_id" className="label">Technician</label>
                <select id="tech_id" name="tech_id" defaultValue={visit.tech_id ?? ''} className="input">
                  <option value="">Unassigned</option>
                  {props.staffList.map((person) => <option key={person.id} value={person.id}>{person.full_name}</option>)}
                </select>
              </div>
              <SubmitButton className="btn btn-navy w-full">Save changes</SubmitButton>
            </form>
            <form action={cancelVisit} className="mt-3" onSubmit={(event) => { if (!window.confirm('Cancel this visit?')) event.preventDefault(); }}>
              <input type="hidden" name="visit_id" value={visit.id} />
              <button type="submit" className="btn btn-quiet w-full text-alert">Cancel this visit</button>
            </form>
          </details>
        </section>
      ) : null}

      {/* ------- After the visit ------- */}
      {visit.status === 'completed' ? (
        <section className="card space-y-3">
          <p className="font-semibold">
            Finished {visit.completed_at ? `${formatLongDay(visit.completed_at)} at ${formatTime(visit.completed_at)}` : ''}.{' '}
            <span className="font-normal text-navy-muted">{visit.report_sent_at ? 'Report emailed.' : 'Report not emailed yet.'}</span>
          </p>
          {visit.summary ? <p className="border-l-4 border-gold pl-3 text-navy-muted">{visit.summary}</p> : null}
          <a href={`/r/${visit.report_token}`} target="_blank" rel="noreferrer" className="btn btn-primary w-full">Open the customer report</a>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={sendAgain} disabled={busy} className="btn btn-quiet btn-small">{busy ? 'Sending…' : 'Email it again'}</button>
            <button
              type="button"
              className="btn btn-quiet btn-small"
              onClick={async () => {
                await navigator.clipboard.writeText(`${window.location.origin}/r/${visit.report_token}`);
                setMessage({ tone: 'ok', text: 'Report link copied.' });
              }}
            >
              Copy link
            </button>
          </div>
          {props.isOwner ? (
            <form action={reopenVisit}>
              <input type="hidden" name="visit_id" value={visit.id} />
              <button type="submit" className="text-sm font-semibold text-navy-muted underline">Reopen to fix something</button>
            </form>
          ) : null}
        </section>
      ) : null}

      {/* ------- Progress (stays in view while scrolling) ------- */}
      {editable ? (
        <div className="sticky top-0 z-20 -mx-4 border-b border-line bg-cream/95 px-4 py-2.5 backdrop-blur">
          <div className="flex items-center justify-between text-sm font-bold">
            <span>{answered} of {items.length} answered</span>
            <span className="flex items-center gap-3">
              {issues ? <span className="text-alert">{issues} to flag</span> : null}
              <span role="status" aria-live="polite" className={saving ? 'text-gold-ink' : 'font-semibold text-navy-muted'}>
                {saving ? 'Saving…' : 'All saved'}
              </span>
            </span>
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuemin={0} aria-valuemax={items.length} aria-valuenow={answered} aria-label="Checklist progress">
            <div className="h-full rounded-full bg-olive transition-all" style={{ width: `${items.length ? (answered / items.length) * 100 : 0}%` }} />
          </div>
        </div>
      ) : null}

      {message ? (
        <p role={message.tone === 'error' ? 'alert' : 'status'} className={`flex items-start justify-between gap-3 rounded-xl px-3.5 py-3 font-semibold ${message.tone === 'error' ? 'bg-alert-tint text-alert-ink' : 'bg-olive-tint text-olive-ink'}`}>
          <span>{message.text}</span>
          <button type="button" onClick={() => setMessage(null)} aria-label="Dismiss" className="-my-1 px-1 text-xl leading-none">×</button>
        </p>
      ) : null}

      {/* ------- Checklist ------- */}
      {categories.map((category) => {
        const open = category.items.filter((item) => item.status === 'pending').length;
        return (
          <details key={category.id} open={visit.status !== 'completed' || category.items.some((item) => item.status === 'attention')} className="group card p-0">
            <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4">
              <h2 className="text-lg">{category.title}</h2>
              <span className={`tag ${open ? 'bg-navy-tint text-navy' : 'bg-olive-tint text-olive-ink'}`}>
                {open ? `${category.items.length - open}/${category.items.length}` : 'Done'}
              </span>
            </summary>
            <ul className="divide-y divide-line border-t border-line">
              {category.items.map((item) => (
                <ItemRow
                  key={item.id}
                  item={item}
                  photos={photos.filter((photo) => photo.item_id === item.id)}
                  editable={editable}
                  onChange={(change) => changeItem(item, change)}
                  onAddPhoto={(file) => addPhoto(file, item.id)}
                  onRemovePhoto={removePhoto}
                />
              ))}
            </ul>
          </details>
        );
      })}

      {/* ------- The customer's own list ------- */}
      {visit.status !== 'scheduled' || props.tasks.length ? (
        <section className="card space-y-3">
          <div>
            <h2 className="text-lg">Their to-do list</h2>
            <p className="text-sm text-navy-muted">
              {TASK_MINUTES[visit.plan] ? `${TASK_MINUTES[visit.plan]} minutes are included on this plan.` : 'Not included on Essentials: billed at the member rate.'}
            </p>
          </div>
          {props.tasks.length ? (
            <ul className="divide-y divide-line">
              {props.tasks.map((task) => {
                const done = taskTicks[task.id] ?? task.status === 'done';
                return (
                  <li key={task.id}>
                    <label className="flex min-h-12 items-center gap-3 py-1">
                      <input
                        type="checkbox"
                        className="size-6 accent-olive"
                        checked={done}
                        disabled={!editable}
                        onChange={(event) => {
                          const next = event.target.checked;
                          setTaskTicks((ticks) => ({ ...ticks, [task.id]: next }));
                          startTransition(async () => {
                            await save(
                              () => setTaskDone(task.id, visit.id, next, null),
                              () => setTaskTicks((ticks) => ({ ...ticks, [task.id]: !next })),
                            );
                            router.refresh();
                          });
                        }}
                      />
                      <span className={done ? 'text-navy-muted line-through' : ''}>{task.title}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-navy-muted">Nothing on the list. Ask if there is anything small they need done.</p>
          )}
          {editable ? (
            <form action={addTask} className="flex gap-2">
              <input type="hidden" name="home_id" value={home.id} />
              <input type="hidden" name="visit_id" value={visit.id} />
              <label htmlFor="new-task" className="sr-only">Add a job</label>
              <input id="new-task" name="title" required placeholder="Add a job they asked for" className="input" />
              <SubmitButton className="btn btn-navy shrink-0" pendingLabel="…">Add</SubmitButton>
            </form>
          ) : null}
        </section>
      ) : null}

      {/* ------- Readings ------- */}
      {visit.status !== 'scheduled' ? (
        <section className="card space-y-3">
          <h2 className="text-lg">Readings</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            {READINGS.map((reading) => (
              <div key={reading.key}>
                <label htmlFor={`reading-${reading.key}`} className="label">{reading.label} ({reading.unit})</label>
                <input
                  id={`reading-${reading.key}`}
                  type="number"
                  inputMode="decimal"
                  step="any"
                  disabled={!editable}
                  defaultValue={props.readings.find((row) => row.key === reading.key)?.value ?? ''}
                  onBlur={(event) => {
                    const value = event.target.value === '' ? null : Number(event.target.value);
                    void save(() => saveReading(visit.id, reading.key, value), () => {});
                  }}
                  className="input"
                />
                <p className="mt-1 text-xs text-navy-muted">{reading.hint}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* ------- Parts used ------- */}
      {visit.status !== 'scheduled' ? (
        <section className="card space-y-3">
          <h2 className="text-lg">Parts we supplied</h2>
          {supplies.length ? (
            <ul className="divide-y divide-line">
              {supplies.map((supply) => (
                <li key={supply.id} className="flex min-h-12 items-center justify-between gap-3">
                  <span>{supply.qty} × {supply.name}</span>
                  {editable ? <button type="button" onClick={() => removeSupply(supply)} className="min-h-10 px-2 text-sm font-semibold text-navy-muted underline">Remove</button> : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-navy-muted">Filters, batteries and bulbs you put in today.</p>
          )}
          {editable ? <SupplyAdder suggestions={props.homeSupplies} onAdd={addSupply} /> : null}
        </section>
      ) : null}

      {/* ------- Photos not tied to a checklist item ------- */}
      {visit.status !== 'scheduled' ? (
        <section className="card space-y-3">
          <h2 className="text-lg">Other photos</h2>
          <PhotoStrip photos={photos.filter((photo) => !photo.item_id)} editable={editable} onAdd={(file) => addPhoto(file, null)} onRemove={removePhoto} label="Add a photo" />
        </section>
      ) : null}

      {/* ------- Finish ------- */}
      {editable ? (
        <section className="card space-y-3">
          <h2 className="text-lg">Finish up</h2>
          <div>
            <label htmlFor="summary" className="label">Note to the customer</label>
            <textarea id="summary" rows={4} value={summary} onChange={(event) => setSummary(event.target.value)} placeholder="Everything looked good today. I replaced both air filters and…" className="input" />
            <p className="mt-1 text-xs text-navy-muted">Shown at the top of their report. Plain words, like you would say at the door.</p>
          </div>
          <button type="button" onClick={finish} disabled={busy || saving > 0} className="btn btn-primary w-full">
            {busy ? 'Finishing…' : saving > 0 ? 'Saving your answers…' : 'Finish visit and send report'}
          </button>
          {answered < items.length ? <p className="text-center text-sm text-navy-muted">{items.length - answered} items still need an answer.</p> : null}
        </section>
      ) : null}
    </div>
  );
}

// ------- One checklist item -------
const ANSWERS: Record<'do' | 'check', { status: ItemStatus; label: string; on: string }[]> = {
  do: [
    { status: 'done', label: 'Done', on: 'bg-olive text-white border-olive' },
    { status: 'attention', label: 'Problem', on: 'bg-alert text-white border-alert' },
    { status: 'na', label: 'N/A', on: 'bg-navy-muted text-white border-navy-muted' },
  ],
  check: [
    { status: 'done', label: 'Looks good', on: 'bg-olive text-white border-olive' },
    { status: 'attention', label: 'Problem', on: 'bg-alert text-white border-alert' },
    { status: 'na', label: 'N/A', on: 'bg-navy-muted text-white border-navy-muted' },
  ],
};

function ItemRow(props: {
  item: VisitItem;
  photos: VisitPhoto[];
  editable: boolean;
  onChange: (change: { status?: ItemStatus; note?: string | null }) => void;
  onAddPhoto: (file: File) => Promise<void>;
  onRemovePhoto: (photo: VisitPhoto) => void;
}) {
  const { item, editable } = props;
  const [showMore, setShowMore] = useState(false);
  // The note and photo area opens by itself for problems, or when there is already something in it.
  const expanded = showMore || item.status === 'attention' || Boolean(item.note) || props.photos.length > 0;

  return (
    <li className="space-y-2.5 px-4 py-3.5">
      <div>
        <p className="font-bold leading-snug">{item.name}</p>
        {item.detail ? <p className="mt-0.5 text-sm text-navy-muted">{item.detail}</p> : null}
      </div>

      <div className="grid grid-cols-3 gap-2" role="group" aria-label={`Answer for ${item.name}`}>
        {ANSWERS[item.kind].map((answer) => {
          const selected = item.status === answer.status;
          return (
            <button
              key={answer.status}
              type="button"
              disabled={!editable}
              aria-pressed={selected}
              // Tapping the selected answer again clears it.
              onClick={() => props.onChange({ status: selected ? 'pending' : answer.status })}
              className={`min-h-12 rounded-xl border-2 px-1 text-sm font-bold transition-colors disabled:cursor-default ${selected ? answer.on : 'border-line bg-white text-navy disabled:opacity-40'}`}
            >
              {answer.label}
            </button>
          );
        })}
      </div>

      {expanded ? (
        <div className="space-y-2">
          <label htmlFor={`note-${item.id}`} className="sr-only">Note for {item.name}</label>
          <textarea
            id={`note-${item.id}`}
            rows={2}
            disabled={!editable}
            defaultValue={item.note ?? ''}
            placeholder={item.status === 'attention' ? 'What did you see? The customer reads this.' : 'Note (optional)'}
            onBlur={(event) => {
              if (event.target.value.trim() !== (item.note ?? '')) props.onChange({ note: event.target.value });
            }}
            className={`input ${item.status === 'attention' && !item.note ? 'border-alert' : ''}`}
          />
          <PhotoStrip photos={props.photos} editable={editable} onAdd={props.onAddPhoto} onRemove={props.onRemovePhoto} label="Photo" />
        </div>
      ) : editable ? (
        <button type="button" onClick={() => setShowMore(true)} className="min-h-10 text-sm font-semibold text-navy-muted underline">
          Add a note or photo
        </button>
      ) : null}
    </li>
  );
}

// ------- Photo thumbnails plus an "add" button that opens the camera -------
function PhotoStrip(props: { photos: VisitPhoto[]; editable: boolean; label: string; onAdd: (file: File) => Promise<void>; onRemove: (photo: VisitPhoto) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(0);

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return;
    const list = [...files];
    setUploading(list.length);
    for (const file of list) {
      await props.onAdd(file);
      setUploading((count) => count - 1);
    }
    if (input.current) input.current.value = '';
  }

  if (!props.editable && !props.photos.length) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {props.photos.map((photo) => (
        <div key={photo.id} className="relative">
          <a href={photo.url} target="_blank" rel="noreferrer">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo.url} alt="Visit photo" className="size-20 rounded-xl border border-line object-cover" />
          </a>
          {props.editable ? (
            <button type="button" onClick={() => props.onRemove(photo)} aria-label="Delete photo" className="absolute -right-2 -top-2 flex size-7 items-center justify-center rounded-full bg-navy text-base font-bold text-white">
              ×
            </button>
          ) : null}
        </div>
      ))}
      {props.editable ? (
        <>
          <button type="button" onClick={() => input.current?.click()} disabled={uploading > 0} className="flex size-20 flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-line bg-white text-xs font-bold text-navy-muted">
            <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" />
              <circle cx="12" cy="13" r="3.5" />
            </svg>
            {uploading > 0 ? 'Saving…' : props.label}
          </button>
          {/* capture="environment" opens the back camera on a phone; on a computer it is a file picker. */}
          <input ref={input} type="file" accept="image/*" capture="environment" multiple hidden onChange={(event) => handleFiles(event.target.files)} />
        </>
      ) : null}
    </div>
  );
}

// ------- Add a part: one tap for the home's usual supplies, or type something else -------
function SupplyAdder(props: { suggestions: Supply[]; onAdd: (name: string, qty: number) => Promise<void> }) {
  const [name, setName] = useState('');
  const [qty, setQty] = useState(1);

  return (
    <div className="space-y-2">
      {props.suggestions.length ? (
        <div className="flex flex-wrap gap-2">
          {props.suggestions.map((supply) => (
            <button key={supply.id} type="button" onClick={() => props.onAdd(`${supply.kind}: ${supply.spec}`, supply.qty)} className="btn btn-quiet btn-small">
              + {supply.qty} × {supply.spec}
            </button>
          ))}
        </div>
      ) : null}
      <div className="flex gap-2">
        <label htmlFor="supply-qty" className="sr-only">Quantity</label>
        <input id="supply-qty" type="number" min={1} inputMode="numeric" value={qty} onChange={(event) => setQty(Number(event.target.value) || 1)} className="input w-20 shrink-0" />
        <label htmlFor="supply-name" className="sr-only">Part</label>
        <input id="supply-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="9V battery, LED bulb…" className="input" />
        <button
          type="button"
          disabled={!name.trim()}
          onClick={async () => {
            await props.onAdd(name, qty);
            setName('');
            setQty(1);
          }}
          className="btn btn-navy shrink-0"
        >
          Add
        </button>
      </div>
    </div>
  );
}

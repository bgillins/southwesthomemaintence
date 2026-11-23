'use client';

import { useActionState, useState } from 'react';
import { createVisit } from '@/app/actions/visits';

interface Props {
  homes: { id: string; label: string }[];
  staff: { id: string; full_name: string }[];
  unvisitedHomeIds: string[];
  defaultHomeId: string;
  defaultTechId: string;
  defaultWhen: string;
}

export function NewVisitForm({ homes, staff, unvisitedHomeIds, defaultHomeId, defaultTechId, defaultWhen }: Props) {
  const [state, formAction, pending] = useActionState(createVisit, null);
  const [homeId, setHomeId] = useState(defaultHomeId);
  const firstVisit = unvisitedHomeIds.includes(homeId);

  return (
    <form action={formAction} className="card space-y-4">
      <div>
        <label htmlFor="home_id" className="label">Home</label>
        <select id="home_id" name="home_id" required value={homeId} onChange={(event) => setHomeId(event.target.value)} className="input">
          <option value="">Choose a home…</option>
          {homes.map((home) => <option key={home.id} value={home.id}>{home.label}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="visit_type" className="label">Kind of visit</label>
        {/* key resets the default when the chosen home changes */}
        <select id="visit_type" name="visit_type" key={homeId} defaultValue={firstVisit ? 'assessment' : 'maintenance'} className="input">
          <option value="maintenance">Maintenance visit</option>
          <option value="assessment">Home Health Assessment (first visit)</option>
        </select>
        {firstVisit ? <p className="mt-1.5 text-sm text-navy-muted">This home has not been visited yet, so it starts with the assessment.</p> : null}
      </div>
      <div>
        <label htmlFor="scheduled_for" className="label">Date and time (Las Vegas)</label>
        <input id="scheduled_for" name="scheduled_for" type="datetime-local" required defaultValue={defaultWhen} className="input" />
      </div>
      <div>
        <label htmlFor="tech_id" className="label">Technician</label>
        <select id="tech_id" name="tech_id" defaultValue={defaultTechId} className="input">
          <option value="">Unassigned</option>
          {staff.map((person) => <option key={person.id} value={person.id}>{person.full_name}</option>)}
        </select>
      </div>
      {state && !state.ok ? <p role="alert" className="rounded-xl bg-alert-tint px-3.5 py-3 font-semibold text-alert-ink">{state.error}</p> : null}
      <button type="submit" disabled={pending} className="btn btn-primary w-full">{pending ? 'Building the checklist…' : 'Schedule visit'}</button>
    </form>
  );
}

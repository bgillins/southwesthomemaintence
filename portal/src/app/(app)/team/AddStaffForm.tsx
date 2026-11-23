'use client';

import { useActionState, useEffect, useRef } from 'react';
import { addStaff } from '@/app/actions/team';

export function AddStaffForm() {
  const [state, formAction, pending] = useActionState(addStaff, null);
  const form = useRef<HTMLFormElement>(null);

  // Clear the form after a successful add, ready for the next person.
  useEffect(() => {
    if (state?.ok) form.current?.reset();
  }, [state]);

  return (
    <form ref={form} action={formAction} className="card space-y-4">
      <p className="text-sm text-navy-muted">They sign in with a code sent to this email. No password to set up.</p>
      <div>
        <label htmlFor="full_name" className="label">Name</label>
        <input id="full_name" name="full_name" required className="input" />
      </div>
      <div>
        <label htmlFor="staff-email" className="label">Email</label>
        <input id="staff-email" name="email" type="email" inputMode="email" autoCapitalize="none" required className="input" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="staff-phone" className="label">Phone</label>
          <input id="staff-phone" name="phone" type="tel" inputMode="tel" className="input" />
        </div>
        <div>
          <label htmlFor="role" className="label">Role</label>
          <select id="role" name="role" defaultValue="tech" className="input">
            <option value="tech">Technician</option>
            <option value="owner">Owner (can manage the team)</option>
          </select>
        </div>
      </div>
      {state && !state.ok ? <p role="alert" className="rounded-xl bg-alert-tint px-3.5 py-3 font-semibold text-alert-ink">{state.error}</p> : null}
      {state?.ok ? <p role="status" className="rounded-xl bg-olive-tint px-3.5 py-3 font-semibold text-olive-ink">Added. They can sign in now.</p> : null}
      <button type="submit" disabled={pending} className="btn btn-primary w-full">{pending ? 'Adding…' : 'Add to team'}</button>
    </form>
  );
}

'use client';

import { useActionState } from 'react';
import { plans } from '@/data/plans';
import { FEATURES } from '@/lib/plan';
import type { ActionResult, Customer, Home } from '@/lib/types';

type Action = (previous: ActionResult | null, formData: FormData) => Promise<ActionResult>;

const SHUTOFFS = [
  { key: 'main_water', label: 'Main water' },
  { key: 'water_heater', label: 'Water heater' },
  { key: 'gas', label: 'Gas meter' },
  { key: 'irrigation', label: 'Irrigation' },
  { key: 'panel', label: 'Electrical panel' },
] as const;

// One form for both "add a home" and "edit a home".
export function HomeForm({ action, home, customer }: { action: Action; home?: Home; customer?: Customer }) {
  const [state, formAction, pending] = useActionState(action, null);

  return (
    <form action={formAction} className="space-y-5">
      {home ? <input type="hidden" name="home_id" value={home.id} /> : null}
      {customer ? <input type="hidden" name="customer_id" value={customer.id} /> : null}

      {/* ------- Customer ------- */}
      <fieldset className="card space-y-4">
        <legend className="eyebrow float-left mb-3 w-full">Customer</legend>
        <div className="clear-both">
          <label htmlFor="name" className="label">Name</label>
          <input id="name" name="name" required autoComplete="off" defaultValue={customer?.name} className="input" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="phone" className="label">Phone</label>
            <input id="phone" name="phone" type="tel" inputMode="tel" defaultValue={customer?.phone ?? ''} className="input" />
          </div>
          <div>
            <label htmlFor="email" className="label">Email (reports go here)</label>
            <input id="email" name="email" type="email" inputMode="email" autoCapitalize="none" defaultValue={customer?.email ?? ''} className="input" />
          </div>
        </div>
        <div>
          <label htmlFor="notes" className="label">Notes about the customer</label>
          <textarea id="notes" name="notes" rows={2} defaultValue={customer?.notes ?? ''} className="input" />
        </div>
      </fieldset>

      {/* ------- Home ------- */}
      <fieldset className="card space-y-4">
        <legend className="eyebrow float-left mb-3 w-full">Home</legend>
        <div className="clear-both">
          <label htmlFor="address" className="label">Street address</label>
          <input id="address" name="address" required autoComplete="off" defaultValue={home?.address} className="input" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="city" className="label">City</label>
            <input id="city" name="city" defaultValue={home?.city ?? 'Las Vegas'} className="input" />
          </div>
          <div>
            <label htmlFor="zip" className="label">ZIP</label>
            <input id="zip" name="zip" inputMode="numeric" defaultValue={home?.zip ?? ''} className="input" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="plan" className="label">Plan</label>
            <select id="plan" name="plan" defaultValue={home?.plan ?? 'essentials'} className="input">
              {plans.map((plan) => (
                <option key={plan.id} value={plan.id}>{plan.name} ({plan.visits})</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="member_since" className="label">Member since</label>
            <input id="member_since" name="member_since" type="date" defaultValue={home?.member_since ?? ''} className="input" />
          </div>
        </div>
        {home ? (
          <div>
            <label htmlFor="status" className="label">Membership status</label>
            <select id="status" name="status" defaultValue={home.status} className="input">
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        ) : null}
        <div>
          <label htmlFor="access_notes" className="label">Access notes</label>
          <textarea id="access_notes" name="access_notes" rows={2} placeholder="Gate code, pets, where to park, who will be home" defaultValue={home?.access_notes ?? ''} className="input" />
        </div>
      </fieldset>

      {/* ------- What the home has ------- */}
      <fieldset className="card">
        <legend className="eyebrow float-left mb-1 w-full">This home has</legend>
        <p className="clear-both mb-3 text-sm text-navy-muted">Only ticked items show up on the visit checklist.</p>
        <div className="grid gap-x-4 sm:grid-cols-2">
          {FEATURES.map((feature) => (
            <label key={feature.id} className="flex min-h-12 items-center gap-3">
              <input type="checkbox" name={`feature_${feature.id}`} defaultChecked={home?.features.includes(feature.id)} className="size-5 accent-olive" />
              {feature.label}
            </label>
          ))}
        </div>
      </fieldset>

      {/* ------- Shutoffs ------- */}
      <fieldset className="card space-y-4">
        <legend className="eyebrow float-left mb-1 w-full">Where the shutoffs are</legend>
        <p className="clear-both text-sm text-navy-muted">Found and tagged at the Home Health Assessment. Leave blank until then.</p>
        {SHUTOFFS.map((shutoff) => (
          <div key={shutoff.key}>
            <label htmlFor={`shutoff_${shutoff.key}`} className="label">{shutoff.label}</label>
            <input id={`shutoff_${shutoff.key}`} name={`shutoff_${shutoff.key}`} defaultValue={home?.shutoffs?.[shutoff.key] ?? ''} className="input" />
          </div>
        ))}
      </fieldset>

      {/* ------- Family copy ------- */}
      <fieldset className="card space-y-4">
        <legend className="eyebrow float-left mb-1 w-full">Report copy for a family member</legend>
        <p className="clear-both text-sm text-navy-muted">Only sent when the customer has said yes.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="report_cc_name" className="label">Their name</label>
            <input id="report_cc_name" name="report_cc_name" defaultValue={home?.report_cc_name ?? ''} className="input" />
          </div>
          <div>
            <label htmlFor="report_cc_email" className="label">Their email</label>
            <input id="report_cc_email" name="report_cc_email" type="email" inputMode="email" autoCapitalize="none" defaultValue={home?.report_cc_email ?? ''} className="input" />
          </div>
        </div>
        <label className="flex min-h-12 items-center gap-3">
          <input type="checkbox" name="report_cc_ok" defaultChecked={home?.report_cc_ok} className="size-5 accent-olive" />
          The customer agreed to send them a copy of each report
        </label>
      </fieldset>

      {state && !state.ok ? <p role="alert" className="rounded-xl bg-alert-tint px-3.5 py-3 font-semibold text-alert-ink">{state.error}</p> : null}
      <button type="submit" disabled={pending} className="btn btn-primary w-full">{pending ? 'Saving…' : home ? 'Save changes' : 'Add home'}</button>
    </form>
  );
}

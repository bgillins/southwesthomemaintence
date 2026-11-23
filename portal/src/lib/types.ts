// ------- Row shapes for the shm_portal schema -------
// Hand-written to match supabase/migrations. Update both together.

export type PlanTier = 'essentials' | 'plus' | 'premier';
export type StaffRole = 'owner' | 'tech';
export type HomeStatus = 'active' | 'paused' | 'cancelled';
export type VisitType = 'assessment' | 'maintenance';
export type VisitStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
export type ItemStatus = 'pending' | 'done' | 'attention' | 'na';

export interface Staff {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  role: StaffRole;
  active: boolean;
}

export interface Customer {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
}

export interface Shutoffs {
  main_water?: string;
  water_heater?: string;
  gas?: string;
  irrigation?: string;
  panel?: string;
}

export interface Home {
  id: string;
  customer_id: string;
  address: string;
  city: string;
  state: string;
  zip: string | null;
  plan: PlanTier;
  status: HomeStatus;
  member_since: string | null;
  features: string[];
  access_notes: string | null;
  shutoffs: Shutoffs;
  report_cc_name: string | null;
  report_cc_email: string | null;
  report_cc_ok: boolean;
}

export interface Equipment {
  id: string;
  home_id: string;
  kind: string;
  make: string | null;
  model: string | null;
  serial: string | null;
  install_year: number | null;
  location: string | null;
  notes: string | null;
}

export interface Supply {
  id: string;
  home_id: string;
  kind: string;
  spec: string;
  qty: number;
  location: string | null;
}

export interface HomeTask {
  id: string;
  home_id: string;
  title: string;
  status: 'open' | 'done';
  minutes: number | null;
  done_visit_id: string | null;
  done_at: string | null;
}

export interface Visit {
  id: string;
  home_id: string;
  tech_id: string | null;
  visit_type: VisitType;
  seq: number;
  plan: PlanTier;
  status: VisitStatus;
  scheduled_for: string;
  started_at: string | null;
  completed_at: string | null;
  summary: string | null;
  report_token: string;
  report_sent_at: string | null;
}

export interface VisitItem {
  id: string;
  visit_id: string;
  category_id: string;
  category_title: string;
  name: string;
  detail: string | null;
  kind: 'do' | 'check';
  minutes: number | null;
  sort: number;
  status: ItemStatus;
  note: string | null;
}

export interface VisitPhoto {
  id: string;
  visit_id: string;
  item_id: string | null;
  storage_path: string;
  caption: string | null;
  width: number | null;
  height: number | null;
  // Added on the server: a short-lived link to the private file.
  url?: string;
}

export interface Reading {
  id: string;
  visit_id: string;
  key: string;
  value: number;
}

export interface VisitSupply {
  id: string;
  visit_id: string;
  name: string;
  qty: number;
}

// A result every server action returns, so forms can show what went wrong.
export type ActionResult = { ok: true } | { ok: false; error: string };

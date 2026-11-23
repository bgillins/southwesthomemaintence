// ------- Turning the master checklist into one visit's checklist -------
// The website's checklist says how many times a year each plan gets each task.
// This file answers the tech's question: "what is due on THIS visit?"
import { checklist, FREQ, type ChecklistItem } from '@/data/checklist';
import { plans } from '@/data/plans';
import type { PlanTier, VisitType } from '@/lib/types';

export const TIER_INDEX: Record<PlanTier, number> = { essentials: 0, plus: 1, premier: 2 };
export const VISITS_PER_YEAR: Record<PlanTier, number> = { essentials: 4, plus: 6, premier: 12 };
export const VISIT_MINUTES: Record<PlanTier, number> = { essentials: 60, plus: 90, premier: 120 };
// Time set aside each visit for the customer's own list of small jobs.
export const TASK_MINUTES: Record<PlanTier, number> = { essentials: 0, plus: 30, premier: 60 };

export const PLAN_NAME: Record<PlanTier, string> = Object.fromEntries(
  plans.map((plan) => [plan.id, plan.name]),
) as Record<PlanTier, string>;

// ------- Home features -------
// Some tasks only make sense if the home has the equipment. Ticking these on the
// home's profile keeps pool checks off the list for a home with no pool.
export const FEATURES: { id: string; label: string }[] = [
  { id: 'softener', label: 'Water softener' },
  { id: 'ro', label: 'Drinking-water (RO) system' },
  { id: 'tankless', label: 'Tankless water heater' },
  { id: 'recirc', label: 'Hot water recirculation pump' },
  { id: 'irrigation', label: 'Irrigation system' },
  { id: 'pool', label: 'Pool or spa' },
  { id: 'solar', label: 'Solar panels' },
  { id: 'garage_fridge', label: 'Garage fridge or freezer' },
  { id: 'leak_sensors', label: 'Leak sensors' },
];

// Which feature a task needs, if any.
function neededFeature(categoryId: string, name: string): string | null {
  if (categoryId === 'irrigation') return 'irrigation';
  if (categoryId === 'pool-solar') return name.startsWith('Solar') ? 'solar' : 'pool';
  if (categoryId === 'water-treatment') return name.startsWith('Drinking-water') ? 'ro' : 'softener';
  if (name === 'Tankless units') return 'tankless';
  if (name === 'Hot water recirculation pump') return 'recirc';
  if (name === 'Garage refrigerator or freezer') return 'garage_fridge';
  if (name === 'Leak sensors') return 'leak_sensors';
  return null;
}

// ------- Is a task due on this visit? -------
// Example: a "twice a year" task on the 6-visit plan is due on 2 of the 6 visits.
// `offset` staggers tasks that share a frequency, so the once-a-year jobs are
// spread across the year instead of all landing on the same visit.
export function isDue(item: ChecklistItem, plan: PlanTier, seq: number, offset: number): boolean {
  const tier = TIER_INDEX[plan];
  const perYear = FREQ[item.tiers[tier]].perYear[tier];
  const visits = VISITS_PER_YEAR[plan];
  if (perYear <= 0) return false;
  if (perYear >= visits) return true;
  const position = seq + offset;
  return Math.floor((position * perYear) / visits) > Math.floor(((position - 1) * perYear) / visits);
}

export interface PlannedItem {
  category_id: string;
  category_title: string;
  name: string;
  detail: string | null;
  kind: 'do' | 'check';
  minutes: number | null;
  sort: number;
}

// ------- Build the checklist rows for a new visit -------
export function buildVisitItems(opts: {
  visitType: VisitType;
  plan: PlanTier;
  seq: number;
  features: string[];
}): PlannedItem[] {
  const rows: PlannedItem[] = [];
  let sort = 0;
  let stagger = 0;

  for (const category of checklist) {
    for (const item of category.items) {
      const isAssessmentItem = item.tiers[0] === 'once';
      stagger += 1;

      // The first visit is the Home Health Assessment: only the one-time items.
      if (opts.visitType === 'assessment') {
        if (!isAssessmentItem) continue;
      } else {
        if (isAssessmentItem) continue;
        const feature = neededFeature(category.id, item.name);
        if (feature && !opts.features.includes(feature)) continue;
        if (!isDue(item, opts.plan, opts.seq, stagger)) continue;
      }

      rows.push({
        category_id: category.id,
        category_title: category.title,
        name: item.name,
        detail: item.detail ?? null,
        kind: item.kind,
        minutes: item.minutes ?? null,
        sort: sort++,
      });
    }
  }
  return rows;
}

// ------- Readings a tech can record -------
export const READINGS: { key: string; label: string; unit: string; hint: string }[] = [
  { key: 'water_pressure', label: 'Water pressure', unit: 'psi', hint: 'Healthy: 40 to 80' },
  { key: 'hot_water_temp', label: 'Hot water at the tap', unit: '°F', hint: 'Target: about 120' },
  { key: 'hardness', label: 'Softened water hardness', unit: 'gpg', hint: 'Softened: 0 to 3' },
];

export const EQUIPMENT_KINDS = [
  'Water heater',
  'Furnace / air handler',
  'A/C condenser',
  'Thermostat',
  'Water softener',
  'Drinking-water system',
  'Refrigerator',
  'Dishwasher',
  'Range / oven',
  'Microwave',
  'Washer',
  'Dryer',
  'Garage door opener',
  'Irrigation controller',
  'Pool equipment',
  'Solar inverter',
  'Other',
];

export const SUPPLY_KINDS = ['Air filter', 'Light bulb', 'Battery', 'Water filter', 'Smoke / CO alarm', 'Other'];

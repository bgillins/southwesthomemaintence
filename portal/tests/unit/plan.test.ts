// ------- Does each plan get each task the promised number of times a year? -------
// This is the promise on the website's checklist page. If these fail, customers
// are getting more or less than they were sold.
import { describe, expect, it } from 'vitest';
import { checklist, FREQ } from '@/data/checklist';
import { buildVisitItems, FEATURES, isDue, TIER_INDEX, VISITS_PER_YEAR } from '@/lib/plan';
import type { PlanTier } from '@/lib/types';

const PLANS: PlanTier[] = ['essentials', 'plus', 'premier'];
const ALL_FEATURES = FEATURES.map((feature) => feature.id);

// One plan year of maintenance visits for a home.
const year = (plan: PlanTier, features: string[]) =>
  Array.from({ length: VISITS_PER_YEAR[plan] }, (_, index) => buildVisitItems({ visitType: 'maintenance', plan, seq: index + 1, features }));

describe('a full plan year', () => {
  for (const plan of PLANS) {
    it(`${plan}: every task happens exactly as often as the checklist promises`, () => {
      const visits = year(plan, ALL_FEATURES);
      const tier = TIER_INDEX[plan];
      for (const category of checklist) {
        for (const item of category.items) {
          const promised = Math.min(FREQ[item.tiers[tier]].perYear[tier], VISITS_PER_YEAR[plan]);
          const delivered = visits.filter((visit) => visit.some((row) => row.category_id === category.id && row.name === item.name)).length;
          expect(delivered, `${category.title} > ${item.name}`).toBe(promised);
        }
      }
    });

    it(`${plan}: once-a-year tasks are spread out, not piled onto one visit`, () => {
      const visits = year(plan, ALL_FEATURES);
      const tier = TIER_INDEX[plan];
      const yearly = new Set(checklist.flatMap((c) => c.items.filter((i) => FREQ[i.tiers[tier]].perYear[tier] === 1).map((i) => `${c.id}/${i.name}`)));
      const perVisit = visits.map((visit) => visit.filter((row) => yearly.has(`${row.category_id}/${row.name}`)).length);
      const average = yearly.size / VISITS_PER_YEAR[plan];
      // No visit carries more than double its fair share (plus a little slack).
      expect(Math.max(...perVisit)).toBeLessThanOrEqual(Math.ceil(average * 2) + 1);
    });
  }

  it('a higher plan never gets a task less often than a lower plan', () => {
    for (const category of checklist) {
      for (const item of category.items) {
        const perYear = PLANS.map((plan) => FREQ[item.tiers[TIER_INDEX[plan]]].perYear[TIER_INDEX[plan]]);
        expect(perYear[1], item.name).toBeGreaterThanOrEqual(perYear[0]);
        expect(perYear[2], item.name).toBeGreaterThanOrEqual(perYear[1]);
      }
    }
  });
});

describe('isDue', () => {
  const everyVisit = checklist.flatMap((c) => c.items).find((item) => item.tiers[0] === 'visit')!;
  const addOn = checklist.flatMap((c) => c.items).find((item) => item.tiers[0] === 'addon')!;

  it('every-visit tasks are due on every visit', () => {
    for (let seq = 1; seq <= 4; seq++) expect(isDue(everyVisit, 'essentials', seq, 0)).toBe(true);
  });

  it('add-ons are never put on a checklist for a plan that does not include them', () => {
    for (let seq = 1; seq <= 4; seq++) expect(isDue(addOn, 'essentials', seq, 0)).toBe(false);
  });

  it('the pattern repeats each plan year', () => {
    const item = checklist.flatMap((c) => c.items).find((i) => i.tiers[1] === 'x2')!;
    for (let seq = 1; seq <= 6; seq++) expect(isDue(item, 'plus', seq, 3)).toBe(isDue(item, 'plus', seq + 6, 3));
  });
});

describe('the first visit (Home Health Assessment)', () => {
  const assessment = buildVisitItems({ visitType: 'assessment', plan: 'plus', seq: 1, features: [] });
  const expected = checklist.find((category) => category.id === 'assessment')!.items.map((item) => item.name);

  it('has exactly the one-time assessment items', () => {
    expect(assessment.map((row) => row.name)).toEqual(expected);
  });

  it('assessment items never appear on a maintenance visit', () => {
    for (const plan of PLANS) for (const visit of year(plan, ALL_FEATURES)) expect(visit.some((row) => row.category_id === 'assessment')).toBe(false);
  });
});

describe('equipment the home does not have', () => {
  const bare = year('premier', []).flat();
  const full = year('premier', ALL_FEATURES).flat();

  it('no pool, solar, irrigation or softener tasks for a home without them', () => {
    expect(bare.some((row) => ['pool-solar', 'irrigation', 'water-treatment'].includes(row.category_id))).toBe(false);
    expect(bare.some((row) => ['Tankless units', 'Hot water recirculation pump', 'Leak sensors', 'Garage refrigerator or freezer'].includes(row.name))).toBe(false);
  });

  it('those tasks appear once the home has the equipment', () => {
    for (const categoryId of ['pool-solar', 'irrigation', 'water-treatment']) expect(full.some((row) => row.category_id === categoryId)).toBe(true);
  });

  it('each feature switches on only its own tasks', () => {
    const solarOnly = year('premier', ['solar']).flat().filter((row) => row.category_id === 'pool-solar');
    expect(solarOnly.length).toBeGreaterThan(0);
    expect(solarOnly.every((row) => row.name.startsWith('Solar'))).toBe(true);
  });
});

describe('the rows written for a visit', () => {
  const rows = buildVisitItems({ visitType: 'maintenance', plan: 'plus', seq: 2, features: ALL_FEATURES });

  it('are numbered in checklist order with no gaps', () => {
    expect(rows.map((row) => row.sort)).toEqual(rows.map((_, index) => index));
  });

  it('carry the kind and wording from the master checklist', () => {
    for (const row of rows) {
      const source = checklist.find((c) => c.id === row.category_id)!.items.find((i) => i.name === row.name)!;
      expect(row.kind).toBe(source.kind);
      expect(row.detail).toBe(source.detail ?? null);
      expect(row.category_title).toBe(checklist.find((c) => c.id === row.category_id)!.title);
    }
  });
});

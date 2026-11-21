// ------- Membership plans -------
// Prices and inclusions come from the business plan and are still estimates.
// Change them here and the homepage cards and the sign-up form update together.

export interface Plan {
  id: string;
  name: string;
  price: number; // dollars per month
  visits: string;
  length: string;
  summary: string;
  features: string[];
  featured?: boolean;
}

export const assessment = {
  name: 'Home Health Assessment',
  price: 149,
  minutes: 90,
};

export const plans: Plan[] = [
  {
    id: 'essentials',
    name: 'Essentials',
    price: 99,
    visits: '4 visits a year',
    length: '60 minutes each',
    summary: 'Quarterly upkeep that covers the basics.',
    features: [
      'Full maintenance checklist on every visit',
      'A seasonal check each visit',
      'Standard air filters, alarm batteries and up to 6 bulbs per visit included',
      'Photo report after every visit',
    ],
  },
  {
    id: 'plus',
    name: 'Plus',
    price: 149,
    visits: '6 visits a year',
    length: '90 minutes each',
    summary: 'More visits, plus time for the little things on your list.',
    featured: true,
    features: [
      'Everything in Essentials',
      '30 minutes each visit for small tasks around the house',
      'Refrigerator water filter twice a year',
    ],
  },
  {
    id: 'premier',
    name: 'Premier',
    price: 249,
    visits: '12 visits a year',
    length: '2 hours each',
    summary: 'A monthly visit, so nothing waits long.',
    features: [
      'Everything in Plus',
      '60 minutes each visit for small tasks around the house',
      'Alarms tested and filters checked every month',
      'Softener salt and drinking-water pre-filters included',
      'Dryer vent cleaning once a year (ground-level vents)',
      'Report copies sent to a family member, with your permission',
    ],
  },
];

// ------- The full maintenance checklist -------
// Every task we perform, grouped by area of the home, with how often each plan gets it.
// The checklist page (src/pages/checklist.astro) is built entirely from this file.
//
// Each item has:
//   kind    'do'    = we carry out the task
//           'check' = we look it over and report what we find
//   tiers   how often [Essentials, Plus, Premier] receive it (keys are defined in FREQ below)
//   minutes rough time per occurrence, from the research checklist. Not shown on the site;
//           used for planning whether a visit's work fits its time slot.
//
// NOT listed on purpose, until the Nevada State Contractors Board confirms them in writing:
//   water heater flushing, A/C condensate line flushing, condenser coil rinsing,
//   toilet flapper / fill valve / supply line swaps, relief-valve lift tests.

// ------- Frequency labels -------
export const FREQ = {
  visit: { label: 'Every visit', perYear: [4, 6, 12] },
  x4: { label: '4 times a year', perYear: [4, 4, 4] },
  x2: { label: 'Twice a year', perYear: [2, 2, 2] },
  x1: { label: 'Once a year', perYear: [1, 1, 1] },
  once: { label: 'At your assessment', perYear: [0, 0, 0] },
  addon: { label: 'Add-on', perYear: [0, 0, 0] },
  none: { label: 'Not included', perYear: [0, 0, 0] },
} as const;

export type Freq = keyof typeof FREQ;

export interface ChecklistItem {
  name: string;
  detail?: string;
  kind: 'do' | 'check';
  tiers: [Freq, Freq, Freq];
  minutes?: number;
}

export interface ChecklistCategory {
  id: string;
  title: string;
  intro?: string;
  items: ChecklistItem[];
}

// Shorthand for the common patterns
const EVERY: [Freq, Freq, Freq] = ['visit', 'visit', 'visit'];
const YEARLY: [Freq, Freq, Freq] = ['x1', 'x1', 'x1'];
const TWICE: [Freq, Freq, Freq] = ['x2', 'x2', 'x2'];
const ONCE: [Freq, Freq, Freq] = ['once', 'once', 'once'];
const STEPPED: [Freq, Freq, Freq] = ['x1', 'x2', 'x4']; // more often on the bigger plans
const MORE_ON_PLUS: [Freq, Freq, Freq] = ['x1', 'x2', 'x2'];
const MORE_ON_PREMIER: [Freq, Freq, Freq] = ['x1', 'x1', 'x2'];
const PREMIER_ONLY: [Freq, Freq, Freq] = ['addon', 'addon', 'x1'];

export const checklist: ChecklistCategory[] = [
  // ------- Home Health Assessment (first visit, every plan) -------
  {
    id: 'assessment',
    title: 'Home Health Assessment',
    intro: 'Done once, on your first visit, so every visit after it starts with the right parts and the right information.',
    items: [
      { name: 'Equipment record', detail: 'Make, model, serial number and age of the water heater, heating and cooling, softener, appliances, garage opener and irrigation controller.', kind: 'do', tiers: ONCE, minutes: 25 },
      { name: 'Supplies list', detail: 'Filter sizes, bulb types, battery types and alarm dates, so we arrive with what your home uses.', kind: 'do', tiers: ONCE, minutes: 10 },
      { name: 'Shutoffs found and tagged', detail: 'Main water, water heater, gas meter, irrigation and the electrical panel.', kind: 'do', tiers: ONCE, minutes: 10 },
      { name: 'Starting measurements', detail: 'Water pressure, softened-water hardness and hot water temperature.', kind: 'do', tiers: ONCE, minutes: 10 },
      { name: 'Floor plan and room photos', detail: 'A dated record of the home as it is today.', kind: 'do', tiers: ONCE, minutes: 25 },
      { name: 'House numbers visible from the street', detail: 'So emergency responders can find the home quickly.', kind: 'check', tiers: ONCE, minutes: 2 },
      { name: 'Emergency information sheet', detail: 'Shutoff locations and the contacts you choose, kept with your home profile.', kind: 'do', tiers: ONCE },
    ],
  },

  // ------- Heating, cooling and air -------
  {
    id: 'hvac',
    title: 'Heating, cooling and air',
    items: [
      { name: 'Air filters replaced', detail: 'Size and date logged each time.', kind: 'do', tiers: EVERY, minutes: 5 },
      { name: 'Thermostat batteries and settings', detail: 'Fresh batteries, schedule and summer setpoint checked.', kind: 'do', tiers: MORE_ON_PREMIER, minutes: 3 },
      { name: 'Vents and return grilles', detail: 'Vacuumed and wiped, with an airflow check.', kind: 'do', tiers: STEPPED, minutes: 5 },
      { name: 'Outdoor A/C unit kept clear', detail: 'Debris and weeds removed, about two feet of clearance, fins and pad looked over.', kind: 'do', tiers: STEPPED, minutes: 5 },
      { name: 'A/C drain pan and drain line', detail: 'Looked over for standing water, algae and ceiling stains.', kind: 'check', tiers: STEPPED, minutes: 3 },
      { name: 'Refrigerant line insulation', detail: 'Sun-rotted foam noted before it costs you efficiency.', kind: 'check', tiers: YEARLY, minutes: 2 },
      { name: 'Furnace or heat pump before winter', detail: 'A look and listen for odd smells, noises and vent problems.', kind: 'check', tiers: YEARLY, minutes: 3 },
      { name: 'Air purifier, humidifier or UV light', detail: 'Replacement dates checked on any add-on air equipment.', kind: 'check', tiers: YEARLY, minutes: 3 },
    ],
  },

  // ------- Water heater -------
  {
    id: 'water-heater',
    title: 'Water heater',
    items: [
      { name: 'Tank, fittings and drain pan', detail: 'Leaks, rust, water in the pan and loose straps.', kind: 'check', tiers: EVERY, minutes: 3 },
      { name: 'Hot water temperature', detail: 'Measured at the tap. About 120°F guards against scalds and wasted energy.', kind: 'do', tiers: YEARLY, minutes: 3 },
      { name: 'Relief valve and discharge pipe', detail: 'Looked over for weeping and safe routing.', kind: 'check', tiers: YEARLY, minutes: 2 },
      { name: 'Age and replacement planning', detail: 'Older tanks are flagged early so replacement is a plan, not an emergency.', kind: 'check', tiers: YEARLY, minutes: 2 },
      { name: 'Tankless units', detail: 'Error codes, inlet screen and the date descaling is due.', kind: 'check', tiers: YEARLY, minutes: 3 },
      { name: 'Hot water recirculation pump', detail: 'Timer and operation.', kind: 'check', tiers: YEARLY, minutes: 3 },
    ],
  },

  // ------- Plumbing -------
  {
    id: 'plumbing',
    title: 'Plumbing',
    items: [
      { name: 'Under every sink', detail: 'Flashlight and moisture-meter check of supply lines and drain traps.', kind: 'check', tiers: EVERY, minutes: 7 },
      { name: 'Toilets', detail: 'Running, silent leaks (dye test), wobble and the seal at the base.', kind: 'check', tiers: EVERY, minutes: 5 },
      { name: 'Leak sensors', detail: 'Batteries and a test, if your home has them.', kind: 'do', tiers: EVERY, minutes: 2 },
      { name: 'Water pressure test', detail: 'Gauge reading at a hose bib. High pressure wears out fixtures and water heaters.', kind: 'do', tiers: YEARLY, minutes: 5 },
      { name: 'Supply lines', detail: 'Age, bulges and corrosion on the braided lines to sinks and toilets.', kind: 'check', tiers: YEARLY },
      { name: 'Faucet aerators and showerheads', detail: 'Hard-water scale removed to restore flow.', kind: 'do', tiers: STEPPED, minutes: 10 },
      { name: 'Drains', detail: 'Flow tested, stoppers and hair catchers cleaned.', kind: 'do', tiers: STEPPED, minutes: 5 },
      { name: 'Outdoor faucets', detail: 'Drips and backflow caps checked. Freeze covers on in winter, off in spring.', kind: 'do', tiers: TWICE, minutes: 3 },
      { name: 'Refrigerator and ice-maker water line', detail: 'Looked over behind the fridge where it can be reached.', kind: 'check', tiers: YEARLY, minutes: 3 },
    ],
  },

  // ------- Water softener and drinking water -------
  {
    id: 'water-treatment',
    title: 'Water softener and drinking water',
    items: [
      { name: 'Softener salt topped off', detail: 'Salt bridges broken up. Salt is included with Premier.', kind: 'do', tiers: EVERY, minutes: 5 },
      { name: 'Softener setting and clock', detail: "Set to the local water utility's hardness figure and reset after outages.", kind: 'do', tiers: EVERY, minutes: 2 },
      { name: 'Softened water test', detail: 'A test strip confirms the softener is doing its job.', kind: 'do', tiers: MORE_ON_PLUS, minutes: 3 },
      { name: 'Drinking-water filter cartridges', detail: 'Reverse-osmosis filters replaced on schedule. Pre-filters are included with Premier.', kind: 'do', tiers: MORE_ON_PREMIER, minutes: 15 },
      { name: 'Drinking-water tank and lines', detail: 'Leak check under the sink.', kind: 'check', tiers: YEARLY, minutes: 3 },
      { name: 'Softener tank clean-out', detail: 'Brine tank cleaned and resin cleaner added.', kind: 'do', tiers: PREMIER_ONLY, minutes: 25 },
    ],
  },

  // ------- Kitchen -------
  {
    id: 'kitchen',
    title: 'Kitchen appliances',
    items: [
      { name: 'Refrigerator coils', detail: 'Vacuumed so the compressor is not working overtime.', kind: 'do', tiers: MORE_ON_PREMIER, minutes: 10 },
      { name: 'Refrigerator water filter', detail: 'Replaced. The filter itself is included with Plus and Premier.', kind: 'do', tiers: MORE_ON_PLUS, minutes: 5 },
      { name: 'Refrigerator door seals and temperatures', kind: 'check', tiers: YEARLY, minutes: 3 },
      { name: 'Garage refrigerator or freezer', detail: 'Checked before summer, when garage heat is hardest on it.', kind: 'check', tiers: YEARLY, minutes: 2 },
      { name: 'Dishwasher', detail: 'Filter and spray arms cleaned, door gasket and connection looked over.', kind: 'do', tiers: STEPPED, minutes: 10 },
      { name: 'Garbage disposal', detail: 'Run test, splash guard and a leak check underneath.', kind: 'check', tiers: STEPPED, minutes: 3 },
      { name: 'Range hood filters', detail: 'Degreased or replaced.', kind: 'do', tiers: STEPPED, minutes: 10 },
      { name: 'Microwave filters', detail: 'Grease filter cleaned, charcoal filter date checked.', kind: 'do', tiers: MORE_ON_PREMIER, minutes: 5 },
      { name: 'Range and oven', detail: 'Burners and igniters looked over, anti-tip bracket confirmed, oven light working.', kind: 'check', tiers: YEARLY, minutes: 5 },
    ],
  },

  // ------- Laundry and dryer vent -------
  {
    id: 'laundry',
    title: 'Laundry and dryer vent',
    items: [
      { name: 'Dryer lint path', detail: 'Lint-screen slot vacuumed, duct behind the dryer and outside flap checked.', kind: 'do', tiers: EVERY, minutes: 5 },
      { name: 'Washer hoses', detail: 'Bulges and age. A burst hose is the most common laundry-room flood.', kind: 'check', tiers: YEARLY, minutes: 3 },
      { name: 'Washer pan, drain and leveling', kind: 'check', tiers: YEARLY, minutes: 2 },
      { name: 'Full dryer vent cleaning', detail: 'The whole run brushed out, for vents that end at ground level.', kind: 'do', tiers: PREMIER_ONLY, minutes: 45 },
    ],
  },

  // ------- Electrical and alarms -------
  {
    id: 'electrical',
    title: 'Electrical and alarms',
    items: [
      { name: 'Smoke alarms tested', kind: 'do', tiers: EVERY, minutes: 5 },
      { name: 'Carbon monoxide alarms tested', kind: 'do', tiers: EVERY, minutes: 3 },
      { name: 'Safety outlets tested', detail: 'The test and reset buttons on kitchen, bath, garage and outdoor outlets.', kind: 'do', tiers: EVERY, minutes: 3 },
      { name: 'Light bulbs replaced', detail: 'Up to six standard bulbs per visit are included.', kind: 'do', tiers: EVERY, minutes: 5 },
      { name: 'Fire extinguishers', detail: 'Gauge, pin and date.', kind: 'check', tiers: EVERY, minutes: 2 },
      { name: 'Warm outlets, flickering and tripping breakers', detail: 'Anything you or we notice is written up for an electrician.', kind: 'check', tiers: EVERY },
      { name: 'Alarm batteries and age', detail: 'Replaceable batteries changed and manufacture dates logged. Alarms wear out after about ten years.', kind: 'do', tiers: YEARLY, minutes: 8 },
      { name: 'Outdoor lights and timers', detail: 'Timers and light sensors adjusted as the days change.', kind: 'do', tiers: TWICE, minutes: 5 },
      { name: 'Ceiling fans', detail: 'Direction for the season, wobble and dust.', kind: 'do', tiers: MORE_ON_PLUS, minutes: 5 },
      { name: 'Electrical panel, from the outside', detail: 'Rust, scorch marks, labels and recalled brands. We never open the panel.', kind: 'check', tiers: YEARLY, minutes: 3 },
      { name: 'Arc-fault breaker test', detail: 'You press the test buttons with us there.', kind: 'check', tiers: YEARLY, minutes: 2 },
    ],
  },

  // ------- Doors, windows and seals -------
  {
    id: 'seals',
    title: 'Doors, windows and seals',
    items: [
      { name: 'Door weatherstripping and sweeps', detail: 'Checked for daylight gaps and sun-cracked seals that let out cool air.', kind: 'check', tiers: YEARLY, minutes: 10 },
      { name: 'Locks and deadbolts', detail: 'Lubricated and tightened, with long screws in the strike plates.', kind: 'do', tiers: YEARLY, minutes: 10 },
      { name: 'Sliding doors', detail: 'Tracks cleaned and rollers adjusted.', kind: 'do', tiers: MORE_ON_PLUS, minutes: 10 },
      { name: 'Windows', detail: 'Operation, locks, sun-baked seals and fogged glass.', kind: 'check', tiers: YEARLY, minutes: 10 },
      { name: 'Window screens and sunscreens', kind: 'check', tiers: YEARLY, minutes: 5 },
      { name: 'Openings in outside walls', detail: 'Gaps sealed around outdoor faucets, A/C lines, cables and the dryer hood.', kind: 'do', tiers: YEARLY, minutes: 5 },
      { name: 'Pest entry points', detail: 'Small gaps sealed at door sweeps, weep holes and vents.', kind: 'do', tiers: YEARLY, minutes: 10 },
      { name: 'Signs of pests', detail: 'Droppings, termite tubes and scorpion sightings are written up.', kind: 'check', tiers: EVERY },
    ],
  },

  // ------- Bathrooms and surfaces -------
  {
    id: 'surfaces',
    title: 'Bathrooms and surfaces',
    items: [
      { name: 'Walls and ceilings', detail: 'Scanned for new cracks and water stains on every walk-through.', kind: 'check', tiers: EVERY },
      { name: 'Tub and shower caulk', detail: 'Gaps that let water behind the tile.', kind: 'check', tiers: YEARLY, minutes: 5 },
      { name: 'Grout', detail: 'Cracks and when sealing is due.', kind: 'check', tiers: YEARLY, minutes: 5 },
      { name: 'Stone countertops', detail: 'Water-drop test of the seal, plus a log of etching and chips.', kind: 'do', tiers: YEARLY, minutes: 5 },
      { name: 'Glass shower doors', detail: 'Hard-water film caught before it etches the glass.', kind: 'check', tiers: STEPPED, minutes: 5 },
      { name: 'Bathroom exhaust fans', detail: 'Grille cleaned and suction tested.', kind: 'do', tiers: MORE_ON_PLUS, minutes: 5 },
      { name: 'Flooring', detail: 'Raised edges, loose tile and carpet ripples.', kind: 'check', tiers: YEARLY, minutes: 10 },
    ],
  },

  // ------- Garage and attic -------
  {
    id: 'garage',
    title: 'Garage and attic',
    items: [
      { name: 'Garage door safety reverse', detail: 'Auto-reverse and the photo-eye sensors tested.', kind: 'do', tiers: EVERY, minutes: 3 },
      { name: 'Garage door hardware', detail: 'Rollers, hinges and bearings lubricated.', kind: 'do', tiers: MORE_ON_PLUS, minutes: 10 },
      { name: 'Garage door bottom seal', detail: 'Sun cracking that lets in heat and pests.', kind: 'check', tiers: YEARLY, minutes: 3 },
      { name: 'Opener backup battery', detail: 'Tested so the car is not trapped in a power outage.', kind: 'do', tiers: YEARLY, minutes: 3 },
      { name: 'Door from garage to house', detail: 'Closes and latches by itself.', kind: 'check', tiers: YEARLY, minutes: 2 },
      { name: 'Attic, from the hatch', detail: 'Insulation gaps, loose ducts, water stains and pests. Cool months only.', kind: 'check', tiers: YEARLY, minutes: 10 },
    ],
  },

  // ------- Roof and exterior -------
  {
    id: 'exterior',
    title: 'Roof and exterior',
    intro: 'All from the ground. We never walk on a roof.',
    items: [
      { name: 'Roof', detail: 'Slipped or cracked tiles and flat-roof ponding, by eye and binoculars.', kind: 'check', tiers: TWICE, minutes: 10 },
      { name: 'Gutters, scuppers and downspouts', detail: 'Blockages spotted before monsoon rain.', kind: 'check', tiers: MORE_ON_PLUS, minutes: 10 },
      { name: 'Stucco', detail: 'Cracks, white mineral deposits and sprinkler overspray.', kind: 'check', tiers: YEARLY, minutes: 10 },
      { name: 'Exterior paint', detail: 'Chalking and peeling from desert sun.', kind: 'check', tiers: YEARLY },
      { name: 'Wood trim, fences and gates', detail: 'Rot, termite tubes and gate latches.', kind: 'check', tiers: YEARLY, minutes: 5 },
      { name: 'Drainage around the house', detail: 'Soil sloping away from the slab, checked again after monsoon storms.', kind: 'check', tiers: YEARLY, minutes: 5 },
    ],
  },

  // ------- Irrigation and landscape -------
  {
    id: 'irrigation',
    title: 'Irrigation and landscape',
    items: [
      { name: 'Irrigation controller', detail: 'Set to the seasonal watering schedule, with a fresh backup battery.', kind: 'do', tiers: ['x4', 'x4', 'x4'], minutes: 5 },
      { name: 'Each watering zone run and walked', detail: 'Broken drip emitters and sprinkler heads found and swapped.', kind: 'do', tiers: MORE_ON_PLUS, minutes: 15 },
      { name: 'Valves and backflow device', detail: 'Looked over for leaks. Insulated before freezes and uncovered in spring.', kind: 'check', tiers: TWICE, minutes: 5 },
    ],
  },

  // ------- Pool, spa and solar -------
  {
    id: 'pool-solar',
    title: 'Pool, spa and solar',
    intro: 'A look only, for homes that have them.',
    items: [
      { name: 'Pool equipment', detail: 'Leaks, noises and the time clock.', kind: 'check', tiers: STEPPED, minutes: 5 },
      { name: 'Pool gate and barriers', detail: 'Gate closes and latches by itself, door alarms work.', kind: 'check', tiers: STEPPED, minutes: 3 },
      { name: 'Solar inverter', detail: 'Error lights, and production compared with last year.', kind: 'check', tiers: STEPPED, minutes: 3 },
      { name: 'Solar panels, from the ground', detail: 'Dirt build-up and pigeons nesting underneath.', kind: 'check', tiers: TWICE, minutes: 3 },
    ],
  },

  // ------- Safety at home -------
  {
    id: 'safety',
    title: 'Safety at home',
    items: [
      { name: 'Trip hazards', detail: 'Rugs, cords and thresholds noted on every walk-through.', kind: 'check', tiers: EVERY },
      { name: 'Grab bars', detail: 'Pull tested, with suggestions on where more would help.', kind: 'do', tiers: YEARLY, minutes: 5 },
      { name: 'Handrails', detail: 'Tug tested and tightened.', kind: 'do', tiers: YEARLY, minutes: 5 },
      { name: 'Night lighting', detail: 'Night-lights along the path from bed to bathroom.', kind: 'do', tiers: YEARLY, minutes: 5 },
    ],
  },
];

// ------- Things that come with the visit itself -------
export const visitExtras: { name: string; tiers: [string, string, string] }[] = [
  { name: 'Photo report after each visit', tiers: ['Every visit', 'Every visit', 'Every visit'] },
  { name: 'Time for small tasks on your list', tiers: ['At member rate', '30 minutes a visit', '60 minutes a visit'] },
  { name: 'Report copies for a family member', tiers: ['On request', 'On request', 'Included'] },
];

// ------- Work we leave to licensed professionals -------
export const referred: string[] = [
  'A/C tune-ups, refrigerant and repairs',
  'Replacing outlets, switches, light fixtures or thermostats',
  'Plumbing repairs and pipe, valve or water heater replacement',
  'Anything on a gas line or gas appliance',
  'Garage door springs and cables',
  'Roof repairs, and any work that means walking on the roof',
  'Backflow device testing and irrigation valve repair',
  'Pool chemicals and pool equipment repair',
  'Pest treatment',
];

// ------- Totals used on the page -------
export const allItems = checklist.flatMap((category) => category.items);
export const totalItems = allItems.length;

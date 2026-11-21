// ------- Site-wide settings -------
// One place for the facts that appear on every page.
// PLACEHOLDER values must be replaced before the site goes live.

export const site = {
  name: 'Southwest Home Maintenance',
  tagline: 'One less thing to worry about.',
  description:
    'Home maintenance plans for the Las Vegas Valley. We visit on a regular schedule and handle the small upkeep: air filters, light bulbs, alarm batteries, leak checks and more.',

  // ------- Contact (PLACEHOLDER: 555 numbers are not real) -------
  phoneDisplay: '(702) 555-0100',
  phoneHref: 'tel:+17025550100',

  // ------- Service area -------
  areas: ['Las Vegas', 'Henderson', 'Summerlin'],
  region: 'the Las Vegas Valley',

  // ------- Sign-up form -------
  // URL that receives form submissions (Formspree, Basin, a serverless function, etc.).
  // While this is empty the form does not send anything and tells the visitor to call.
  formEndpoint: '',
};

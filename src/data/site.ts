// ------- Site-wide settings -------
// One place for the facts that appear on every page.
// PLACEHOLDER values must be replaced before the site goes live.

export const site = {
  name: 'Southwest Home Maintenance',

  // ------- Search focus -------
  // The whole site is built around one phrase. It leads the page title, the meta
  // description and the homepage H1, so keep these three in step if it ever changes.
  keyword: 'Home maintenance made easy',
  tagline: 'Home maintenance made easy.',
  promise: 'One less thing to worry about.',
  title: 'Home Maintenance Made Easy in Las Vegas | Southwest Home Maintenance',
  description:
    'Home maintenance made easy for Las Vegas, Henderson and Summerlin. We visit on a schedule and handle air filters, light bulbs, alarm batteries and leak checks.',

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

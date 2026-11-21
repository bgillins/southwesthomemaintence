# Southwest Home Maintenance website

Marketing site for Southwest Home Maintenance, built with [Astro](https://astro.build).
It builds to plain static HTML, so it can be hosted anywhere.

## Run it

```bash
npm install
```

```bash
npm run dev
```

Then open http://localhost:4321. `npm run build` writes the finished site to `dist/`.

## Where things live

| To change | Edit |
| --- | --- |
| Phone number, service area, form endpoint | `src/data/site.ts` |
| Plan names, prices and what each includes | `src/data/plans.ts` |
| Brand colors, fonts, buttons | `src/styles/global.css` |
| A homepage section | the matching file in `src/components/` |
| Section order | `src/pages/index.astro` |

## Before launch

- Replace the placeholder phone number in `src/data/site.ts`.
- Set `formEndpoint` in `src/data/site.ts`. Until then the sign-up form sends nothing and asks visitors to call.
- Set `site` in `astro.config.mjs` to the live domain.

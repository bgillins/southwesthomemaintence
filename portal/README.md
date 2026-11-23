# Southwest Home Maintenance portal

The staff app behind the membership: schedule visits, work the checklist on a phone,
take photos, and send the customer a photo report. It lives beside the marketing site
but is its own app, deployed separately.

Built with Next.js, Supabase (database, sign-in, photo storage) and Resend (email).

## What it does

| Screen | Who uses it | What for |
| --- | --- | --- |
| Today | Techs | Today's visits, anything left unfinished, the next 7 days |
| Visit | Techs | Start the visit, answer each checklist item, add notes and photos, record readings and parts, finish |
| Homes | Everyone | Customer, plan, access notes, equipment record, supplies to bring, shutoffs, their to-do list |
| Schedule | Office | Upcoming and overdue visits, book a new one |
| Team | Owners | Add or switch off staff |
| `/r/<token>` | Customers | The photo report. No login; the link is the key |

How a visit's checklist is built: the website's `src/data/checklist.ts` says how many
times a year each plan gets each task. When a visit is scheduled, `src/lib/plan.ts`
picks the tasks due on that visit, skips equipment the home does not have, and copies
them onto the visit. Editing the master list later never changes a past report.

## Run it

```bash
npm install
```

```bash
cp .env.example .env.local   # then fill in the values
```

```bash
npm run dev
```

Open http://localhost:3000. Without a Resend key, sign-in codes and report emails are
printed in the terminal instead of sent, so you can test without sending anything.

## Where things live

| To change | Edit |
| --- | --- |
| Checklist items, plans, prices | `../src/data/` in the website (copied in automatically) |
| Which tasks land on which visit | `src/lib/plan.ts` |
| Email wording | `src/lib/email.ts` |
| Tests | `tests/` (see Testing below) |
| The tech's visit screen | `src/app/(app)/visits/[id]/VisitRunner.tsx` |
| The customer report | `src/app/r/[token]/page.tsx` |
| Colors and buttons | `src/app/globals.css` |
| Database tables and access rules | `supabase/migrations/` |

## Database

Uses the shared Supabase project `supabase-bistre-zebra`, kept apart from the other
apps on it:

- All tables are in the `shm_portal` schema.
- Photos are in the private `shm-visit-photos` bucket.
- Every table has row-level security that checks the person is in `shm_portal.staff`.
  Being logged in to another app on the same project gives no access here.

All migrations in `supabase/migrations/` are already applied. To change the schema,
add a new numbered file there, run it in the Supabase SQL editor, then run
`npm run test:db:reset` so the test copy matches.

## Testing

One command checks everything:

```bash
npm run verify
```

It runs three layers, fastest first:

| Layer | Command | What it proves |
| --- | --- | --- |
| Types | `npm run typecheck` | The code is consistent with itself |
| Logic (40 tests, 2 seconds) | `npm test` | Each plan gets each task the promised number of times a year; Las Vegas time is right across daylight saving; emails are worded and escaped correctly |
| Whole app (84 tests, 3 minutes) | `npm run test:e2e` | A real browser, sized like an iPhone, drives a production build through every flow, and each step is checked against what was actually saved in the database |

How the whole-app tests stay safe:

- **They never touch live data.** They run against a second schema, `shm_portal_test`,
  and a second photo bucket, built from the same migration files. The app is pointed
  there by two environment variables that are only set during tests.
- **They never send real email.** A small stand-in for Resend (`tests/support/fake-resend.mjs`)
  receives what the app sends, and the tests read the "inbox" to get sign-in codes and
  check the report email.
- **They clean up.** Every test login is `shm-e2e-...@example.com` and is deleted at the
  end, along with every row and photo in the test copy.

What is covered (`tests/e2e/`):

| File | Covers |
| --- | --- |
| `01-auth` | Sign-in by code and by link, wrong and reused codes, strangers get no email, rate limit, security headers |
| `02-team` | Adding staff, techs kept out of owner pages, switching access off takes effect at once |
| `03-homes` | Adding, finding and editing homes; equipment, supplies, to-do list; server-side validation |
| `04-visit` | The full visit: right checklist for the plan, locked until started, photos shrunk and stored, finish rules, report email, failures, lost signal |
| `05-report` | The customer report with no login; wrong links; no other customer's data; no code injection |
| `06-schedule` | Today and Schedule show the right visits to the right person at Las Vegas times |
| `07-access` | The database itself refuses strangers, non-team logins and switched-off staff, with the pages bypassed |
| `08-phone` | No sideways scrolling, thumb-sized buttons, camera opens, installs to the home screen |

Two more commands, which need a Supabase access token in `SUPABASE_ACCESS_TOKEN`:

- `npm run test:db:reset` rebuilds the test copy from the migration files. This is
  also the test of the migrations: if the SQL cannot build a database from nothing,
  it fails here.
- `npm run test:db:check` compares the live schema with the test copy, column by
  column and rule by rule. It answers "does the live database still match the repo?"

When a test fails, `tests/.report/index.html` has a screenshot and a step-by-step
replay of what the browser did.

### Walkthrough video

```bash
npm run demo:video
```

Drives the app through a scripted visit (office, tech, customer), records the screen,
and writes a captioned mp4 to `tests/demo/out/`. Needs `ffmpeg`.

## Going live on Vercel

1. New Vercel project from this repo, with **Root Directory** set to `portal`.
2. Storage tab: connect `supabase-bistre-zebra` to the project. That fills in the
   three Supabase variables.
3. Add `RESEND_API_KEY`, `EMAIL_FROM` (an address on a domain verified in Resend),
   `EMAIL_REPLY_TO` (where customer replies should land) and `PORTAL_OWNER_EMAILS`.
   `APP_URL` is only needed if the portal's address is not the one Vercel assigns.
4. Deploy, then sign in with an owner email. Add the techs on the Team page.

On a phone, open the portal and choose "Add to Home Screen" to use it like an app.

## Not built yet

- Working with no signal. A save that fails is undone and says so, but the app needs
  a connection.
- Billing and payments.
- A customer login. Customers get report links by email.
- Seasonal timing. Once-a-year tasks are spread evenly over the year, not pinned to
  a season (for example, the furnace check before winter).
- Text message reminders.

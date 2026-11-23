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

Both migrations in `supabase/migrations/` are already applied. To change the schema,
add a new numbered file there and run it in the Supabase SQL editor.

## Going live on Vercel

1. New Vercel project from this repo, with **Root Directory** set to `portal`.
2. Storage tab: connect `supabase-bistre-zebra` to the project. That fills in the
   three Supabase variables.
3. Add `RESEND_API_KEY`, `EMAIL_FROM` (an address on a domain verified in Resend),
   `APP_URL` (the portal's public address) and `PORTAL_OWNER_EMAILS`.
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

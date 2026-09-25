# Footnote for IES · v2 prototype

Agents do the work. Every decision has a trail.

A working prototype for the Intuit PM case, built inside an Intuit Enterprise Suite frame. It covers three connected experiences:

- **Controller (Priya):** gives a close agent a bounded goal. The agent investigates, acts on its own only where her policies allow, asks a person only when the evidence runs out, and brings her the decisions.
- **Expert (Elena):** gets a scoped case. She can ask for information, change the draft treatment, and return a recommendation. Priya approves and IES posts.
- **Developer (Ravi, SiteLog):** finds demand, builds a specialist agent, passes the Proving Ground (24 real test cases), clears a separate security review, publishes, and earns per accepted result.

**Live:** https://intuit-enterprise-prototype.vercel.app

All demo accounts use the password `demo1234`, and the sign-in page has one-click people. **Footnote demo** (top bar, every screen, and on the sign-in page) starts a guided walkthrough for either primary user: a callout appears next to what's happening, in plain words, with **Next** and **Cancel**. Each demo starts from a fresh copy of the data. Every visitor gets their own private copy, so reviewers never see each other's progress.

In the IES menu, only **Close workspace** and **Reports** are part of the prototype; they're shown at full strength with a small dot, and the rest of IES is shown softer.

## Run it locally

```bash
npm install
npx vercel env pull .env.local   # Supabase connection settings from the Vercel project
npm run dev                      # http://localhost:3100
```

## How it's deployed

- **Vercel** hosts the Next.js app (functions pinned to `iad1`, see `vercel.json`).
- **Supabase Postgres** (us-east-1, added through Vercel's Supabase integration) stores the data. The app connects through the transaction pooler (`POSTGRES_URL`).
- Each visitor gets a Postgres schema `ws_<id>` (from the `fn_ws` cookie set in `src/middleware.ts`), created and seeded on first request. Requests run in one transaction scoped to that schema. **Reset demo data** drops it and starts a new one; copies older than 14 days are removed automatically.
- The per-visitor schemas aren't exposed through Supabase's public Data API, and the registry table has row-level security on, so only the app can read the data.
- Receipts and the contract are generated on request (`src/lib/files.ts`); nothing is written to disk.

Deploy a new version with `npx vercel deploy --prod`.

## The guided demos

| Priya, controller (11 steps) | Ravi, developer (7 steps) |
| --- | --- |
| Gives Footnote one goal; it checks the books and connected apps and attaches 7 receipts on its own | Finds 1,241 open "labor doesn't match the site" issues on the demand board |
| The $8,400 Home Depot purchase has no job, so Luis gets one text; his answer applies under the $10,000 rule | Builds SiteLog CostCheck from a template: what it reads, its price |
| Labor lives in SiteLog, so CostCheck is recommended; she installs it and approves its $38,400 fix | The Proving Ground fails 2 of 24 cases; he turns on "skip unapproved timesheets" and passes |
| The revenue judgment call goes to Elena, her accountant, who sees only that case and recommends cost-to-cost | Publishes after Intuit's security review |
| Priya approves; readiness says "Yes, ready"; the report shows each margin before, after and why | Priya installs it from her labor issue and approves its fix; Ravi earns $4.80 of the $6 |

Steps are defined in `src/components/tour/steps.ts`; each points at an element marked `data-tour="…"`. `/api/demo/tour` sets up the fresh copy and plays Luis and Elena when they aren't on screen.

Expected result: Oak Ave 40.7% → 27.9%, Elm St 9.7% → 19.1%, Lincoln 39.5% → 24.7%, Riverside unchanged, company direct labor unchanged at $285,000.

## What's real and what's simulated

Real: the database, policy engine, the agent's checks, CostCheck's logic (the same code runs in the Proving Ground and on the company's data), approvals, journal entries and the report.

Simulated and labeled: text messages (a demo phone), SiteLog's data, the security review, payouts, and the cross-company counts on the demand board.

### Optional: live AI text

Without a key, the text to Luis, the expert case summary and the CFO note come from templates built from the same evidence. To have Claude write them, create `.env.local` with:

```
ANTHROPIC_API_KEY=sk-ant-...
```

Calls use `claude-opus-5` with server-side fallbacks enabled, and fall back to the templates if a call fails.

## Stack

Next.js 15 (App Router) · Tailwind v4 · Supabase Postgres (postgres.js) · cookie sessions (scrypt-hashed passwords) · Anthropic TypeScript SDK. The app's clock is fixed to Oct 1, 2026 (day 1 of the September close), and dates show in Pacific time.

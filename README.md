# Footnote for IES · v2 prototype

Agents do the work. Every decision has a trail.

A working prototype for the Intuit PM case, built inside an Intuit Enterprise Suite frame. It covers three connected experiences:

- **Controller (Priya):** gives a close agent a bounded goal. The agent investigates, acts on its own only where her policies allow, asks a person only when the evidence runs out, and brings her the decisions.
- **Expert (Elena):** gets a scoped case. She can ask for information, change the draft treatment, and return a recommendation. Priya approves and IES posts.
- **Developer (Ravi, SiteLog):** finds demand, builds a specialist agent, passes the Proving Ground (24 real test cases), clears a separate security review, publishes, and earns per accepted result.

## Run it

```bash
npm install
npm run dev        # http://localhost:3100
```

The SQLite database (`data/footnote-v2.db`) is created and seeded on first run. All demo accounts use the password `demo1234`, and the sign-in page has one-click people. **Demo guide** (top bar, every screen) jumps to each step and can reset the data.

## The 12-minute story

| Minutes | Who | What happens |
| --- | --- | --- |
| 0–2 | Priya | Starts the September project-cost review; the investigation runs; 7 receipts are attached by policy |
| 2–4 | Luis (phone) | Answers “which job?” for Home Depot $8,400; the tag is applied under the $10,000 policy |
| 4–6 | Ravi | Builds SiteLog CostCheck; the Proving Ground fails 2 missing-data cases; he turns on abstention; 24/24; review; publish |
| 6–8 | Priya | Installs CostCheck (Builders only, suggest-only); approves its $38,400 labor reclass |
| 8–10 | Priya → Elena → Maya | Lincoln goes to Elena; she asks Maya to confirm the estimate, then changes the treatment to cost-to-cost |
| 10–12 | Priya | Approves Elena's recommendation; the margins report shows before, after, why, and what's still open |

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

Next.js 15 (App Router) · Tailwind v4 · better-sqlite3 · cookie sessions (scrypt-hashed passwords) · Anthropic TypeScript SDK. The app's clock is fixed to Oct 1, 2026 (day 1 of the September close), and dates show in Pacific time.

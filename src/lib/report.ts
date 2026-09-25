import { all, one } from "./db";
import { explainMargins } from "./ai";
import { money } from "./format";
import { lookups, projectMargins, readiness, RESOLVED, type ActivityRow, type IssueRow, type Margins, type Proposal, type Txn } from "./model";

export type Reason = { projectId: string; text: string; delta: number; who: string; issueId: string };

function pct(n: number | null) {
  return n === null ? "—" : `${(n * 100).toFixed(1)}%`;
}

// Why each project's margin moved, from the resolved issues and who acted on them.
async function reasons(issues: IssueRow[]): Promise<Reason[]> {
  const out: Reason[] = [];
  for (const i of issues.filter((x) => x.status === "resolved" && x.proposal)) {
    const p = JSON.parse(i.proposal!) as Proposal;
    const acts = await all<ActivityRow>("select * from activity where issue_id=? order by id", i.id);
    if (i.kind === "missing_project" && p.type === "tag" && p.projectId) {
      const who = acts.find((a) => a.kind === "answered")?.actor_name ?? acts.find((a) => a.kind === "approved")?.actor_name ?? "";
      out.push({ projectId: p.projectId, delta: -i.amount, who, issueId: i.id, text: `${money(i.amount, { cents: false })} of Home Depot materials added${who ? ` (${who} confirmed the job)` : ""}` });
    }
    if (i.kind === "labor" && p.type === "reclass") {
      const approver = acts.find((a) => a.kind === "approved")?.actor_name ?? "policy";
      for (const l of p.lines) {
        const cost = l.debit - l.credit;
        out.push({ projectId: l.project!, delta: -cost, who: p.agentName, issueId: i.id, text: `${money(Math.abs(cost), { cents: false })} of labor moved ${cost > 0 ? "in from Elm St" : "out to Oak Ave"} (found by ${p.agentName}, approved by ${approver})` });
      }
    }
    if (i.kind === "revenue" && i.case_id) {
      const c = await one<{ recommendation: string | null; expert_id: string }>("select recommendation, expert_id from cases where id=?", i.case_id);
      const r = c?.recommendation ? (JSON.parse(c.recommendation) as Extract<Proposal, { type: "revenue" }>) : null;
      const approver = acts.find((a) => a.kind === "approved")?.actor_name ?? "";
      if (r && r.adjustment) out.push({ projectId: "p_lin", delta: r.adjustment, who: r.by, issueId: i.id, text: `revenue measured by cost incurred, so ${money(Math.abs(r.adjustment), { cents: false })} is deferred (${r.by.split(",")[0]} recommended, ${approver} approved)` });
      else if (r) out.push({ projectId: "p_lin", delta: 0, who: r.by, issueId: i.id, text: `Revenue kept as billed (${r.by}, approved by ${approver})` });
    }
  }
  return out;
}

export async function reportData() {
  const runRow = await one<{ id: string; baseline: string; started_at: string }>("select id, baseline, started_at from runs order by started_at desc limit 1");
  const now = await projectMargins();
  const before: Margins | null = runRow ? (JSON.parse(runRow.baseline) as Margins) : null;
  const issues = runRow ? await all<IssueRow>("select * from issues where run_id=?", runRow.id) : [];
  const why = await reasons(issues);
  const r = await readiness();
  const L = await lookups();
  const open = issues
    .filter((i) => !RESOLVED.includes(i.status))
    .map((i) => ({ id: i.id, title: i.title, amount: i.amount, status: i.status, material: !["minor", "receipts"].includes(i.kind) && i.amount >= r.materiality, projects: JSON.parse(i.projects) as string[] }));

  const rows = now.rows.map((row) => {
    const b = before?.rows.find((x) => x.projectId === row.projectId) ?? null;
    return {
      ...row,
      before: b ? { revenue: b.revenue, cost: b.cost, pct: b.pct } : null,
      reasons: why.filter((w) => w.projectId === row.projectId),
      open: open.filter((o) => o.projects.includes(row.projectId)),
    };
  });

  const changed = rows.filter((x) => x.before && x.pct !== null && x.before.pct !== null && Math.abs(x.pct - x.before.pct) >= 0.0005);
  const fallback = !runRow
    ? "September hasn't been reviewed yet. Start the review in the close workspace to check these margins."
    : [
        changed.length
          ? changed.map((x) => `${x.name} ${x.pct! < x.before!.pct! ? "fell" : "rose"} from ${pct(x.before!.pct)} to ${pct(x.pct)}${x.reasons.length ? `: ${x.reasons.map((w) => w.text).join(", and ")}` : ""}.`).join(" ")
          : "No project margin has changed since the review started.",
        `Company direct labor is ${money(now.totals.labor, { cents: false })}${before ? (Math.abs(now.totals.labor - before.totals.labor) < 1 ? ", unchanged: corrections moved cost between projects" : `, ${now.totals.labor > before.totals.labor ? "up" : "down"} ${money(Math.abs(now.totals.labor - before.totals.labor), { cents: false })}`) : ""}.`,
        open.filter((o) => o.material).length
          ? `Still open: ${open.filter((o) => o.material).map((o) => o.title.toLowerCase()).join("; ")}.`
          : `Nothing material is open${open.length ? `, and ${open.length} small item${open.length > 1 ? "s are" : " is"} batched for next week` : ""}.`,
      ].join(" ");
  const key = `margins:${JSON.stringify(rows.map((x) => [x.projectId, Math.round(x.revenue), Math.round(x.cost)]))}:${open.map((o) => o.id + o.status).join(",")}`;
  const note = runRow
    ? await explainMargins(key, { projects: rows.map((x) => ({ name: x.name, marginBefore: pct(x.before?.pct ?? null), marginNow: pct(x.pct), revenue: x.revenue, cost: x.cost, changes: x.reasons.map((w) => w.text) })), directLabor: now.totals.labor, stillOpen: open.map((o) => o.title) }, fallback)
    : { text: fallback, ai: false };

  const history = await all<ActivityRow & { issue_title: string | null }>(
    "select a.*, i.title issue_title from activity a left join issues i on i.id=a.issue_id where a.kind in ('applied','approved','posted','answered','proposed','returned','sent_to_expert','installed','info_received','rejected','undone') order by a.id desc",
  );
  const txns = async (projectId: string) => {
    const list = await all<Txn & { receipt: string | null }>("select t.*, r.file receipt from transactions t left join receipts r on r.matched_txn_id=t.id where t.project_id=? and t.status='posted' and t.account_id in ('a4000','a5000','a5100','a5200','a5300') order by t.account_id, t.amount desc", projectId);
    return list.map((t) => ({ id: t.id, date: t.date, description: t.description, amount: t.amount, account: L.accounts.get(t.account_id)?.name ?? "", source: t.source, receipt: t.receipt }));
  };

  return {
    reviewed: !!runRow,
    reviewStarted: runRow?.started_at ?? null,
    rows,
    unassigned: { now: now.unassigned, before: before?.unassigned ?? null },
    totals: { now: now.totals, before: before?.totals ?? null },
    open,
    readiness: r,
    note,
    history: history.slice(0, 40),
    projectTxns: Object.fromEntries(await Promise.all(now.rows.map(async (x) => [x.projectId, await txns(x.projectId)] as const))),
  };
}
export type ReportData = Awaited<ReturnType<typeof reportData>>;

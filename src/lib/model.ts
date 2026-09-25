import { all, getSetting, memo, one } from "./db";
import { PERMISSION_CATALOG } from "./costcheck";

// ---------- Row types ----------
export type Txn = {
  id: string; company_id: string; date: string; description: string; vendor_id: string | null; amount: number; account_id: string; project_id: string | null;
  source: string; ref: string | null; card_id: string | null; status: string; memo: string | null; created_by: string | null; created_at: string;
};
export type Project = { id: string; name: string; customer: string; pm_user_id: string; address: string; contract_value: number; est_total_cost: number; budget_labor_pct: number; crew_days: number; billing: string };
export type UserRow = { id: string; name: string; role: string; title: string; phone: string | null; firm: string | null; initials: string; color: string; email: string };
export type Policy = { key: string; label: string; detail: string; mode: "auto" | "approval" | "expert"; limit_amount: number | null; editable: number; sort: number };
export type Check = { label: string; result: string; ok: boolean | null; source: string; file?: string };
export type JeLine = { account: string; project: string | null; debit: number; credit: number };
export type Proposal =
  | { type: "attach_receipts"; items: { txnId: string; receiptId: string; description: string; amount: number; file: string }[] }
  | { type: "tag"; txnId: string; projectId: string | null; basis: string }
  | { type: "reclass"; agentId: string; agentName: string; moves: { worker: string; from: string; to: string; hours: number; amount: number }[]; lines: JeLine[]; total: number; reason: string }
  | { type: "revenue"; treatment: string; label: string; revenue: number; adjustment: number; lines: JeLine[]; rationale: string; by: string };
export type IssueRow = {
  id: string; run_id: string; company_id: string; kind: string; title: string; summary: string; amount: number; status: string; mode: string;
  projects: string; checked: string; proposal: string | null; txn_id: string | null; question_id: string | null; agent_id: string | null; case_id: string | null;
  resolution: string | null; created_at: string; updated_at: string;
};
export type ActivityRow = { id: number; issue_id: string | null; txn_id: string | null; project_id: string | null; kind: string; label: string; detail: string | null; actor_type: string; actor_name: string; policy: string | null; file: string | null; created_at: string };
export type QuestionRow = {
  id: string; issue_id: string | null; case_id: string | null; txn_id: string | null; fact: string; prompt: string; options: string; asked_user_id: string; token: string;
  status: string; answer_value: string | null; answer_label: string | null; answer_note: string | null; asked_at: string; answered_at: string | null; reminders: number;
};
export type AgentRow = {
  id: string; developer_id: string; name: string; vendor: string; template: string; summary: string; permissions: string; config: string; status: string; price: number;
  eval: string | null; eval_config: string | null; security: string | null; published_at: string | null; created_at: string;
};
export type CaseRow = {
  id: string; issue_id: string; company_id: string; question: string; summary: string; ai_written: number; status: string; expert_id: string; fee: number; platform_fee: number;
  proposal: string; recommendation: string | null; created_by: string; created_at: string; returned_at: string | null; decided_at: string | null;
};

export const RESOLVED = ["auto_resolved", "resolved", "dismissed"];

// Material issues can change a reported figure by at least the materiality limit. Receipts are
// documentation only, and small items are batched, so neither blocks the review.
export function isMaterial(i: { kind: string; amount: number }, mat: number) {
  return !["minor", "receipts"].includes(i.kind) && i.amount >= mat;
}

// ---------- Lookups ----------
export type Lookups = {
  users: Map<string, UserRow>;
  projects: Map<string, Project>;
  accounts: Map<string, { id: string; number: string; name: string; type: string }>;
  vendors: Map<string, string>;
};

// Reference data that doesn't change during a request, loaded once per request.
export function lookups(): Promise<Lookups> {
  return memo("lookups", async () => {
    const [u, p, a, v] = await Promise.all([
      all<UserRow>("select id,name,role,title,phone,firm,initials,color,email from users order by sort"),
      all<Project>("select * from projects"),
      all<{ id: string; number: string; name: string; type: string }>("select * from accounts"),
      all<{ id: string; name: string }>("select * from vendors"),
    ]);
    return { users: new Map(u.map((x) => [x.id, x])), projects: new Map(p.map((x) => [x.id, x])), accounts: new Map(a.map((x) => [x.id, x])), vendors: new Map(v.map((x) => [x.id, x.name])) };
  });
}

export async function policies(): Promise<Policy[]> {
  return all<Policy>("select * from policies order by sort");
}
export async function policy(key: string): Promise<Policy> {
  return (await one<Policy>("select * from policies where key=?", key))!;
}
export async function materiality(): Promise<number> {
  return Number(await getSetting("materiality", "5000"));
}

// ---------- Project margins ----------
export type MarginRow = { projectId: string; name: string; pm: string; revenue: number; materials: number; subs: number; equipment: number; labor: number; cost: number; margin: number; pct: number | null };
export type Margins = { rows: MarginRow[]; unassigned: number; totals: { revenue: number; cost: number; margin: number; pct: number | null; labor: number; materials: number } };

export async function projectMargins(): Promise<Margins> {
  const L = await lookups();
  const sums = await all<{ project_id: string | null; account_id: string; s: number }>(
    "select project_id, account_id, sum(amount) s from transactions where status='posted' and company_id='hpb' and date like '2026-09%' group by project_id, account_id",
  );
  const get = (p: string | null, a: string) => sums.find((s) => s.project_id === p && s.account_id === a)?.s ?? 0;
  const rows: MarginRow[] = ["p_oak", "p_elm", "p_riv", "p_lin"].map((id) => {
    const p = L.projects.get(id)!;
    const revenue = get(id, "a4000");
    const materials = get(id, "a5000");
    const subs = get(id, "a5100");
    const equipment = get(id, "a5200");
    const labor = get(id, "a5300");
    const cost = materials + subs + equipment + labor;
    return { projectId: id, name: p.name, pm: L.users.get(p.pm_user_id)?.name ?? "", revenue, materials, subs, equipment, labor, cost, margin: revenue - cost, pct: revenue ? (revenue - cost) / revenue : null };
  });
  const unassigned = ["a5000", "a5100", "a5200", "a5300"].reduce((s, a) => s + get(null, a), 0);
  const revenue = rows.reduce((s, r) => s + r.revenue, 0);
  const cost = rows.reduce((s, r) => s + r.cost, 0) + unassigned;
  return {
    rows,
    unassigned,
    totals: {
      revenue, cost, margin: revenue - cost, pct: revenue ? (revenue - cost) / revenue : null,
      labor: rows.reduce((s, r) => s + r.labor, 0) + get(null, "a5300"),
      materials: rows.reduce((s, r) => s + r.materials, 0) + get(null, "a5000"),
    },
  };
}

// ---------- Issues, as the UI sees them ----------
export type AgentCard = { id: string; name: string; vendor: string; summary: string; price: number; passed: number; total: number; can: string[] };

export async function publishedAgent(): Promise<AgentCard | null> {
  const a = await one<AgentRow>("select * from agents where status='published' order by published_at desc limit 1");
  if (!a) return null;
  const ev = a.eval ? (JSON.parse(a.eval) as { passed: number; total: number }) : { passed: 0, total: 0 };
  const perms = JSON.parse(a.permissions) as string[];
  return { id: a.id, name: a.name, vendor: a.vendor, summary: a.summary, price: a.price, passed: ev.passed, total: ev.total, can: perms.map((p) => PERMISSION_CATALOG.find((x) => x.key === p)?.label ?? p) };
}

export async function activeInstall(agentId: string) {
  return one<{ id: number; agent_id: string; entities: string; access: string; installed_at: string }>("select * from installs where agent_id=? and revoked_at is null order by id desc limit 1", agentId);
}

async function questionView(qid: string | null) {
  if (!qid) return null;
  const q = await one<QuestionRow>("select * from questions where id=?", qid);
  if (!q) return null;
  const u = (await lookups()).users.get(q.asked_user_id);
  return { ...q, options: JSON.parse(q.options) as { choices: { value: string; label: string }[] }, askedName: u?.name ?? "", askedFirst: u?.name.split(" ")[0] ?? "", askedColor: u?.color ?? "#555", askedInitials: u?.initials ?? "" };
}

async function caseView(caseId: string | null) {
  if (!caseId) return null;
  const c = await one<CaseRow>("select * from cases where id=?", caseId);
  if (!c) return null;
  const expert = (await lookups()).users.get(c.expert_id);
  const messages = await all<{ id: number; from_name: string; to_name: string; kind: string; body: string; created_at: string }>("select * from case_messages where case_id=? order by id", caseId);
  return { ...c, proposal: JSON.parse(c.proposal) as Proposal, recommendation: c.recommendation ? (JSON.parse(c.recommendation) as Proposal) : null, expertName: expert?.name ?? "", expertFirm: expert?.firm ?? "", messages };
}

export async function issueViews(runId: string) {
  const L = await lookups();
  const mat = await materiality();
  const rec = await publishedAgent();
  const install = rec ? await activeInstall(rec.id) : undefined;
  const issues = await all<IssueRow>("select * from issues where run_id=? order by seq", runId);
  const out = [];
  for (const i of issues) {
    const txn = i.txn_id ? await one<Txn>("select * from transactions where id=?", i.txn_id) : undefined;
    const receipt = i.txn_id ? await one<{ file: string }>("select file from receipts where matched_txn_id=?", i.txn_id) : undefined;
    const activity = await all<ActivityRow>("select * from activity where issue_id=? order by id", i.id);
    const proposal = i.proposal ? (JSON.parse(i.proposal) as Proposal) : null;
    const movedWorkers = proposal?.type === "reclass" ? [...new Set(proposal.moves.map((m) => m.worker))] : [];
    out.push({
      ...i,
      projects: (JSON.parse(i.projects) as string[]).map((p) => ({ id: p, name: L.projects.get(p)?.name ?? p })),
      checked: JSON.parse(i.checked) as Check[],
      proposal,
      material: isMaterial(i, mat),
      timesheets: movedWorkers.length
        ? await all<{ worker: string; project_id: string; week_start: string; hours: number; approved_by: string }>(`select worker, project_id, week_start, hours, approved_by from time_entries where worker in (${movedWorkers.map(() => "?").join(",")}) order by worker, week_start`, ...movedWorkers)
        : [],
      txn: txn ? { ...txn, vendor: txn.vendor_id ? L.vendors.get(txn.vendor_id) ?? "" : "", projectName: txn.project_id ? L.projects.get(txn.project_id)?.name ?? null : null, receipt: receipt?.file ?? null } : null,
      question: await questionView(i.question_id),
      case: await caseView(i.case_id),
      activity,
      recommendation: i.kind === "labor" && rec ? { ...rec, installed: !!install, installEntities: install ? (JSON.parse(install.entities) as string[]) : [] } : null,
    });
  }
  return out;
}
export type IssueView = Awaited<ReturnType<typeof issueViews>>[number];

// ---------- Readiness ----------
export async function readiness() {
  const runRow = await one<{ id: string }>("select id from runs order by started_at desc limit 1");
  const mat = await materiality();
  const issues = runRow ? await all<IssueRow>("select * from issues where run_id=?", runRow.id) : [];
  const open = issues.filter((i) => !RESOLVED.includes(i.status));
  const blockers = open.filter((i) => isMaterial(i, mat)).map((i) => ({ id: i.id, title: i.title, status: i.status, amount: i.amount }));
  const crewTime = await getSetting("sitelog_time_at", "");
  const sources = [
    { name: "Bank feeds", at: await getSetting("bank_synced_at"), state: "fresh" },
    { name: "Payroll PR-0930", at: await getSetting("payroll_posted_at"), state: "fresh" },
    { name: "SiteLog daily logs", at: await getSetting("sitelog_logs_at"), state: "fresh" },
    { name: "SiteLog crew time", at: crewTime || null, state: crewTime ? "fresh" : "not_connected" },
  ];
  const applied = (await one<{ n: number }>("select count(*)::int n from activity where kind='applied'"))?.n ?? 0;
  const awaiting = open.filter((i) => ["needs_approval", "expert_returned", "needs_expert", "needs_agent"].includes(i.status)).length;
  const expertSigned = (await one<{ n: number }>("select count(*)::int n from cases where status in ('returned','approved')"))?.n ?? 0;
  const approvedByYou = (await one<{ n: number }>("select count(*)::int n from activity where kind='approved' and actor_type='person'"))?.n ?? 0;
  return {
    reviewed: !!runRow,
    ready: !!runRow && blockers.length === 0,
    reviewDate: await getSetting("review_date", "2026-10-02"),
    materiality: mat,
    blockers,
    minorOpen: open.filter((i) => !isMaterial(i, mat)).length,
    sources,
    approvals: { applied, awaiting, expertSigned, approvedByYou },
  };
}

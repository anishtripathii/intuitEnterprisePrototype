import { all, getSetting, nowIso, one, run, setSetting, tx } from "./db";
import { randomToken } from "./hash";
import { money, moneyShort, niceDate, relTime } from "./format";
import { phraseQuestion, summarizeCase } from "./ai";
import { costCheck, type AgentConfig } from "./costcheck";
import {
  isMaterial, lookups, materiality, policy, projectMargins, RESOLVED,
  type AgentRow, type CaseRow, type Check, type IssueRow, type JeLine, type Proposal, type QuestionRow, type Txn,
} from "./model";

type Actor = { type: "agent" | "partner" | "person" | "expert" | "system"; name: string };
const FOOTNOTE: Actor = { type: "agent", name: "Footnote" };

async function log(a: { issue?: string | null; txn?: string | null; project?: string | null; kind: string; label: string; detail?: string | null; actor: Actor; policy?: string | null; file?: string | null }) {
  await run(
    "insert into activity(issue_id,txn_id,project_id,kind,label,detail,actor_type,actor_name,policy,file,created_at) values(?,?,?,?,?,?,?,?,?,?,?)",
    a.issue ?? null, a.txn ?? null, a.project ?? null, a.kind, a.label, a.detail ?? null, a.actor.type, a.actor.name, a.policy ?? null, a.file ?? null, nowIso(),
  );
}

async function setIssue(id: string, patch: Partial<Record<keyof IssueRow, unknown>>) {
  const keys = Object.keys(patch);
  await run(`update issues set ${keys.map((k) => `${k}=?`).join(",")}, updated_at=? where id=?`, ...keys.map((k) => {
    const v = patch[k as keyof IssueRow];
    return v !== null && typeof v === "object" ? JSON.stringify(v) : v;
  }), nowIso(), id);
}

export async function getIssue(id: string) {
  return await one<IssueRow>("select * from issues where id=?", id);
}

async function policyNote(key: string, amount?: number) {
  const p = await policy(key);
  return `${p.label}${p.limit_amount && amount !== undefined ? ` · up to ${money(p.limit_amount, { cents: false })}` : ""}`;
}

async function postLines(lines: JeLine[], description: string, ref: string, user: string) {
  const L = (await lookups());
  for (const [i, l] of lines.entries()) {
    const type = L.accounts.get(l.account)?.type;
    const amount = type === "income" || type === "liability" ? l.credit - l.debit : l.debit - l.credit;
    await run(
      "insert into transactions(id,company_id,date,description,vendor_id,amount,account_id,project_id,source,ref,card_id,status,memo,created_by,created_at) values(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
      `t_je_${randomToken(5)}_${i}`, "hpb", "2026-09-30", description, null, amount, l.account, l.project, "journal", ref, null, "posted", null, user, nowIso(),
    );
  }
}

// ---------- The review (the agent's investigation) ----------

export async function startReview(userId: string, goal: string, entities: string[]) {
  const existing = await one<{ id: string }>("select id from runs limit 1");
  if (existing) return existing.id;
  const L = (await lookups());
  const runId = `run_${randomToken(5)}`;
  const baseline = (await projectMargins());
  await run("insert into runs(id,company_id,goal,entities,status,created_by,started_at,baseline) values(?,?,?,?,?,?,?,?)", runId, "hpg", goal, JSON.stringify(entities), "running", userId, nowIso(), JSON.stringify(baseline));
  let seq = 0;
  const step = async (label: string, detail: string, source: string, outcome: "ok" | "issue" | "info" = "ok") =>
    run("insert into run_steps(run_id,seq,label,detail,source,outcome) values(?,?,?,?,?,?)", runId, ++seq, label, detail, source, outcome);
  const issue = async (row: { id: string; kind: string; title: string; summary: string; amount: number; status: string; mode: string; projects: string[]; checked: Check[]; proposal?: Proposal | null; txn?: string | null; resolution?: string | null }) =>
    await run(
      "insert into issues(id,run_id,company_id,kind,title,summary,amount,status,mode,projects,checked,proposal,txn_id,question_id,agent_id,case_id,resolution,created_at,updated_at) values(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
      row.id, runId, "hpb", row.kind, row.title, row.summary, row.amount, row.status, row.mode, JSON.stringify(row.projects), JSON.stringify(row.checked),
      row.proposal ? JSON.stringify(row.proposal) : null, row.txn ?? null, null, null, null, row.resolution ?? null, nowIso(), nowIso(),
    );

  if (!entities.includes("hpb")) {
    await step("Read September activity", "No active projects in the selected entities. Add Harbor & Pine Builders to review project costs.", "Transactions", "info");
    await run("update runs set status='done' where id=?", runId);
    return runId;
  }

  // 1. Scope
  const txns = await all<Txn>("select * from transactions where company_id='hpb' and status='posted' and date like '2026-09%'");
  const total = txns.reduce((s, t) => s + Math.abs(t.amount), 0);
  await step("Read September activity", `${txns.length} transactions · ${moneyShort(total)} · 4 active projects in Harbor & Pine Builders`, "Transactions");

  // 2. Freshness
  await step(
    "Checked that sources are current",
    `Bank feeds synced ${relTime(await getSetting("bank_synced_at"))} · Payroll PR-0930 posted Sep 30 · SiteLog daily logs from Sep 30. Crew timesheets stay in SiteLog and aren't shared with IES.`,
    "Connections",
  );

  // 3. Receipts (autonomous under policy)
  const cardTxns = txns.filter((t) => t.source === "card");
  const receipts = await all<{ id: string; vendor: string; amount: number; date: string; file: string; job_ref: string | null }>("select * from receipts where matched_txn_id is null");
  const items: { txnId: string; receiptId: string; description: string; amount: number; file: string }[] = [];
  for (const t of cardTxns) {
    const vendor = t.vendor_id ? L.vendors.get(t.vendor_id) : null;
    const r = receipts.find((x) => x.vendor === vendor && Math.abs(x.amount - t.amount) < 0.005 && Math.abs(Date.parse(x.date) - Date.parse(t.date)) <= 2 * 86400e3 && !items.some((i) => i.receiptId === x.id));
    if (r) items.push({ txnId: t.id, receiptId: r.id, description: t.description, amount: t.amount, file: r.file });
  }
  const unmatched = cardTxns.filter((t) => !items.some((i) => i.txnId === t.id));
  const attachAuto = (await policy("attach_receipts")).mode === "auto";
  if (items.length) {
    if (attachAuto) {
      for (const it of items) {
        await run("update receipts set matched_txn_id=? where id=?", it.txnId, it.receiptId);
      }
    }
    const recChecks: Check[] = [
      { label: "Receipts inbox", result: `${items.length} of ${cardTxns.length} card purchases have an exact match`, ok: true, source: "Receipts inbox" },
      { label: "Match rule", result: "Same amount and vendor, date within 2 days", ok: true, source: "Policy" },
      ...unmatched.map((t): Check => ({ label: `${L.vendors.get(t.vendor_id ?? "") ?? t.description} ${money(t.amount)}`, result: "No receipt in the inbox", ok: false, source: "Receipts inbox" })),
    ];
    const id = `iss_rcpt`;
    await issue({
      id, kind: "receipts", title: `${items.length} missing receipts found`, amount: items.reduce((s, i) => s + i.amount, 0),
      summary: "Card purchases were missing receipts. Footnote found exact matches in the receipts inbox and attached them. No amount, account or project changed.",
      status: attachAuto ? "auto_resolved" : "needs_approval", mode: "auto",
      projects: [...new Set(items.map((i) => txns.find((t) => t.id === i.txnId)?.project_id).filter((p): p is string => !!p))],
      checked: recChecks, proposal: { type: "attach_receipts", items }, resolution: attachAuto ? "Attached by policy" : null,
    });
    if (attachAuto) {
      for (const it of items) {
        const t = txns.find((x) => x.id === it.txnId)!;
        await log({ issue: id, txn: it.txnId, project: t.project_id, kind: "applied", label: `Attached receipt · ${L.vendors.get(t.vendor_id ?? "")} ${money(t.amount)}`, detail: "Exact match on amount, vendor and date", actor: FOOTNOTE, policy: await policyNote("attach_receipts"), file: it.file });
      }
    }
  }
  await step("Matched receipts to card purchases", attachAuto ? `Found and attached ${items.length} of ${cardTxns.length} receipts. Nothing else changed.` : `Found ${items.length} of ${cardTxns.length} receipts; waiting for your approval to attach them.`, "Receipts inbox");

  // 4. Job costs without a project → check evidence, then ask the source
  const unassigned = txns.filter((t) => ["a5000", "a5100", "a5200", "a5300"].includes(t.account_id) && !t.project_id);
  for (const t of unassigned) {
    const card = t.card_id ? await one<{ last4: string; holder_user_id: string }>("select * from cards where id=?", t.card_id) : undefined;
    const holder = card ? L.users.get(card.holder_user_id) : undefined;
    const jobs = [...L.projects.values()].filter((p) => p.pm_user_id === holder?.id);
    const rec = items.find((i) => i.txnId === t.id);
    const recRow = rec ? await one<{ job_ref: string | null }>("select job_ref from receipts where id=?", rec.receiptId) : undefined;
    const logs = await all<{ project_id: string; deliveries: string }>("select * from site_logs where date=?", t.date);
    const vendor = L.vendors.get(t.vendor_id ?? "") ?? t.description;
    const delivered = logs.filter((l) => (JSON.parse(l.deliveries) as string[]).some((d) => d.toLowerCase().includes(vendor.toLowerCase())));
    const checks: Check[] = [
      { label: "Receipt", result: rec ? (recRow?.job_ref ? `Names ${recRow.job_ref}` : "Found and attached. Drywall and metal studs; no job name or PO") : "No receipt found", ok: rec && recRow?.job_ref ? true : false, source: "Receipts inbox", file: rec?.file },
      { label: "Cardholder", result: holder ? `${holder.name} runs ${jobs.map((j) => j.name.split(" ").slice(0, 2).join(" ")).join(" and ")}` : "No cardholder", ok: null, source: "Cards · Projects" },
      { label: `SiteLog daily logs, ${niceDate(t.date)}`, result: delivered.length ? `${vendor} delivery logged at ${delivered.map((d) => L.projects.get(d.project_id)?.name).join(", ")}` : `No ${vendor} delivery logged at either site`, ok: delivered.length === 1 ? true : false, source: "SiteLog" },
    ];
    const id = `iss_proj_${t.id}`;
    const base = { id, kind: "missing_project", title: `${vendor} ${money(t.amount, { cents: false })} has no project`, amount: t.amount, summary: `Booked to ${L.accounts.get(t.account_id)?.name} on ${niceDate(t.date)} without a job, so it is missing from every project's margin.`, mode: "ask", projects: jobs.map((j) => j.id), checked: checks, txn: t.id };
    const openForHolder = holder ? (await one<{ n: number }>("select count(*)::int n from questions where status='open' and asked_user_id=?", holder.id))?.n ?? 0 : 99;
    if (holder && openForHolder < 3) {
      const fallback = `${vendor} · ${money(t.amount)} on ${niceDate(t.date)} (card ••${card?.last4}). Which job was this for?`;
      const phrased = await phraseQuestion({ vendor, amount: money(t.amount), date: niceDate(t.date), card: card?.last4 ?? null, fact: "project", recipientFirstName: holder.name.split(" ")[0] }, fallback);
      const qid = `q_${randomToken(5)}`;
      const token = randomToken();
      const choices = [...jobs.map((j) => ({ value: j.id, label: j.name })), { value: "other", label: "Another job" }, { value: "none", label: "Not a job cost" }];
      await run("insert into questions(id,issue_id,case_id,txn_id,fact,prompt,options,asked_user_id,token,status,asked_at) values(?,?,?,?,?,?,?,?,?,?,?)", qid, id, null, t.id, "project", phrased.text, JSON.stringify({ choices }), holder.id, token, "open", nowIso());
      await run("insert into outbox(user_id,channel,body,link,created_at) values(?,?,?,?,?)", holder.id, "sms", `Harbor & Pine finance: ${stripPrefix(phrased.text)}`, `/a/${token}`, nowIso());
      await issue({ ...base, status: "waiting_person", proposal: null });
      await setIssue(id, { question_id: qid });
      await log({ issue: id, txn: t.id, kind: "asked", label: `Texted ${holder.name}`, detail: "The receipt names no job and neither site logged the delivery, so the cardholder is the best source.", actor: FOOTNOTE, policy: await policyNote("ask_source") });
    } else {
      await issue({ ...base, status: "needs_approval", proposal: { type: "tag", txnId: t.id, projectId: null, basis: "Evidence wasn't enough and the cardholder already has 3 open questions." } });
    }
  }
  await step("Checked every job cost has a project", unassigned.length ? `${unassigned.length} purchase has no project: ${unassigned.map((t) => `${L.vendors.get(t.vendor_id ?? "")} ${money(t.amount, { cents: false })}`).join(", ")}. The evidence wasn't enough, so I asked the cardholder.` : "Every job cost has a project.", "Transactions · Projects", unassigned.length ? "issue" : "ok");

  // 5. Labor vs site activity
  const m = (await projectMargins());
  const oak = m.rows.find((r) => r.projectId === "p_oak")!;
  const elm = m.rows.find((r) => r.projectId === "p_elm")!;
  const oakP = L.projects.get("p_oak")!;
  const elmP = L.projects.get("p_elm")!;
  const oakPct = oak.labor / oak.cost;
  const elmPct = elm.labor / elm.cost;
  if (oakP.budget_labor_pct / 100 - oakPct >= 0.08) {
    const est = Math.round(((oakP.budget_labor_pct / 100 - oakPct) * oak.cost) / 100) * 100;
    const id = "iss_labor";
    await issue({
      id, kind: "labor", title: "Oak Ave labor looks too low for the crew on site", amount: est, mode: "assisted",
      summary: `Oak Ave labor is ${Math.round(oakPct * 100)}% of its September cost against a ${oakP.budget_labor_pct}% budget, yet SiteLog shows a crew on site ${oakP.crew_days} working days. Elm St runs ${Math.round((elmPct - elmP.budget_labor_pct / 100) * 100)} points over budget. Payroll may have charged the wrong job.`,
      status: "needs_agent", projects: ["p_oak", "p_elm"],
      checked: [
        { label: "Payroll allocation PR-0930", result: `Oak Ave ${money(oak.labor, { cents: false })} (${Math.round(oakPct * 100)}% of cost, budget ${oakP.budget_labor_pct}%) · Elm St ${money(elm.labor, { cents: false })} (${Math.round(elmPct * 100)}%, budget ${elmP.budget_labor_pct}%)`, ok: false, source: "Payroll" },
        { label: "SiteLog daily logs", result: `A crew was on site at Oak Ave ${oakP.crew_days} working days in September`, ok: null, source: "SiteLog" },
        { label: "Crew timesheets", result: "Kept in SiteLog and not shared with IES, so Footnote can't see who worked where", ok: false, source: "SiteLog" },
      ],
    });
    await log({ issue: id, kind: "checked", label: "Needs a specialist agent", detail: "Verifying this needs SiteLog's approved crew timesheets.", actor: FOOTNOTE });
    const agent = await one<AgentRow>("select * from agents where status='published' limit 1");
    const inst = agent ? await one<{ id: number }>("select id from installs where agent_id=? and revoked_at is null", agent.id) : undefined;
    if (agent && inst) await runAgentOnIssue(id, agent.id);
  }
  await step("Compared labor with site activity", `Oak Ave labor is ${Math.round(oakPct * 100)}% of cost against a ${oakP.budget_labor_pct}% budget. Crew time lives in SiteLog, so this needs a specialist agent.`, "Payroll · SiteLog", "issue");

  // 6. Revenue on new contract types → expert
  const inv = txns.find((t) => t.id === "t_lin_inv");
  if (inv) {
    const lin = L.projects.get("p_lin")!;
    const linCost = m.rows.find((r) => r.projectId === "p_lin")!.cost;
    const pctCost = linCost / lin.est_total_cost;
    const pctBilled = inv.amount / lin.contract_value;
    const cost2cost = Math.round(pctCost * lin.contract_value);
    await issue({
      id: "iss_rev", kind: "revenue", title: "Lincoln milestone invoice: how to recognize $220,000", amount: inv.amount, mode: "expert", status: "needs_expert", projects: ["p_lin"], txn: inv.id,
      summary: `INV-1044 is Builders' first milestone-billing contract. Billing is at ${(pctBilled * 100).toFixed(1)}% of the price while cost is at ${(pctCost * 100).toFixed(1)}% of the estimate. How to recognize it is a judgment call.`,
      checked: [
        { label: "Contract LSD-2026-17", result: "5 milestones; M1 (foundation) is $220,000 of $1,460,000", ok: null, source: "Attachments", file: "contract-lsd-2026-17.svg" },
        { label: "Owner acceptance", result: "Owner's rep accepted milestone 1 on Sep 29", ok: true, source: "Attachments" },
        { label: "Cost progress", result: `${money(linCost, { cents: false })} of ${money(lin.est_total_cost, { cents: false })} estimated total cost (${(pctCost * 100).toFixed(1)}%)`, ok: false, source: "Projects" },
        { label: "Policy", result: "Revenue treatment is always reviewed by an accountant", ok: null, source: "Policy" },
      ],
      proposal: {
        type: "revenue", treatment: "milestone", label: "Recognize $220,000 as billed, using milestones as the measure of progress", revenue: inv.amount, adjustment: 0, lines: [],
        rationale: `Milestone 1 was accepted by the owner's rep on Sep 29. Note: measuring by cost incurred instead would give ${money(cost2cost, { cents: false })}.`, by: "Footnote",
      },
    });
    await log({ issue: "iss_rev", txn: inv.id, project: "p_lin", kind: "checked", label: "Needs an accountant's judgment", detail: "Revenue treatment policy", actor: FOOTNOTE, policy: await policyNote("revenue_treatment") });
    await step("Reviewed revenue on new contract types", `INV-1044 is the first milestone-billing contract. Billing is ahead of cost progress (${(pctBilled * 100).toFixed(1)}% vs ${(pctCost * 100).toFixed(1)}%), so I drafted a treatment for an accountant to review.`, "Invoices · Contracts", "issue");
  }

  // 7. Small items: worked, but they don't block
  const mat = await materiality();
  const small = txns.filter((t) => t.id === "t_amz");
  for (const t of small) {
    const id = `iss_minor_${t.id}`;
    await issue({
      id, kind: "minor", title: `Amazon ${money(t.amount)} may be job materials`, amount: t.amount, mode: "minor", status: "batched", projects: [], txn: t.id,
      summary: `Coded to Office Supplies at 48% confidence and has no receipt. It's under the ${money(mat, { cents: false })} materiality limit, so it won't block the review.`,
      checked: [
        { label: "Coding", result: "AI suggestion: Office Supplies (48%) or Job Materials (41%)", ok: false, source: "Bank feed" },
        { label: "Receipt", result: "None in the inbox", ok: false, source: "Receipts inbox" },
      ],
    });
    await log({ issue: id, txn: t.id, kind: "asked", label: "Added to Maya Chen's weekly digest", detail: "Small items are batched into one weekly message instead of a text each", actor: FOOTNOTE, policy: await policyNote("ask_source") });
  }
  await step("Looked at smaller items", `${small.length} item under ${money(mat, { cents: false })} batched into a weekly digest. It won't block the review.`, "Transactions", "info");

  const open = (await all<IssueRow>("select * from issues where run_id=?", runId)).filter((i) => !RESOLVED.includes(i.status) && isMaterial(i, mat)).length;
  await step("Summary", `${open} material issue${open === 1 ? "" : "s"} need${open === 1 ? "s" : ""} attention · ${attachAuto ? items.length : 0} receipts attached by policy · ${small.length} small item batched`, "Footnote", "info");
  await run("update runs set status='done' where id=?", runId);
  return runId;
}

function stripPrefix(text: string) {
  return text.replace(/^Harbor & Pine finance:\s*/i, "");
}

// ---------- Answers from people ----------

export async function answerQuestion(qid: string, input: { value: string; label?: string; note?: string | null }, actor: { name: string; via: string }) {
  const q = await one<QuestionRow>("select * from questions where id=?", qid);
  if (!q) throw new Error("Question not found");
  if (q.status !== "open") return { ok: false, message: "Already answered" };
  const L = (await lookups());
  const opts = JSON.parse(q.options) as { choices: { value: string; label: string }[] };
  const label = input.label ?? opts.choices.find((c) => c.value === input.value)?.label ?? input.value;
  await run("update questions set status='answered', answer_value=?, answer_label=?, answer_note=?, answered_at=? where id=?", input.value, label, input.note ?? null, nowIso(), qid);

  if (q.case_id) {
    const c = (await one<CaseRow>("select * from cases where id=?", q.case_id))!;
    await run("insert into case_messages(case_id,from_name,to_name,kind,body,question_id,created_at) values(?,?,?,?,?,?,?)", c.id, actor.name, L.users.get(c.expert_id)?.name ?? "", "reply", `${label}${input.note ? ` — “${input.note}”` : ""}`, qid, nowIso());
    await run("update cases set status='with_expert' where id=?", c.id);
    await log({ issue: c.issue_id, kind: "info_received", label: `${actor.name} answered ${L.users.get(c.expert_id)?.name.split(",")[0]}'s question`, detail: `${label}${input.note ? ` · “${input.note}”` : ""} (${actor.via})`, actor: { type: "person", name: actor.name } });
    return { ok: true, message: "Answered" };
  }

  const issue = q.issue_id ? await getIssue(q.issue_id) : undefined;
  if (!issue) return { ok: true, message: "Answered" };
  await log({ issue: issue.id, txn: q.txn_id, kind: "answered", label: `${actor.name}: ${label}`, detail: `${input.note ? `“${input.note}” · ` : ""}${actor.via}`, actor: { type: "person", name: actor.name } });
  if (q.fact === "project") {
    const p = await policy("confirmed_tag");
    const isProject = input.value.startsWith("p_");
    if (isProject && p.mode === "auto" && (p.limit_amount == null || issue.amount <= p.limit_amount)) {
      await applyTag(issue, input.value, { type: "agent", name: "Footnote" }, await policyNote("confirmed_tag", issue.amount), `${actor.name} confirmed it`);
    } else {
      const basis = isProject
        ? `${actor.name} said ${label}. ${p.mode !== "auto" ? "Your policy asks you to approve project tags." : `It's above the ${money(p.limit_amount ?? 0, { cents: false })} limit for applying it automatically.`}`
        : `${actor.name} said “${label}”${input.note ? `: “${input.note}”` : ""}. Pick the right project.`;
      await setIssue(issue.id, { status: "needs_approval", proposal: { type: "tag", txnId: issue.txn_id!, projectId: isProject ? input.value : null, basis } });
    }
  }
  return { ok: true, message: "Answered" };
}

async function applyTag(issue: IssueRow, projectId: string, actor: Actor, policyLabel: string | null, why: string) {
  const L = (await lookups());
  const project = L.projects.get(projectId);
  await run("update transactions set project_id=? where id=?", projectId, issue.txn_id);
  await log({ issue: issue.id, txn: issue.txn_id, project: projectId, kind: policyLabel ? "applied" : "approved", label: `Tagged to ${project?.name}`, detail: why, actor, policy: policyLabel });
  await setIssue(issue.id, { status: "resolved", resolution: `Tagged to ${project?.name}`, proposal: { type: "tag", txnId: issue.txn_id!, projectId, basis: why } });
}

export async function passOn(qid: string, toUserId: string | null) {
  const q = await one<QuestionRow>("select * from questions where id=?", qid);
  if (!q || q.status !== "open") return false;
  const L = (await lookups());
  const target = toUserId && L.users.has(toUserId) ? toUserId : "u_priya";
  await run("update questions set status='rerouted', answered_at=? where id=?", nowIso(), qid);
  const id = `q_${randomToken(5)}`;
  const token = randomToken();
  const txn = q.txn_id ? await one<Txn>("select * from transactions where id=?", q.txn_id) : undefined;
  let options = JSON.parse(q.options) as { choices: { value: string; label: string }[] };
  if (q.fact === "project") {
    const jobs = [...L.projects.values()].filter((p) => p.pm_user_id === target);
    const list = (jobs.length ? jobs : [...L.projects.values()]).map((p) => ({ value: p.id, label: p.name }));
    options = { choices: [...list, { value: "other", label: "Another job" }, { value: "none", label: "Not a job cost" }] };
  }
  await run("insert into questions(id,issue_id,case_id,txn_id,fact,prompt,options,asked_user_id,token,status,asked_at) values(?,?,?,?,?,?,?,?,?,?,?)", id, q.issue_id, q.case_id, q.txn_id, q.fact, q.prompt, JSON.stringify(options), target, token, "open", nowIso());
  if (target !== "u_priya") await run("insert into outbox(user_id,channel,body,link,created_at) values(?,?,?,?,?)", target, "sms", `Harbor & Pine finance: ${q.prompt}`, `/a/${token}`, nowIso());
  if (q.issue_id) {
    await setIssue(q.issue_id, { question_id: id });
    await log({ issue: q.issue_id, txn: txn?.id, kind: "asked", label: `Passed on to ${L.users.get(target)?.name}`, detail: `${L.users.get(q.asked_user_id)?.name} tapped “Not mine”`, actor: FOOTNOTE });
  }
  return true;
}

export async function remind(issueId: string, byName: string) {
  const i = await getIssue(issueId);
  if (!i?.question_id) return false;
  const q = await one<QuestionRow>("select * from questions where id=?", i.question_id);
  if (!q || q.status !== "open") return false;
  await run("update questions set reminders=reminders+1 where id=?", q.id);
  await run("insert into outbox(user_id,channel,body,link,created_at) values(?,?,?,?,?)", q.asked_user_id, "sms", `Reminder from Harbor & Pine finance: ${q.prompt}`, `/a/${q.token}`, nowIso());
  await log({ issue: i.id, kind: "reminder", label: `Reminder sent to ${(await lookups()).users.get(q.asked_user_id)?.name}`, detail: `Sent by ${byName}`, actor: { type: "person", name: byName } });
  return true;
}

// ---------- Decisions by the controller ----------

export async function approveIssue(issueId: string, user: { id: string; name: string }, body: { projectId?: string }) {
  const i = await getIssue(issueId);
  if (!i) return { ok: false, message: "Issue not found" };
  const L = (await lookups());
  const me: Actor = { type: "person", name: user.name };
  return tx(async () => {
    if (i.status === "expert_returned" && i.case_id) {
      const c = (await one<CaseRow>("select * from cases where id=?", i.case_id))!;
      const r = JSON.parse(c.recommendation!) as Extract<Proposal, { type: "revenue" }>;
      if (r.lines.length) await postLines(r.lines, `Revenue per ${r.by} · INV-1044 (${r.treatment === "cost_to_cost" ? "cost-to-cost" : r.treatment})`, `JE-${c.id}`, user.id);
      await run("update cases set status='approved', decided_at=? where id=?", nowIso(), c.id);
      await log({ issue: i.id, txn: i.txn_id, project: "p_lin", kind: "approved", label: `${user.name} approved ${r.by.split(",")[0]}'s recommendation`, detail: r.label, actor: me });
      if (r.lines.length) await log({ issue: i.id, project: "p_lin", kind: "posted", label: `Posted JE-${c.id}`, detail: r.lines.map((l) => `${l.debit ? "Dr" : "Cr"} ${L.accounts.get(l.account)?.number} ${money(l.debit || l.credit)}`).join(" · "), actor: { type: "system", name: "IES" } });
      await setIssue(i.id, { status: "resolved", resolution: r.lines.length ? `Revenue ${money(r.revenue, { cents: false })} · ${money(Math.abs(r.adjustment), { cents: false })} deferred` : "Kept as billed" });
      return { ok: true, message: r.lines.length ? `Posted JE-${c.id}. Lincoln revenue is now ${money(r.revenue, { cents: false })}.` : "Approved. Revenue stays as billed." };
    }
    if (i.status !== "needs_approval" || !i.proposal) return { ok: false, message: "Nothing to approve" };
    const p = JSON.parse(i.proposal) as Proposal;
    if (p.type === "attach_receipts") {
      for (const it of p.items) await run("update receipts set matched_txn_id=? where id=?", it.txnId, it.receiptId);
      for (const it of p.items) await log({ issue: i.id, txn: it.txnId, kind: "approved", label: `Attached receipt · ${it.description}`, detail: `Approved by ${user.name}`, actor: me, file: it.file });
      await setIssue(i.id, { status: "resolved", resolution: `${p.items.length} receipts attached` });
      return { ok: true, message: `${p.items.length} receipts attached` };
    }
    if (p.type === "tag") {
      const projectId = body.projectId || p.projectId;
      if (!projectId || !L.projects.has(projectId)) return { ok: false, message: "Choose a project first" };
      await applyTag(i, projectId, me, null, `Approved by ${user.name}`);
      return { ok: true, message: `Tagged to ${L.projects.get(projectId)?.name}` };
    }
    if (p.type === "reclass") {
      await postReclass(i, p, user.id, me);
      return { ok: true, message: `Posted the ${money(p.total, { cents: false })} reclass. Oak Ave and Elm St margins updated.` };
    }
    return { ok: false, message: "Nothing to approve" };
  });
}

async function postReclass(i: IssueRow, p: Extract<Proposal, { type: "reclass" }>, userId: string, actor: Actor) {
  const L = (await lookups());
  const ref = `JE-0930-CC${Math.floor(Math.random() * 90 + 10)}`;
  await postLines(p.lines, `Labor reclass · framing crew B (${p.agentName})`, ref, userId);
  for (const mv of p.moves) {
    await run("insert into labor_alloc(worker,crew,project_id,hours,amount,ref) values(?,?,?,?,?,?)", mv.worker, "B", mv.from, -mv.hours, -mv.amount, ref);
    await run("insert into labor_alloc(worker,crew,project_id,hours,amount,ref) values(?,?,?,?,?,?)", mv.worker, "B", mv.to, mv.hours, mv.amount, ref);
  }
  const agent = await one<AgentRow>("select * from agents where id=?", p.agentId);
  if (agent) await run("insert into agent_usage(agent_id,issue_id,company,detail,amount,dev_share,created_at) values(?,?,?,?,?,?,?)", agent.id, i.id, "Harbor & Pine Builders", `Accepted: labor reclass ${money(p.total, { cents: false })}`, agent.price, Math.round(agent.price * 0.8 * 100) / 100, nowIso());
  await log({ issue: i.id, project: "p_oak", kind: actor.type === "person" ? "approved" : "applied", label: `${actor.type === "person" ? `${actor.name} approved` : "Applied"} the ${money(p.total, { cents: false })} labor reclass`, detail: p.reason, actor, policy: actor.type === "person" ? null : await policyNote("move_cost", p.total) });
  await log({ issue: i.id, project: "p_elm", kind: "posted", label: `Posted ${ref}`, detail: p.lines.map((l) => `${l.debit ? "Dr" : "Cr"} ${L.accounts.get(l.account)?.number} ${L.projects.get(l.project ?? "")?.name.split(" ").slice(0, 2).join(" ")} ${money(l.debit || l.credit, { cents: false })}`).join(" · "), actor: { type: "system", name: "IES" } });
  await setIssue(i.id, { status: "resolved", resolution: `${money(p.total, { cents: false })} moved from Elm St to Oak Ave` });
}

export async function rejectIssue(issueId: string, user: { name: string }, reason: string) {
  const i = await getIssue(issueId);
  if (!i) return { ok: false, message: "Issue not found" };
  const me: Actor = { type: "person", name: user.name };
  if (i.status === "expert_returned" && i.case_id) {
    await run("update cases set status='declined', decided_at=? where id=?", nowIso(), i.case_id);
    await log({ issue: i.id, kind: "rejected", label: `${user.name} declined the recommendation`, detail: reason || null, actor: me });
    await setIssue(i.id, { status: "needs_expert", case_id: null });
    return { ok: true, message: "Declined. You can send it to an expert again." };
  }
  if (i.status !== "needs_approval") return { ok: false, message: "Nothing to reject" };
  await log({ issue: i.id, kind: "rejected", label: `${user.name} rejected the proposal`, detail: reason || null, actor: me });
  await setIssue(i.id, { status: "dismissed", resolution: `Dismissed by ${user.name}${reason ? `: ${reason}` : ""}` });
  return { ok: true, message: "Rejected. Nothing was posted." };
}

export async function undoIssue(issueId: string, user: { name: string }) {
  const i = await getIssue(issueId);
  if (!i || !i.proposal) return { ok: false, message: "Nothing to undo" };
  const p = JSON.parse(i.proposal) as Proposal;
  const me: Actor = { type: "person", name: user.name };
  if (i.kind === "receipts" && i.status === "auto_resolved" && p.type === "attach_receipts") {
    for (const it of p.items) await run("update receipts set matched_txn_id=null where id=?", it.receiptId);
    await log({ issue: i.id, kind: "undone", label: `${user.name} undid the receipt matches`, detail: "Receipts detached. They can be attached again with one approval.", actor: me });
    await setIssue(i.id, { status: "needs_approval", resolution: null });
    return { ok: true, message: "Receipts detached" };
  }
  if (i.kind === "missing_project" && i.status === "resolved" && p.type === "tag") {
    await run("update transactions set project_id=null where id=?", i.txn_id);
    await log({ issue: i.id, txn: i.txn_id, kind: "undone", label: `${user.name} undid the project tag`, detail: null, actor: me });
    await setIssue(i.id, { status: "needs_approval", resolution: null, proposal: { ...p, basis: `Undone by ${user.name}. Choose the project to apply.` } });
    return { ok: true, message: "Project tag removed" };
  }
  return { ok: false, message: "This can't be undone here" };
}

// ---------- Partner agents on an issue ----------

export async function installAgent(agentId: string, entities: string[], user: { id: string; name: string }, issueId?: string) {
  const a = await one<AgentRow>("select * from agents where id=? and status='published'", agentId);
  if (!a) return { ok: false, message: "That agent isn't published" };
  await run("update installs set revoked_at=? where agent_id=? and revoked_at is null", nowIso(), agentId);
  await run("insert into installs(agent_id,company_id,entities,access,installed_by,installed_at) values(?,?,?,?,?,?)", agentId, "hpg", JSON.stringify(entities), "suggest", user.id, nowIso());
  await setSetting("sitelog_time_at", nowIso());
  const labor = issueId ? await getIssue(issueId) : await one<IssueRow>("select * from issues where kind='labor' order by created_at desc limit 1");
  if (labor) {
    await log({ issue: labor.id, kind: "installed", label: `${user.name} installed ${a.name}`, detail: `Entities: ${entities.map((e) => (e === "hpb" ? "Harbor & Pine Builders" : e === "prs" ? "Pine Ridge Services" : "Harbor & Pine Group")).join(", ")} · suggestion only`, actor: { type: "person", name: user.name } });
    if (!RESOLVED.includes(labor.status)) await runAgentOnIssue(labor.id, a.id);
  }
  return { ok: true, message: `${a.name} installed · suggestion only` };
}

export async function revokeInstall(installId: number, user: { name: string }) {
  const inst = await one<{ agent_id: string }>("select agent_id from installs where id=?", installId);
  if (!inst) return false;
  await run("update installs set revoked_at=? where id=?", nowIso(), installId);
  await setSetting("sitelog_time_at", "");
  const labor = await one<IssueRow>("select * from issues where kind='labor' order by created_at desc limit 1");
  if (labor) await log({ issue: labor.id, kind: "installed", label: `${user.name} removed the agent's access`, detail: null, actor: { type: "person", name: user.name } });
  return true;
}

export async function runAgentOnIssue(issueId: string, agentId: string) {
  const i = (await getIssue(issueId))!;
  const a = (await one<AgentRow>("select * from agents where id=?", agentId))!;
  const inst = await one<{ entities: string }>("select entities from installs where agent_id=? and revoked_at is null order by id desc limit 1", agentId);
  const cfg = JSON.parse(a.config) as AgentConfig;
  const alloc = await all<{ worker: string; project_id: string; hours: number; amount: number }>("select worker, project_id, sum(hours) hours, sum(amount) amount from labor_alloc group by worker, project_id having abs(sum(hours)) > 0.001");
  const time = await all<{ worker: string; project_id: string; week_start: string; hours: number; approved: number }>("select * from time_entries");
  const partner: Actor = { type: "partner", name: a.name };
  const decision = costCheck(cfg, {
    entity: "hpb",
    authorizedEntities: inst ? (JSON.parse(inst.entities) as string[]) : [],
    allocations: alloc.map((x) => ({ worker: x.worker, project: x.project_id, hours: x.hours, amount: x.amount })),
    timesheets: time.map((t) => ({ worker: t.worker, project: t.project_id, week: t.week_start, hours: t.hours, approved: !!t.approved, source: "sitelog" as const })),
  });
  const checked = (JSON.parse(i.checked) as Check[]).filter((c) => c.source !== a.name);
  if (decision.kind === "refused") {
    await log({ issue: i.id, kind: "checked", label: `${a.name} couldn't run`, detail: decision.reason, actor: partner });
    await setIssue(i.id, { status: "needs_agent", checked: [...checked, { label: a.name, result: decision.reason, ok: false, source: a.name }] });
    return;
  }
  if (decision.kind !== "propose") {
    await log({ issue: i.id, kind: "checked", label: `${a.name}: ${decision.kind === "no_issue" ? "no mismatch" : decision.kind}`, detail: decision.reason, actor: partner });
    await setIssue(i.id, { status: decision.kind === "no_issue" ? "resolved" : "needs_approval", resolution: decision.kind === "no_issue" ? "Labor matches approved time" : null, checked: [...checked, { label: a.name, result: decision.reason, ok: decision.kind === "no_issue", source: a.name }] });
    return;
  }
  const byPair = new Map<string, { from: string; to: string; amount: number; hours: number }>();
  for (const mv of decision.moves) {
    const k = `${mv.from}>${mv.to}`;
    const cur = byPair.get(k) ?? { from: mv.from, to: mv.to, amount: 0, hours: 0 };
    cur.amount += mv.amount;
    cur.hours += mv.hours;
    byPair.set(k, cur);
  }
  const lines: JeLine[] = [];
  for (const pr of byPair.values()) {
    lines.push({ account: "a5300", project: pr.to, debit: pr.amount, credit: 0 });
    lines.push({ account: "a5300", project: pr.from, debit: 0, credit: pr.amount });
  }
  const total = decision.moves.reduce((s, m) => s + m.amount, 0);
  const hours = decision.moves.reduce((s, m) => s + m.hours, 0);
  const workers = [...new Set(decision.moves.map((m) => m.worker))];
  const proposal: Proposal = { type: "reclass", agentId: a.id, agentName: a.name, moves: decision.moves, lines, total, reason: `Framing crew B (${workers.join(", ")}) logged ${hours} approved hours at Oak Ave, Sep 7–25. Payroll charged them to Elm St, their default job.` };
  await log({ issue: i.id, project: "p_oak", kind: "proposed", label: `${a.name} proposed moving ${money(total, { cents: false })} of labor`, detail: `Compared approved SiteLog time with payroll PR-0930 for 5 crews. ${proposal.reason}`, actor: partner });
  await setIssue(i.id, {
    amount: total, agent_id: a.id, proposal,
    checked: [...checked, { label: a.name, result: `Compared 5 crews' approved SiteLog time with payroll. Crew B: ${hours} hours at Oak Ave paid to Elm St.`, ok: false, source: a.name }],
    summary: `Payroll charged framing crew B to Elm St (their default job), but their approved SiteLog timesheets put them at Oak Ave for three weeks. Oak Ave's margin is overstated and Elm St's understated.`,
    status: "needs_approval",
  });
  const p = await policy("move_cost");
  if (p.mode === "auto" && (p.limit_amount == null || total <= p.limit_amount)) {
    await postReclass((await getIssue(i.id))!, proposal as Extract<Proposal, { type: "reclass" }>, "system", FOOTNOTE);
  }
}

// ---------- Expert cases ----------

export async function sendToExpert(issueId: string, expertId: string, question: string, user: { id: string; name: string }) {
  const i = await getIssue(issueId);
  if (!i || i.status !== "needs_expert") return { ok: false, message: "This issue isn't waiting for an expert" };
  const L = (await lookups());
  const expert = L.users.get(expertId);
  if (!expert || !["accountant", "live_expert"].includes(expert.role)) return { ok: false, message: "Choose an expert" };
  const own = expert.role === "accountant";
  const count = (await one<{ n: number }>("select count(*)::int n from cases"))?.n ?? 0;
  const id = `C-${1001 + count}`;
  const lin = L.projects.get("p_lin")!;
  const m = (await projectMargins()).rows.find((r) => r.projectId === "p_lin")!;
  const checks = JSON.parse(i.checked) as Check[];
  const proposal = JSON.parse(i.proposal!) as Proposal;
  const fallback = [
    `• INV-1044 · ${lin.customer} · Milestone 1 (foundation) · $220,000, billed Sep 29. The owner's rep accepted the milestone.`,
    `• Contract LSD-2026-17: ${money(lin.contract_value, { cents: false })} in 5 milestones. This is Builders' first milestone-billing contract.`,
    `• Cost to date ${money(m.cost, { cents: false })} of ${money(lin.est_total_cost, { cents: false })} estimated total cost (${((m.cost / lin.est_total_cost) * 100).toFixed(1)}%). Billed to date: ${((220000 / lin.contract_value) * 100).toFixed(1)}% of the price.`,
    `• Footnote's draft: ${proposal.type === "revenue" ? proposal.label.toLowerCase() : ""}.`,
    `• Decision needed: ${question}`,
  ].join("\n");
  const summary = await summarizeCase(`case:${issueId}:${question}`, { invoice: "INV-1044", customer: lin.customer, contract: lin.contract_value, milestones: 5, costToDate: m.cost, estimatedTotalCost: lin.est_total_cost, checks: checks.map((c) => `${c.label}: ${c.result}`), draft: proposal, question }, fallback);
  await run(
    "insert into cases(id,issue_id,company_id,question,summary,ai_written,status,expert_id,fee,platform_fee,proposal,recommendation,created_by,created_at) values(?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
    id, i.id, "hpb", question, summary.text, summary.ai ? 1 : 0, "with_expert", expertId, own ? 150 : 195, own ? 15 : 0, i.proposal, null, user.id, nowIso(),
  );
  await run("insert into outbox(user_id,channel,body,link,created_at) values(?,?,?,?,?)", expertId, "email", `New case ${id} from Harbor & Pine Builders: ${question}`, `/expert/cases/${id}`, nowIso());
  await setIssue(i.id, { status: "with_expert", case_id: id });
  await log({ issue: i.id, txn: i.txn_id, project: "p_lin", kind: "sent_to_expert", label: `Case ${id} sent to ${expert.name}`, detail: `${own ? "Your accountant" : "Intuit Live Experts"} · access to this case only · ${money(own ? 150 : 195, { cents: false })}`, actor: { type: "person", name: user.name } });
  return { ok: true, message: `Case ${id} sent to ${expert.name}`, id };
}

export async function requestInfo(caseId: string, expert: { id: string; name: string }, toUserId: string, message: string) {
  const c = await one<CaseRow>("select * from cases where id=?", caseId);
  if (!c || c.expert_id !== expert.id) return { ok: false, message: "Not your case" };
  if (!["with_expert", "info_requested"].includes(c.status)) return { ok: false, message: "This case is closed" };
  const L = (await lookups());
  const to = L.users.get(toUserId);
  if (!to) return { ok: false, message: "Choose who to ask" };
  let qid: string | null = null;
  if (to.role === "pm") {
    qid = `q_${randomToken(5)}`;
    const token = randomToken();
    const choices = [{ value: "yes", label: "Yes, it's still current" }, { value: "no", label: "No, it has changed" }];
    await run("insert into questions(id,issue_id,case_id,txn_id,fact,prompt,options,asked_user_id,token,status,asked_at) values(?,?,?,?,?,?,?,?,?,?,?)", qid, null, c.id, null, "confirm", message, JSON.stringify({ choices }), to.id, token, "open", nowIso());
    await run("insert into outbox(user_id,channel,body,link,created_at) values(?,?,?,?,?)", to.id, "sms", `${expert.name.split(",")[0]} (Harbor & Pine's accountant) asks: ${message}`, `/a/${token}`, nowIso());
  }
  await run("insert into case_messages(case_id,from_name,to_name,kind,body,question_id,created_at) values(?,?,?,?,?,?,?)", c.id, expert.name, to.name, "request", message, qid, nowIso());
  await run("update cases set status='info_requested' where id=?", c.id);
  await log({ issue: c.issue_id, kind: "info_requested", label: `${expert.name.split(",")[0]} asked ${to.name} for information`, detail: `“${message}”${to.role === "pm" ? " · by text" : ""}`, actor: { type: "expert", name: expert.name } });
  return { ok: true, message: `Question sent to ${to.name}${to.role === "pm" ? " by text" : ""}` };
}

export async function replyToExpert(caseId: string, user: { name: string }, body: string) {
  const c = await one<CaseRow>("select * from cases where id=?", caseId);
  if (!c || c.status !== "info_requested") return { ok: false, message: "No open request" };
  const expert = (await lookups()).users.get(c.expert_id);
  await run("insert into case_messages(case_id,from_name,to_name,kind,body,question_id,created_at) values(?,?,?,?,?,?,?)", c.id, user.name, expert?.name ?? "", "reply", body, null, nowIso());
  await run("update cases set status='with_expert' where id=?", c.id);
  await log({ issue: c.issue_id, kind: "info_received", label: `${user.name} replied to ${expert?.name.split(",")[0]}`, detail: `“${body}”`, actor: { type: "person", name: user.name } });
  return { ok: true, message: "Reply sent" };
}

export async function revenueOptions() {
  const lin = (await (await lookups())).projects.get("p_lin")!;
  const inv = (await one<Txn>("select * from transactions where id='t_lin_inv'"))!;
  const cost = (await projectMargins()).rows.find((r) => r.projectId === "p_lin")!.cost;
  const c2c = Math.round((cost / lin.est_total_cost) * lin.contract_value);
  const mk = (treatment: string, label: string, revenue: number): Omit<Extract<Proposal, { type: "revenue" }>, "rationale" | "by"> => {
    const adj = revenue - inv.amount;
    return { type: "revenue", treatment, label, revenue, adjustment: adj, lines: adj ? [{ account: "a4000", project: "p_lin", debit: -adj, credit: 0 }, { account: "a2450", project: null, debit: 0, credit: -adj }] : [] };
  };
  return {
    billed: inv.amount, cost, estimate: lin.est_total_cost, contract: lin.contract_value,
    options: [
      mk("milestone", "Recognize $220,000 as billed, using milestones as the measure of progress", inv.amount),
      mk("cost_to_cost", `Recognize ${money(c2c, { cents: false })} using cost incurred (cost-to-cost); defer ${money(inv.amount - c2c, { cents: false })}`, c2c),
      mk("defer", "Defer all $220,000 until the owner's formal acceptance certificate", 0),
    ],
  };
}

export async function returnRecommendation(caseId: string, expert: { id: string; name: string }, treatment: string, rationale: string) {
  const c = await one<CaseRow>("select * from cases where id=?", caseId);
  if (!c || c.expert_id !== expert.id) return { ok: false, message: "Not your case" };
  if (!["with_expert", "info_requested"].includes(c.status)) return { ok: false, message: "This case is already returned" };
  const opt = (await revenueOptions()).options.find((o) => o.treatment === treatment);
  if (!opt) return { ok: false, message: "Choose a treatment" };
  if (!rationale.trim()) return { ok: false, message: "Add your rationale for Priya" };
  const rec: Proposal = { ...opt, rationale: rationale.trim(), by: expert.name };
  const draft = JSON.parse(c.proposal) as Proposal;
  const changed = draft.type === "revenue" && draft.treatment !== treatment;
  await run("update cases set status='returned', recommendation=?, returned_at=? where id=?", JSON.stringify(rec), nowIso(), c.id);
  await setIssue(c.issue_id, { status: "expert_returned" });
  await log({ issue: c.issue_id, project: "p_lin", kind: "returned", label: `${expert.name} ${changed ? "changed the treatment and returned it" : "agreed with the draft and returned it"}`, detail: `${opt.label} · “${rationale.trim()}”`, actor: { type: "expert", name: expert.name } });
  return { ok: true, message: "Returned to Priya for approval" };
}

export async function expertCase(caseId: string) {
  const c = await one<CaseRow>("select * from cases where id=?", caseId);
  if (!c) return null;
  const i = (await getIssue(c.issue_id))!;
  const L = (await lookups());
  const txn = i.txn_id ? await one<Txn>("select * from transactions where id=?", i.txn_id) : undefined;
  return {
    case: { ...c, proposal: JSON.parse(c.proposal) as Proposal, recommendation: c.recommendation ? (JSON.parse(c.recommendation) as Proposal) : null },
    issue: { id: i.id, title: i.title, summary: i.summary, checked: JSON.parse(i.checked) as Check[] },
    txn: txn ? { ...txn, customer: L.vendors.get(txn.vendor_id ?? "") ?? "" } : null,
    messages: await all<{ id: number; from_name: string; to_name: string; kind: string; body: string; created_at: string }>("select * from case_messages where case_id=? order by id", caseId),
    createdBy: L.users.get(c.created_by)?.name ?? "",
    numbers: (await revenueOptions()),
  };
}

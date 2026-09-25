"use client";

import Link from "next/link";
import { useState } from "react";
import type { IssueView, JeLine, Proposal } from "@/lib/model";
import { Icon } from "@/components/icons";
import { ActivityList, Avatar, Chip, MODE, ModeChip, Spinner, StatusChip } from "@/components/ui";
import { Modal } from "@/components/Modal";
import { useAction } from "@/components/Toast";
import { money, niceDate, relTime } from "@/lib/format";
import { issueCtx, type CloseState } from "./shared";

const ACCOUNT: Record<string, string> = { a4000: "4000 Contract Revenue", a2450: "2450 Billings in Excess of Revenue", a5300: "5300 Direct Labor", a5000: "5000 Job Materials" };

export function JeTable({ lines, projects }: { lines: JeLine[]; projects: { id: string; name: string }[] }) {
  const name = (p: string | null) => (p ? projects.find((x) => x.id === p)?.name ?? p : "—");
  return (
    <div className="overflow-x-auto rounded-lg border border-line">
      <table className="tbl">
        <thead><tr><th>Account</th><th>Project</th><th className="!text-right">Debit</th><th className="!text-right">Credit</th></tr></thead>
        <tbody>
          {lines.map((l, i) => (
            <tr key={i}>
              <td className="!text-[13px]">{ACCOUNT[l.account] ?? l.account}</td>
              <td className="!text-[13px]">{name(l.project)}</td>
              <td className="!text-[13px] text-right num">{l.debit ? money(l.debit) : ""}</td>
              <td className="!text-[13px] text-right num">{l.credit ? money(l.credit) : ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

async function switchTo(userId: string, href: string) {
  await fetch("/api/auth/switch", { method: "POST", headers: { "content-type": "application/json", "x-demo-login": "1" }, body: JSON.stringify({ userId }) });
  window.location.href = href;
}

export default function IssuePanel({ issue: i, state, reload }: { issue: IssueView; state: CloseState; reload: () => Promise<void> }) {
  const act = useAction();
  const [busy, setBusy] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [install, setInstall] = useState(false);
  const [expert, setExpert] = useState(false);
  const [reply, setReply] = useState("");
  const [tagProject, setTagProject] = useState<string>(i.proposal?.type === "tag" ? i.proposal.projectId ?? "" : "");

  async function run(action: string, body?: unknown) {
    setBusy(action);
    const r = await act(`/api/issues/${i.id}/${action}`, body);
    await reload();
    setBusy(null);
    return r.ok;
  }

  const p = i.proposal;
  const firstName = i.question?.askedFirst ?? "";

  return (
    <article className="card fn-in">
      <header className="px-6 pt-5 pb-4 border-b border-line">
        <div className="flex flex-wrap items-center gap-2">
          <ModeChip mode={i.mode} />
          <StatusChip status={i.status} ctx={issueCtx(i)} />
          {i.material ? <Chip tone="warn">Material</Chip> : <Chip>Under materiality</Chip>}
        </div>
        <div className="flex flex-wrap items-baseline justify-between gap-3 mt-3">
          <h2 className="text-[21px] font-semibold leading-snug">{i.title}</h2>
          <span className="text-[20px] font-semibold num">{i.kind === "labor" && !p ? "≈ " : ""}{money(i.amount, { cents: false })}</span>
        </div>
        <p className="text-[14.5px] text-ink-2 mt-2 leading-relaxed max-w-[72ch]">{i.summary}</p>
        <div className="flex flex-wrap items-center gap-1.5 mt-3 text-[12.5px]">
          <span className="text-ink-3 mr-1">Affects</span>
          <Chip tone="blue">Harbor &amp; Pine Builders</Chip>
          {i.projects.map((pr) => <Chip key={pr.id}>{pr.name}</Chip>)}
          {i.txn ? <Chip>{i.txn.description}</Chip> : null}
        </div>
      </header>

      {/* The one thing to do next */}
      <section className="px-6 py-5 border-b border-line bg-[#fafbfd]">
        {i.status === "waiting_person" && i.question ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-start gap-3">
              <Avatar initials={i.question.askedInitials} color={i.question.askedColor} size={36} />
              <div className="min-w-0">
                <div className="text-[15px] font-semibold">Waiting on {i.question.askedName}</div>
                <div className="text-[13px] text-ink-2">Texted {relTime(i.question.asked_at)}{i.question.reminders ? ` · reminded ${i.question.reminders}×` : ""} · no login needed</div>
                <blockquote className="mt-2 rounded-lg bg-white border border-line px-3 py-2 text-[14px]">“{i.question.prompt}”</blockquote>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href={`/phone/${i.question.asked_user_id}`} className="btn btn-fn"><Icon.Phone size={16} /> Open {firstName}&apos;s phone (demo)</Link>
              <button className="btn btn-secondary" disabled={!!busy} onClick={() => run("remind")}>{busy === "remind" ? <Spinner size={14} /> : <Icon.Bell size={15} />} Send a reminder</button>
            </div>
            <details className="text-[13px]">
              <summary className="cursor-pointer text-link">Know the answer? Answer it yourself</summary>
              <div className="flex flex-wrap gap-2 mt-2">
                {i.question.options.choices.map((c) => (
                  <button key={c.value} className="btn btn-secondary btn-sm" disabled={!!busy} onClick={() => run("answer", { value: c.value, label: c.label })}>{c.label}</button>
                ))}
              </div>
            </details>
          </div>
        ) : null}

        {i.status === "needs_agent" ? (
          i.recommendation ? (
            <div className="flex flex-col gap-3">
              <div className="label">Recommended specialist agent</div>
              <div className="rounded-xl border border-line bg-white p-4 flex flex-wrap gap-4 items-start">
                <span className="w-11 h-11 rounded-lg bg-[#2563EB] text-white font-bold flex items-center justify-center shrink-0">SL</span>
                <div className="flex-1 min-w-[240px]">
                  <div className="flex flex-wrap items-center gap-2"><span className="text-[16px] font-semibold">{i.recommendation.name}</span><span className="text-[13px] text-ink-3">by {i.recommendation.vendor}</span></div>
                  <p className="text-[13.5px] text-ink-2 mt-1">{i.recommendation.summary}</p>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    <Chip tone="good"><Icon.Check size={11} /> Proving Ground {i.recommendation.passed}/{i.recommendation.total}</Chip>
                    <Chip tone="good"><Icon.Shield size={11} /> Security reviewed</Chip>
                    <Chip>{money(i.recommendation.price)} per accepted correction</Chip>
                  </div>
                  {i.recommendation.installed ? <p className="text-[13px] text-bad mt-2">Installed, but not for Harbor &amp; Pine Builders. Change its access to run it here.</p> : null}
                </div>
                <button className="btn btn-fn" onClick={() => setInstall(true)}>{i.recommendation.installed ? "Change access" : "Install for this issue"}</button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="text-[15px] font-semibold">No certified agent can check crew time yet</div>
              <p className="text-[13.5px] text-ink-2 max-w-[70ch]">Harbor &amp; Pine now counts toward the demand developers see on the Footnote agent platform. When a certified agent for this problem is published, it will be recommended here.</p>
              <div><button className="btn btn-secondary btn-sm" onClick={() => switchTo("u_ravi", "/developer")}>Demo: switch to Ravi, the SiteLog developer <Icon.Arrow size={14} /></button></div>
            </div>
          )
        ) : null}

        {i.status === "needs_approval" && p ? (
          <ProposalBlock p={p} i={i} state={state} tagProject={tagProject} setTagProject={setTagProject} />
        ) : null}

        {i.status === "needs_expert" && p?.type === "revenue" ? (
          <div className="flex flex-col gap-3">
            <div className="label">Footnote&apos;s draft treatment</div>
            <div className="rounded-xl border border-line bg-white p-4">
              <div className="text-[15px] font-semibold">{p.label}</div>
              <p className="text-[13.5px] text-ink-2 mt-1">{p.rationale}</p>
            </div>
            <p className="text-[13px] text-ink-2">Your policy sends revenue treatment to an accountant. They recommend; you approve and post.</p>
            <div><button className="btn btn-fn" onClick={() => setExpert(true)}><Icon.Expert size={16} /> Send to an accountant</button></div>
          </div>
        ) : null}

        {i.status === "with_expert" && i.case ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <span className="w-9 h-9 rounded-full bg-expert-soft text-expert flex items-center justify-center"><Icon.Expert size={18} /></span>
              <div>
                <div className="text-[15px] font-semibold">Case {i.case.id} is with {i.case.expertName}</div>
                <div className="text-[13px] text-ink-2">{i.case.expertFirm} · sent {relTime(i.case.created_at)} · {money(i.case.fee, { cents: false })}{i.case.platform_fee ? ` + ${money(i.case.platform_fee, { cents: false })} Intuit fee` : ""} · sees this case only</div>
              </div>
            </div>
            {i.case.messages.length ? (
              <ul className="flex flex-col gap-2">
                {i.case.messages.map((m) => (
                  <li key={m.id} className={`rounded-lg px-3 py-2 text-[13.5px] ${m.kind === "request" ? "bg-warn-soft" : "bg-white border border-line"}`}>
                    <span className="font-semibold">{m.from_name.split(",")[0]}</span> <span className="text-ink-3">to {m.to_name.split(",")[0]} · {relTime(m.created_at)}</span>
                    <div>{m.body}</div>
                  </li>
                ))}
              </ul>
            ) : null}
            {i.case.status === "info_requested" && i.case.messages.at(-1)?.to_name === "Priya Shah" ? (
              <div className="flex flex-col gap-2">
                <label htmlFor="reply" className="text-[13px] font-semibold">Reply to {i.case.expertName.split(",")[0]}</label>
                <textarea id="reply" rows={2} value={reply} onChange={(e) => setReply(e.target.value)} />
                <div><button className="btn btn-primary btn-sm" disabled={!reply.trim() || !!busy} onClick={async () => { if (await run("reply", { body: reply })) setReply(""); }}>Send reply</button></div>
              </div>
            ) : null}
            <div><button className="btn btn-secondary btn-sm" onClick={() => switchTo(i.case!.expert_id, "/expert/cases/" + i.case!.id)}>Demo: switch to {i.case.expertName.split(",")[0]} <Icon.Arrow size={14} /></button></div>
          </div>
        ) : null}

        {i.status === "expert_returned" && i.case?.recommendation?.type === "revenue" ? (
          <RecommendationBlock i={i} state={state} />
        ) : null}

        {["needs_approval", "expert_returned"].includes(i.status) && (p || i.case) ? (
          <div className="mt-4 flex flex-col gap-2">
            {rejecting ? (
              <div className="flex flex-col gap-2">
                <label htmlFor="reason" className="text-[13px] font-semibold">Why are you {i.status === "expert_returned" ? "declining" : "rejecting"} this? (optional)</label>
                <textarea id="reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
                <div className="flex gap-2">
                  <button className="btn btn-danger" disabled={!!busy} onClick={async () => { await run("reject", { reason }); setRejecting(false); }}>Confirm</button>
                  <button className="btn btn-secondary" onClick={() => setRejecting(false)}>Cancel</button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  className="btn btn-primary"
                  disabled={!!busy || (p?.type === "tag" && !tagProject)}
                  onClick={() => run("approve", p?.type === "tag" ? { projectId: tagProject } : undefined)}
                >
                  {busy === "approve" ? <Spinner size={14} /> : <Icon.Check size={16} />}
                  {p?.type === "attach_receipts" ? `Attach ${p.items.length} receipts` : p?.type === "tag" ? "Apply project" : "Approve and post"}
                </button>
                <button className="btn btn-secondary" onClick={() => setRejecting(true)}>{i.status === "expert_returned" ? "Decline" : "Reject"}</button>
                {p?.type === "reclass" ? <span className="text-[12.5px] text-ink-3">SiteLog is paid {i.recommendation ? money(i.recommendation.price) : "$6.00"} only if you approve.</span> : null}
              </div>
            )}
          </div>
        ) : null}

        {["auto_resolved", "resolved", "dismissed"].includes(i.status) ? (
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-[15px] font-semibold text-good"><Icon.Check size={18} /> {i.resolution ?? "Resolved"}</div>
              {i.status === "auto_resolved" ? <p className="text-[13px] text-ink-2 mt-1">{MODE.auto.hint}</p> : null}
              {p?.type === "attach_receipts" ? (
                <div className="flex flex-wrap gap-2 mt-3">
                  {p.items.map((it) => (
                    <a key={it.receiptId} href={`/api/files/${it.file}`} target="_blank" className="flex items-center gap-2 rounded-lg border border-line bg-white p-1.5 pr-3 hover:border-link" title={it.description}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={`/api/files/${it.file}`} alt="" className="h-10 w-8 object-cover rounded-sm" />
                      <span className="text-[12px] leading-tight"><span className="block font-medium truncate max-w-[140px]">{it.description.split(" ·")[0]}</span><span className="text-ink-3 num">{money(it.amount)}</span></span>
                    </a>
                  ))}
                </div>
              ) : null}
            </div>
            {(i.status === "auto_resolved" && i.kind === "receipts") || (i.status === "resolved" && i.kind === "missing_project") ? (
              <button className="btn btn-secondary btn-sm" disabled={!!busy} onClick={() => run("undo")}><Icon.Undo size={14} /> Undo</button>
            ) : null}
          </div>
        ) : null}

        {i.status === "batched" ? (
          <div className="text-[14px] text-ink-2">{MODE.minor.hint} It will be asked in Maya&apos;s Friday digest and stays visible here.</div>
        ) : null}
      </section>

      <section className="px-6 py-5 border-b border-line">
        <h3 className="label mb-3">What Footnote checked</h3>
        <ul className="flex flex-col gap-2.5">
          {i.checked.map((c, idx) => (
            <li key={idx} className="flex gap-3 text-[14px]">
              <span className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${c.ok === true ? "bg-good-soft text-good" : c.ok === false ? "bg-warn-soft text-warn" : "bg-line-2 text-ink-3"}`}>
                {c.ok === true ? <Icon.Check size={12} /> : c.ok === false ? <Icon.X size={11} /> : <Icon.Minus size={12} />}
              </span>
              <span className="min-w-0">
                <span className="font-semibold">{c.label}</span> <span className="text-[11.5px] text-ink-3 border border-line rounded px-1 ml-1">{c.source}</span>
                <span className="block text-ink-2 text-[13.5px]">{c.result}</span>
                {c.file ? <a href={`/api/files/${c.file}`} target="_blank" className="text-[12.5px] text-link hover:underline">View document</a> : null}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="px-6 py-5">
        <h3 className="label mb-3">Activity</h3>
        <ActivityList items={i.activity} />
      </section>

      {install && i.recommendation ? <InstallModal i={i} onClose={() => setInstall(false)} reload={reload} /> : null}
      {expert ? <ExpertModal i={i} state={state} onClose={() => setExpert(false)} reload={reload} /> : null}
    </article>
  );
}

function ProposalBlock({ p, i, state, tagProject, setTagProject }: { p: Proposal; i: IssueView; state: CloseState; tagProject: string; setTagProject: (v: string) => void }) {
  if (p.type === "attach_receipts") {
    return (
      <div>
        <div className="text-[15px] font-semibold">Attach {p.items.length} receipts found in the inbox?</div>
        <p className="text-[13px] text-ink-2 mt-1">Exact matches on amount, vendor and date. Your policy asks you to approve this.</p>
      </div>
    );
  }
  if (p.type === "tag") {
    return (
      <div className="flex flex-col gap-2">
        <div className="text-[15px] font-semibold">Choose the project for this purchase</div>
        <p className="text-[13.5px] text-ink-2">{p.basis}</p>
        <select aria-label="Project" value={tagProject} onChange={(e) => setTagProject(e.target.value)} className="max-w-[320px]">
          <option value="">Choose a project…</option>
          {state.projects.map((pr) => <option key={pr.id} value={pr.id}>{pr.name}</option>)}
        </select>
      </div>
    );
  }
  if (p.type === "reclass") {
    const weeks = [...new Set(i.timesheets.map((t) => t.week_start))];
    const workers = [...new Set(i.timesheets.map((t) => t.worker))];
    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <span className="w-7 h-7 rounded-md bg-[#2563EB] text-white text-[10px] font-bold flex items-center justify-center">SL</span>
          <span className="text-[15px] font-semibold">{p.agentName} proposes moving {money(p.total, { cents: false })} of labor</span>
        </div>
        <p className="text-[13.5px] text-ink-2">{p.reason}</p>
        <div>
          <div className="label mb-1.5">Evidence · approved SiteLog timesheets</div>
          <div className="overflow-x-auto rounded-lg border border-line bg-white">
            <table className="tbl">
              <thead><tr><th>Carpenter</th>{weeks.map((w) => <th key={w} className="!text-right">Week of {niceDate(w)}</th>)}<th>Site</th><th>Approved by</th></tr></thead>
              <tbody>
                {workers.map((w) => {
                  const rows = i.timesheets.filter((t) => t.worker === w);
                  return (
                    <tr key={w}>
                      <td className="!text-[13px] font-medium">{w}</td>
                      {weeks.map((wk) => <td key={wk} className="!text-[13px] text-right num">{rows.find((r) => r.week_start === wk)?.hours ?? "—"} h</td>)}
                      <td className="!text-[13px]">Oak Ave</td>
                      <td className="!text-[13px] text-ink-2">{rows[0]?.approved_by}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-[12.5px] text-ink-3 mt-1.5">Payroll PR-0930 charged all {p.moves.reduce((s, m) => s + m.hours, 0)} hours to Elm St at the allocated $80/hour loaded cost.</p>
        </div>
        <div>
          <div className="label mb-1.5">Journal entry IES will post</div>
          <JeTable lines={p.lines} projects={state.projects} />
          <p className="text-[12.5px] text-ink-3 mt-1.5">Moves cost between projects. Company direct labor stays the same.</p>
        </div>
      </div>
    );
  }
  return null;
}

function RecommendationBlock({ i, state }: { i: IssueView; state: CloseState }) {
  const r = i.case!.recommendation as Extract<Proposal, { type: "revenue" }>;
  const draft = i.case!.proposal as Extract<Proposal, { type: "revenue" }>;
  const changed = draft.treatment !== r.treatment;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <span className="w-9 h-9 rounded-full bg-expert-soft text-expert flex items-center justify-center"><Icon.Expert size={18} /></span>
        <div>
          <div className="text-[15px] font-semibold">{r.by} {changed ? "changed the treatment" : "agreed with the draft"}</div>
          <div className="text-[13px] text-ink-2">Case {i.case!.id} · returned {relTime(i.case!.returned_at)} · recommendation only; nothing is posted until you approve</div>
        </div>
      </div>
      <div className="rounded-xl border border-line bg-white p-4">
        {changed ? <div className="text-[13px] text-ink-3 line-through">{draft.label}</div> : null}
        <div className="text-[15px] font-semibold mt-0.5">{r.label}</div>
        <blockquote className="text-[14px] text-ink-2 mt-2 border-l-2 border-expert pl-3">“{r.rationale}”</blockquote>
        <div className="grid grid-cols-2 gap-3 mt-3 text-[13px]">
          <div className="rounded-lg bg-canvas p-3"><div className="text-ink-3">Lincoln revenue now</div><div className="text-[17px] font-semibold num">{money(draft.revenue, { cents: false })}</div></div>
          <div className="rounded-lg bg-canvas p-3"><div className="text-ink-3">After posting</div><div className="text-[17px] font-semibold num">{money(r.revenue, { cents: false })}</div></div>
        </div>
      </div>
      {r.lines.length ? (
        <div>
          <div className="label mb-1.5">Journal entry IES will post</div>
          <JeTable lines={r.lines} projects={state.projects} />
        </div>
      ) : <p className="text-[13px] text-ink-2">No entry needed: revenue stays as billed.</p>}
    </div>
  );
}

function InstallModal({ i, onClose, reload }: { i: IssueView; onClose: () => void; reload: () => Promise<void> }) {
  const act = useAction();
  const rec = i.recommendation!;
  const [entities, setEntities] = useState<string[]>(["hpb"]);
  const [busy, setBusy] = useState(false);
  const E = [
    { id: "hpb", name: "Harbor & Pine Builders", note: "Where the labor issue is" },
    { id: "prs", name: "Pine Ridge Services", note: "" },
    { id: "hpg", name: "Harbor & Pine Group", note: "Parent" },
  ];
  async function go() {
    setBusy(true);
    const r = await act(`/api/issues/${i.id}/install`, { agentId: rec.id, entities });
    await reload();
    setBusy(false);
    if (r.ok) onClose();
  }
  return (
    <Modal
      title={`Install ${rec.name}`}
      eyebrow={<span className="text-[12px] text-ink-3">IES App Store · by {rec.vendor}</span>}
      onClose={onClose}
      width={600}
      footer={<><button className="btn btn-secondary" onClick={onClose}>Cancel</button><button className="btn btn-fn" disabled={busy || !entities.length} onClick={go}>{busy ? <><Spinner size={14} /> Installing and running…</> : "Install and run on this issue"}</button></>}
    >
      <div className="flex flex-col gap-5 text-[14px]">
        <p className="text-ink-2">{rec.summary}</p>
        <div className="flex flex-wrap gap-1.5">
          <Chip tone="good"><Icon.Check size={11} /> Proving Ground {rec.passed}/{rec.total}</Chip>
          <Chip tone="good"><Icon.Shield size={11} /> Intuit security review</Chip>
        </div>
        <fieldset>
          <legend className="font-semibold mb-2">Which entities can it see?</legend>
          <div className="flex flex-col gap-2">
            {E.map((e) => {
              const on = entities.includes(e.id);
              return (
                <label key={e.id} className="flex items-center gap-2.5 cursor-pointer">
                  <input type="checkbox" checked={on} onChange={() => setEntities((v) => (on ? v.filter((x) => x !== e.id) : [...v, e.id]))} />
                  <span>{e.name}{e.note ? <span className="text-ink-3"> · {e.note}</span> : null}</span>
                </label>
              );
            })}
          </div>
        </fieldset>
        <div>
          <div className="font-semibold mb-2">What it can do</div>
          <div className="rounded-lg border border-line divide-y divide-line">
            <label className="flex gap-2.5 p-3 bg-fn-soft/60"><input type="radio" checked readOnly /><span><span className="font-semibold">Suggest only</span><span className="block text-[13px] text-ink-2">It proposes corrections with evidence. You approve; IES posts.</span></span></label>
            <label className="flex gap-2.5 p-3 text-ink-3"><input type="radio" disabled /><span><span className="font-semibold">Act within your policies</span><span className="block text-[13px]">Not available to partner agents yet.</span></span></label>
          </div>
        </div>
        <div>
          <div className="font-semibold mb-1.5">Data it will read</div>
          <ul className="flex flex-col gap-1 text-[13.5px] text-ink-2">
            {rec.can.map((c) => <li key={c} className="flex items-center gap-2"><Icon.Check size={13} className="text-good" /> {c}</li>)}
          </ul>
        </div>
        <div className="rounded-lg bg-canvas px-4 py-3 text-[13px] text-ink-2">
          <b className="text-ink">{money(rec.price)} per accepted correction</b>, billed on your Intuit invoice. Nothing is charged for proposals you reject. You can remove access in Policies at any time.
        </div>
      </div>
    </Modal>
  );
}

function ExpertModal({ i, state, onClose, reload }: { i: IssueView; state: CloseState; onClose: () => void; reload: () => Promise<void> }) {
  const act = useAction();
  const [who, setWho] = useState(state.experts.find((e) => e.own)?.id ?? state.experts[0]?.id ?? "");
  const [question, setQuestion] = useState("This is Builders' first milestone-billing contract. Should we recognize the $220,000 as billed, or measure progress by cost incurred? Please give the entry you'd make.");
  const [busy, setBusy] = useState(false);
  async function send() {
    setBusy(true);
    const r = await act(`/api/issues/${i.id}/send-to-expert`, { expertId: who, question });
    await reload();
    setBusy(false);
    if (r.ok) onClose();
  }
  return (
    <Modal
      title="Send to an accountant"
      eyebrow={<Chip tone="expert" dot>Expert-led</Chip>}
      onClose={onClose}
      width={620}
      footer={<><button className="btn btn-secondary" onClick={onClose}>Cancel</button><button className="btn btn-fn" disabled={busy || !question.trim() || !who} onClick={send}>{busy ? <><Spinner size={14} /> Preparing the case…</> : "Send case"}</button></>}
    >
      <div className="flex flex-col gap-5 text-[14px]">
        <fieldset className="flex flex-col gap-2">
          <legend className="font-semibold mb-2">Who should review it?</legend>
          {state.experts.map((e) => (
            <label key={e.id} className={`flex gap-3 p-3 rounded-lg border cursor-pointer ${who === e.id ? "border-fn bg-fn-soft/60" : "border-line"}`}>
              <input type="radio" name="expert" checked={who === e.id} onChange={() => setWho(e.id)} />
              <span>
                <span className="block font-semibold">{e.own ? `Your accountant · ${e.name}` : "Intuit Live Experts"}</span>
                <span className="block text-[13px] text-ink-2">{e.own ? `${e.firm} · usually 1 business day · $150 billed by the firm + $15 Intuit fee` : "Next available CPA · within 4 business hours · $195"}</span>
              </span>
            </label>
          ))}
        </fieldset>
        <div>
          <label htmlFor="q" className="font-semibold block mb-1.5">Your question</label>
          <textarea id="q" rows={3} value={question} onChange={(e) => setQuestion(e.target.value)} className="w-full" />
        </div>
        <div>
          <div className="font-semibold mb-1.5">What they&apos;ll see</div>
          <ul className="flex flex-col gap-1 text-[13.5px] text-ink-2">
            {["INV-1044 and the Lincoln School contract", "Lincoln's cost to date and estimated total cost", "What Footnote checked, and its draft treatment", "Your question"].map((x) => (
              <li key={x} className="flex items-center gap-2"><Icon.Check size={13} className="text-good" /> {x}</li>
            ))}
            <li className="flex items-center gap-2"><Icon.Lock size={13} className="text-ink-3" /> Nothing else in your books. Access ends when they return it.</li>
          </ul>
        </div>
      </div>
    </Modal>
  );
}

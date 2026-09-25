"use client";

import Link from "next/link";
import { useState } from "react";
import type { Check, JeLine, Proposal } from "@/lib/model";
import { Icon } from "@/components/icons";
import { AiTag, Chip, FnTag, Spinner } from "@/components/ui";
import { useAction } from "@/components/Toast";
import { usePoll } from "@/components/usePoll";
import { money, niceDate, niceDateTime, relTime } from "@/lib/format";

type Rev = Extract<Proposal, { type: "revenue" }>;
type Data = {
  case: { id: string; question: string; summary: string; ai_written: number; status: string; fee: number; created_at: string; returned_at: string | null; proposal: Rev; recommendation: Rev | null };
  issue: { id: string; title: string; summary: string; checked: Check[] };
  txn: { description: string; amount: number; date: string; ref: string | null; customer: string } | null;
  messages: { id: number; from_name: string; to_name: string; kind: string; body: string; created_at: string }[];
  createdBy: string;
  numbers: { billed: number; cost: number; estimate: number; contract: number; options: (Omit<Rev, "rationale" | "by">)[] };
};

const ACCOUNT: Record<string, string> = { a4000: "4000 Contract Revenue", a2450: "2450 Billings in Excess of Revenue" };
function Lines({ lines }: { lines: JeLine[] }) {
  if (!lines.length) return <p className="text-[13px] text-ink-2">No entry: revenue stays as billed.</p>;
  return (
    <table className="tbl rounded-lg border border-line">
      <thead><tr><th>Account</th><th className="!text-right">Debit</th><th className="!text-right">Credit</th></tr></thead>
      <tbody>{lines.map((l, i) => <tr key={i}><td className="!text-[13px]">{ACCOUNT[l.account] ?? l.account}{l.project ? " · Lincoln School Gym" : ""}</td><td className="!text-[13px] text-right num">{l.debit ? money(l.debit) : ""}</td><td className="!text-[13px] text-right num">{l.credit ? money(l.credit) : ""}</td></tr>)}</tbody>
    </table>
  );
}

export default function CaseReview({ id }: { id: string }) {
  const { data, reload } = usePoll<Data>(`/api/expert/cases/${id}`, 3000);
  const act = useAction();
  const [askTo, setAskTo] = useState("u_maya");
  const [ask, setAsk] = useState("Is the $1,100,000 estimated total cost for Lincoln School Gym still current?");
  const [treatment, setTreatment] = useState<string>("");
  const [rationale, setRationale] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  if (!data) return <div className="px-8 py-10 text-ink-3 flex items-center gap-2"><Spinner /> Loading the case…</div>;
  const c = data.case;
  const open = ["with_expert", "info_requested"].includes(c.status);
  const chosen = data.numbers.options.find((o) => o.treatment === (treatment || c.recommendation?.treatment || ""));
  const pctCost = data.numbers.cost / data.numbers.estimate;
  const pctBilled = data.numbers.billed / data.numbers.contract;

  async function post(action: string, body: unknown) {
    setBusy(action);
    const r = await act(`/api/expert/cases/${id}/${action}`, body);
    await reload();
    setBusy(null);
    return r.ok;
  }

  return (
    <div className="px-6 lg:px-8 py-6 max-w-[1240px] mx-auto">
      <div className="text-[13px]"><Link href="/expert" className="text-link hover:underline">Case files</Link> <span className="text-ink-3">/ {c.id}</span></div>
      <div className="flex flex-wrap items-end justify-between gap-3 mt-1">
        <div>
          <h1 className="text-[24px] font-semibold">{c.id} · Harbor &amp; Pine Builders</h1>
          <div className="text-[13.5px] text-ink-2">From {data.createdBy} (Controller) · {niceDateTime(c.created_at)} · {money(c.fee, { cents: false })}</div>
        </div>
        <Chip tone={open ? "warn" : "good"}>{c.status === "info_requested" ? "Waiting for information" : open ? "Needs your review" : c.status === "approved" ? "Approved and posted by the client" : "Returned to the client"}</Chip>
      </div>
      <div className="mt-2 text-[12.5px] text-ink-3 flex items-center gap-1.5"><Icon.Lock size={12} /> You can see this case and its evidence only. Access ends when you return it.</div>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_400px] gap-5 mt-5 items-start">
        <div className="flex flex-col gap-5">
          <section className="card p-5">
            <div className="label">The question</div>
            <p className="text-[17px] font-semibold mt-1.5 leading-snug">{c.question}</p>
          </section>

          <section className="card p-5">
            <div className="flex items-center justify-between gap-2">
              <div className="label">Case summary</div>
              {c.ai_written ? <AiTag label="Summarized by Claude from the evidence" /> : <FnTag label="Built from the evidence" />}
            </div>
            <div className="text-[14px] mt-2 whitespace-pre-line leading-relaxed">{c.summary}</div>
          </section>

          <section className="card p-5">
            <div className="label mb-3">The numbers</div>
            <div className="grid sm:grid-cols-3 gap-3">
              <div className="rounded-lg bg-canvas p-3"><div className="text-[12px] text-ink-3">Billed · INV-1044</div><div className="text-[18px] font-semibold num">{money(data.numbers.billed, { cents: false })}</div><div className="text-[12px] text-ink-2">{(pctBilled * 100).toFixed(1)}% of {money(data.numbers.contract, { cents: false })}</div></div>
              <div className="rounded-lg bg-canvas p-3"><div className="text-[12px] text-ink-3">Cost to date</div><div className="text-[18px] font-semibold num">{money(data.numbers.cost, { cents: false })}</div><div className="text-[12px] text-ink-2">{(pctCost * 100).toFixed(1)}% of {money(data.numbers.estimate, { cents: false })} estimate</div></div>
              <div className="rounded-lg bg-warn-soft p-3"><div className="text-[12px] text-warn">Conflict</div><div className="text-[14px] font-semibold mt-1">Billing is {((pctBilled - pctCost) * 100).toFixed(1)} pts ahead of cost progress</div></div>
            </div>
          </section>

          <section className="card p-5">
            <div className="label mb-3">Evidence Footnote gathered</div>
            <ul className="flex flex-col gap-2.5">
              {data.issue.checked.map((k, i) => (
                <li key={i} className="flex gap-3 text-[14px]">
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${k.ok === true ? "bg-good-soft text-good" : k.ok === false ? "bg-warn-soft text-warn" : "bg-line-2 text-ink-3"}`}>{k.ok === true ? <Icon.Check size={12} /> : k.ok === false ? <Icon.X size={11} /> : <Icon.Minus size={12} />}</span>
                  <span><span className="font-semibold">{k.label}</span><span className="block text-[13.5px] text-ink-2">{k.result}</span>{k.file ? <a href={`/api/files/${k.file}`} target="_blank" className="text-[12.5px] text-link hover:underline">Open the contract</a> : null}</span>
                </li>
              ))}
              {data.txn ? <li className="text-[13px] text-ink-3 pl-8">{data.txn.description} · {data.txn.customer} · {niceDate(data.txn.date)} · {money(data.txn.amount)}</li> : null}
            </ul>
          </section>

          <section className="card p-5">
            <div className="label mb-2">Footnote&apos;s draft treatment</div>
            <div className="text-[15px] font-semibold">{c.proposal.label}</div>
            <p className="text-[13.5px] text-ink-2 mt-1">{c.proposal.rationale}</p>
          </section>

          {data.messages.length ? (
            <section className="card p-5">
              <div className="label mb-3">Information requests</div>
              <ul className="flex flex-col gap-2">
                {data.messages.map((m) => (
                  <li key={m.id} className={`rounded-lg px-3 py-2 text-[14px] ${m.kind === "request" ? "bg-canvas" : "bg-good-soft"}`}>
                    <div className="text-[12px] text-ink-3">{m.from_name.split(",")[0]} → {m.to_name.split(",")[0]} · {relTime(m.created_at)}</div>
                    {m.body}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>

        <aside className="flex flex-col gap-5 lg:sticky lg:top-4">
          {open ? (
            <>
              <section className="card p-5">
                <h2 className="text-[16px] font-semibold">Ask for information</h2>
                <p className="text-[13px] text-ink-2 mt-1">They answer by text or in IES. The answer is added to this case.</p>
                <label htmlFor="to" className="block text-[13px] font-semibold mt-3 mb-1">Ask</label>
                <select id="to" value={askTo} onChange={(e) => setAskTo(e.target.value)} className="w-full">
                  <option value="u_maya">Maya Chen · Project manager, Lincoln (by text)</option>
                  <option value="u_priya">Priya Shah · Controller (in IES)</option>
                </select>
                <label htmlFor="ask" className="block text-[13px] font-semibold mt-3 mb-1">Question</label>
                <textarea id="ask" rows={3} value={ask} onChange={(e) => setAsk(e.target.value)} className="w-full" />
                <button className="btn btn-secondary mt-3" disabled={!ask.trim() || !!busy} onClick={() => post("request-info", { toUserId: askTo, message: ask })}>
                  {busy === "request-info" ? <Spinner size={14} /> : <Icon.Send size={15} />} Send question
                </button>
              </section>

              <section className="card p-5">
                <h2 className="text-[16px] font-semibold">Your recommendation</h2>
                <p className="text-[13px] text-ink-2 mt-1">Agree with the draft or change it. Priya approves and posts; you don&apos;t post anything.</p>
                <fieldset className="flex flex-col gap-2 mt-3">
                  <legend className="sr-only">Treatment</legend>
                  {data.numbers.options.map((o) => (
                    <label key={o.treatment} className={`flex gap-2.5 p-3 rounded-lg border cursor-pointer text-[13.5px] ${treatment === o.treatment ? "border-fn bg-fn-soft/60" : "border-line"}`}>
                      <input type="radio" name="treatment" checked={treatment === o.treatment} onChange={() => setTreatment(o.treatment)} className="mt-0.5" />
                      <span>
                        <span className="block font-medium">{o.label}</span>
                        <span className="block text-[12px] text-ink-3">{o.treatment === c.proposal.treatment ? "Same as Footnote's draft" : "Changes the draft"} · September revenue {money(o.revenue, { cents: false })}</span>
                      </span>
                    </label>
                  ))}
                </fieldset>
                {chosen && treatment ? <div className="mt-3"><div className="label mb-1.5">Entry Priya would post</div><Lines lines={chosen.lines} /></div> : null}
                <label htmlFor="why" className="block text-[13px] font-semibold mt-3 mb-1">Rationale for Priya</label>
                <textarea id="why" rows={4} value={rationale} onChange={(e) => setRationale(e.target.value)} className="w-full" placeholder="e.g. Performance is satisfied over time under ASC 606. Milestone billing runs ahead of the work, so measure progress by cost incurred, consistent with Builders' other contracts, and defer the excess as billings in excess of revenue." />
                <button className="btn btn-primary mt-3 w-full" disabled={!treatment || !rationale.trim() || !!busy} onClick={() => post("return", { treatment, rationale })}>
                  {busy === "return" ? <Spinner size={14} /> : <Icon.Check size={16} />} Return to Priya for approval
                </button>
              </section>
            </>
          ) : (
            <section className="card p-5">
              <div className="flex items-center gap-2 text-good font-semibold"><Icon.Check /> {c.status === "approved" ? "Approved and posted by Priya" : "Returned to Priya"}</div>
              {c.recommendation ? (
                <div className="mt-3 flex flex-col gap-2 text-[14px]">
                  <div className="font-semibold">{c.recommendation.label}</div>
                  <blockquote className="text-ink-2 border-l-2 border-expert pl-3">“{c.recommendation.rationale}”</blockquote>
                  <Lines lines={c.recommendation.lines} />
                </div>
              ) : null}
              <p className="text-[12.5px] text-ink-3 mt-3">Your recommendation is attached to Lincoln&apos;s revenue in Harbor &amp; Pine&apos;s books, with your name.</p>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}

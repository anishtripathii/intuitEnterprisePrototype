"use client";

import { useEffect, useState } from "react";
import type { DevState } from "@/lib/dev";
import type { AgentConfig } from "@/lib/costcheck";
import { Icon } from "@/components/icons";
import { Chip, Spinner } from "@/components/ui";
import { useAction } from "@/components/Toast";
import { usePoll } from "@/components/usePoll";
import { money, niceDateTime, relTime } from "@/lib/format";

const TABS = ["Discover", "Build", "Evaluate", "Publish", "Earn"] as const;
type Tab = (typeof TABS)[number];
const CATEGORIES = ["Correct results", "Missing data", "Conflicts", "Permissions", "Failure handling"];

function defaultTab(s: DevState): Tab {
  const a = s.agent;
  if (!a) return "Discover";
  if (a.status === "published") return "Earn";
  if (a.eval?.allPass && a.evalCurrent) return "Publish";
  if (a.eval) return "Evaluate";
  return "Build";
}

export default function DevWorkspace() {
  const { data, reload } = usePoll<DevState>("/api/dev", 4000);
  const act = useAction();
  const [tab, setTab] = useState<Tab | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [draft, setDraft] = useState<(AgentConfig & { name: string; summary: string; price: number }) | null>(null);

  useEffect(() => {
    if (data && !tab) setTab(defaultTab(data));
  }, [data, tab]);
  useEffect(() => {
    if (data?.agent && !draft) setDraft({ ...data.agent.config, name: data.agent.name, summary: data.agent.summary, price: data.agent.price });
  }, [data?.agent, draft]);

  if (!data || !tab) return <div className="px-8 py-10 text-ink-3 flex items-center gap-2"><Spinner /> Loading…</div>;
  const a = data.agent;
  const published = a?.status === "published";

  async function post(action: string, body?: unknown, quiet = false) {
    setBusy(action);
    const r = await act(`/api/dev/${action}`, body, { quiet });
    await reload();
    setBusy(null);
    return r;
  }
  async function create() {
    const r = await post("create");
    if (r.ok) setTab("Build");
  }
  async function save(thenEvaluate: boolean) {
    if (!draft) return;
    const r = await post("save", draft, thenEvaluate);
    if (r.ok && thenEvaluate) {
      setTab("Evaluate");
      await post("evaluate");
    }
  }

  const done: Record<Tab, boolean> = {
    Discover: !!a,
    Build: !!a?.eval,
    Evaluate: !!(a?.eval?.allPass && a.evalCurrent),
    Publish: !!published,
    Earn: data.usage.length > 0,
  };

  return (
    <div className="px-6 lg:px-8 py-6 max-w-[1200px] mx-auto">
      <div className="flex flex-wrap items-center gap-4">
        <span className="w-12 h-12 rounded-xl bg-[#2563EB] text-white font-bold flex items-center justify-center">SL</span>
        <div className="flex-1 min-w-[240px]">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-[24px] font-semibold">{a ? a.name : "SiteLog"}</h1>
            {a ? <Chip tone={published ? "good" : a.eval?.allPass && a.evalCurrent ? "fn" : "gray"}>{published ? "Live in the IES App Store" : a.eval?.allPass && a.evalCurrent ? "Evaluated · not published" : "Draft"}</Chip> : null}
          </div>
          <div className="text-[14px] text-ink-2">{a ? a.summary : "Field app for daily logs, photos and crew time · connected to IES"}</div>
        </div>
      </div>

      <nav className="mt-6 grid grid-cols-5 gap-1 rounded-xl bg-white border border-line p-1" aria-label="Steps">
        {TABS.map((t, i) => (
          <button key={t} onClick={() => setTab(t)} className={`rounded-lg px-3 py-2.5 text-left flex items-center gap-2 ${tab === t ? "bg-fn text-white" : "hover:bg-canvas"}`}>
            <span className={`w-6 h-6 rounded-full text-[11px] font-bold flex items-center justify-center shrink-0 ${done[t] ? (tab === t ? "bg-white text-fn" : "bg-good-soft text-good") : tab === t ? "bg-white/20" : "bg-line-2 text-ink-3"}`}>{done[t] ? <Icon.Check size={12} /> : i + 1}</span>
            <span className="text-[14px] font-semibold">{t}</span>
          </button>
        ))}
      </nav>

      <div className="mt-5">
        {tab === "Discover" ? (
          <section className="card overflow-hidden fn-in">
            <div className="p-5 border-b border-line">
              <h2 className="text-[18px] font-semibold">Demand board</h2>
              <p className="text-[14px] text-ink-2 mt-1 max-w-[80ch]">Problems IES customers&apos; close agents found but couldn&apos;t resolve this month. Build a certified agent for one, and Footnote recommends it to customers when the problem shows up in their books. <span className="text-ink-3">Counts across companies are sample data.</span></p>
            </div>
            <div className="overflow-x-auto">
              <table className="tbl">
                <thead><tr><th>Problem</th><th className="!text-right">Open issues</th><th className="!text-right">Companies</th><th className="!text-right">Certified agents</th><th /></tr></thead>
                <tbody>
                  {data.demand.map((d) => (
                    <tr key={d.key} className={d.buildable ? "bg-fn-soft/30" : ""}>
                      <td className="max-w-[420px]">
                        <div className="font-semibold">{d.problem}</div>
                        <div className="text-[12.5px] text-ink-2">{d.example}</div>
                        {d.includesYou ? <Chip tone="fn" className="mt-1">Harbor &amp; Pine Builders is waiting now</Chip> : null}
                      </td>
                      <td className="text-right num">{d.openIssues.toLocaleString()}</td>
                      <td className="text-right num">{d.companies}</td>
                      <td className="text-right num">{d.agents}</td>
                      <td className="text-right">
                        {d.buildable ? (
                          a ? <button className="btn btn-secondary btn-sm" onClick={() => setTab("Build")}>Open {a.name}</button> : <button className="btn btn-fn btn-sm" disabled={!!busy} onClick={create}>{busy === "create" ? <Spinner size={13} /> : <Icon.Plus size={14} />} Build an agent for this</button>
                        ) : <span className="text-[12px] text-ink-3">Other developers</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        {tab === "Build" ? (
          !a || !draft ? (
            <section className="card p-8 text-center fn-in">
              <p className="text-ink-2">Start from the demand board: pick a problem and create an agent from a template.</p>
              <button className="btn btn-fn mt-3" onClick={() => setTab("Discover")}>Go to the demand board</button>
            </section>
          ) : (
            <div className="grid lg:grid-cols-[minmax(0,1fr)_340px] gap-5 items-start fn-in">
              <div className="flex flex-col gap-5">
                <section className="card p-5">
                  <div className="label">Template</div>
                  <div className="mt-1.5 text-[15px] font-semibold">Reconciliation agent</div>
                  <p className="text-[13.5px] text-ink-2">Compares two sources of truth. For each difference it proposes a correction with evidence, abstains when data is missing, or escalates when sources conflict.</p>
                  <div className="grid sm:grid-cols-2 gap-3 mt-4">
                    <label className="text-[13px] font-semibold">Name<input type="text" disabled={published} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className="mt-1 w-full font-normal" /></label>
                    <label className="text-[13px] font-semibold">Price per accepted correction<span className="flex items-center gap-1 mt-1 font-normal">$<input type="number" min={0} step={1} disabled={published} value={draft.price} onChange={(e) => setDraft({ ...draft, price: Number(e.target.value) })} className="w-full" /></span></label>
                  </div>
                  <label className="block text-[13px] font-semibold mt-3">What it does<textarea rows={2} disabled={published} value={draft.summary} onChange={(e) => setDraft({ ...draft, summary: e.target.value })} className="mt-1 w-full font-normal" /></label>
                </section>

                <section className="card p-5">
                  <div className="label">Permissions it asks customers for</div>
                  <p className="text-[13px] text-ink-2 mt-1">Customers see exactly this list before installing. The Proving Ground fails agents that ask for more than they use.</p>
                  <ul className="mt-3 flex flex-col divide-y divide-line border border-line rounded-lg">
                    {data.catalog.map((p) => {
                      const on = draft.permissions.includes(p.key);
                      return (
                        <li key={p.key}>
                          <label className="flex gap-3 p-3 cursor-pointer">
                            <input type="checkbox" disabled={published} checked={on} onChange={() => setDraft({ ...draft, permissions: on ? draft.permissions.filter((x) => x !== p.key) : [...draft.permissions, p.key] })} className="mt-1" />
                            <span className="flex-1">
                              <span className="font-semibold text-[14px]">{p.label}</span> <Chip tone={p.kind === "write" ? "warn" : "gray"} className="!text-[10.5px] ml-1">{p.kind}</Chip>
                              <span className="block text-[12.5px] text-ink-2">{p.detail}</span>
                            </span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                </section>

                <section className="card p-5">
                  <div className="label">Behavior</div>
                  <label className="flex items-center gap-2 mt-3 text-[14px]">Flag differences over <input type="number" min={0} disabled={published} value={draft.toleranceHours} onChange={(e) => setDraft({ ...draft, toleranceHours: Number(e.target.value) })} className="w-20 !py-1" /> hours per person</label>
                  {([
                    ["abstainUnapproved", "Abstain when timesheets aren't approved yet", "Don't propose anything from time a foreman hasn't signed off."],
                    ["escalateConflicts", "Escalate when SiteLog and IES time disagree", "Hand it to a person instead of picking a side."],
                    ["retryOnTimeout", "Retry once if SiteLog times out", "Then abstain if it still fails."],
                  ] as const).map(([k, t, d]) => (
                    <label key={k} className="flex gap-3 mt-3 cursor-pointer">
                      <input type="checkbox" disabled={published} checked={draft[k]} onChange={(e) => setDraft({ ...draft, [k]: e.target.checked })} className="mt-1" />
                      <span><span className="font-semibold text-[14px]">{t}</span><span className="block text-[12.5px] text-ink-2">{d}</span></span>
                    </label>
                  ))}
                </section>
              </div>

              <aside className="flex flex-col gap-5 lg:sticky lg:top-4">
                <section className="card p-5">
                  <div className="label">Tools the platform provides</div>
                  <ul className="mt-2 flex flex-col gap-1.5 font-mono text-[12.5px] text-ink-2">
                    {["projects.list()", "payroll.laborAllocations(period)", "sitelog.timesheets(period)", "evidence.attach(issue, rows)", "proposals.reclass(lines)", "review.request(reason)"].map((x) => <li key={x}>{x}</li>)}
                  </ul>
                  <p className="text-[12.5px] text-ink-3 mt-3">Every call is scoped to the entities a customer approved and logged on the issue&apos;s activity trail.</p>
                </section>
                {published ? (
                  <div className="card p-5 text-[13.5px] text-ink-2">This version is live. Editing a live agent isn&apos;t part of the prototype.</div>
                ) : (
                  <section className="card p-5 flex flex-col gap-2">
                    <button className="btn btn-fn" disabled={!!busy} onClick={() => save(true)}>{busy === "evaluate" || busy === "save" ? <Spinner size={14} /> : <Icon.Beaker size={16} />} Save and run the Proving Ground</button>
                    <button className="btn btn-secondary" disabled={!!busy} onClick={() => save(false)}>Save draft</button>
                  </section>
                )}
              </aside>
            </div>
          )
        ) : null}

        {tab === "Evaluate" ? <Evaluate data={data} busy={busy} onRun={() => post("evaluate")} goBuild={() => setTab("Build")} goPublish={() => setTab("Publish")} /> : null}

        {tab === "Publish" ? (
          !a ? <section className="card p-8 text-center text-ink-2">Build an agent first.</section> : (
            <div className="grid lg:grid-cols-[minmax(0,1fr)_380px] gap-5 items-start fn-in">
              <div className="flex flex-col gap-4">
                <Gate
                  n={1} title="Proving Ground evaluation" ok={!!(a.eval?.allPass && a.evalCurrent)}
                  detail={a.eval?.allPass && a.evalCurrent ? `${a.eval.passed}/${a.eval.total} cases passed · ${niceDateTime(a.eval.ranAt)}` : a.eval && !a.evalCurrent ? "Results are for an older version. Run it again." : "Not passed yet."}
                  action={!(a.eval?.allPass && a.evalCurrent) ? <button className="btn btn-secondary btn-sm" onClick={() => setTab("Evaluate")}>Go to Evaluate</button> : null}
                />
                <Gate
                  n={2} title="Security and permissions review" ok={a.security?.status === "approved"}
                  detail={a.security ? `${a.security.note} Approved ${relTime(a.security.at)}.` : "A separate check by Intuit: requested scopes, data handling and where data goes. Passing the evaluation doesn't skip it. (Simulated here.)"}
                  action={!a.security && !published ? <button className="btn btn-secondary btn-sm" disabled={!!busy || !(a.eval?.allPass && a.evalCurrent)} onClick={() => post("security")}>{busy === "security" ? <Spinner size={13} /> : <Icon.Shield size={14} />} Submit for review</button> : null}
                />
                <Gate
                  n={3} title="Publish to the IES App Store" ok={!!published}
                  detail={published ? `Live since ${niceDateTime(a.published_at)}. Customers see it when a matching issue appears in their close.` : "Customers are recommended the agent on matching issues. They install it with suggestion-only access."}
                  action={!published ? <button className="btn btn-fn btn-sm" disabled={!!busy || a.security?.status !== "approved" || !(a.eval?.allPass && a.evalCurrent)} onClick={() => post("publish")}>{busy === "publish" ? <Spinner size={13} /> : <Icon.Store size={14} />} Publish</button> : null}
                />
              </div>
              <aside className="card p-5">
                <div className="label mb-3">What customers will see</div>
                <div className="flex gap-3">
                  <span className="w-10 h-10 rounded-lg bg-[#2563EB] text-white font-bold flex items-center justify-center shrink-0">SL</span>
                  <div>
                    <div className="font-semibold">{a.name}</div>
                    <div className="text-[12.5px] text-ink-3">by SiteLog</div>
                  </div>
                </div>
                <p className="text-[13.5px] text-ink-2 mt-2">{a.summary}</p>
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {a.eval?.allPass && a.evalCurrent ? <Chip tone="good">Proving Ground {a.eval.passed}/{a.eval.total}</Chip> : null}
                  {a.security?.status === "approved" ? <Chip tone="good">Security reviewed</Chip> : null}
                  <Chip>{money(a.price)} per accepted correction</Chip>
                </div>
                <div className="text-[12.5px] text-ink-3 mt-3">Asks for: {a.permissions.map((p) => data.catalog.find((c) => c.key === p)?.label).join(" · ")}</div>
              </aside>
            </div>
          )
        ) : null}

        {tab === "Earn" ? (
          <div className="flex flex-col gap-5 fn-in">
            <div className="grid sm:grid-cols-4 gap-3">
              {[
                ["Active installs", String(data.installs.filter((i) => !i.revoked_at).length)],
                ["Accepted results", String(data.usage.length)],
                ["Billed to customers", money(data.usage.reduce((s, u) => s + u.amount, 0))],
                ["Your share (80%)", money(data.usage.reduce((s, u) => s + u.dev_share, 0))],
              ].map(([k, v]) => (
                <div key={k} className="card p-4"><div className="text-[12.5px] text-ink-3">{k}</div><div className="text-[24px] font-semibold num">{v}</div></div>
              ))}
            </div>
            <section className="card overflow-hidden">
              <div className="p-5 border-b border-line">
                <h2 className="text-[16px] font-semibold">Usage</h2>
                <p className="text-[13.5px] text-ink-2">You&apos;re paid only when a customer approves a result. Rejected proposals cost them nothing and pay nothing.</p>
              </div>
              {data.usage.length ? (
                <table className="tbl">
                  <thead><tr><th>When</th><th>Customer</th><th>Result</th><th className="!text-right">Billed</th><th className="!text-right">Your share</th></tr></thead>
                  <tbody>{data.usage.map((u) => <tr key={u.id}><td className="text-ink-2">{relTime(u.created_at)}</td><td>{u.company}</td><td>{u.detail}</td><td className="text-right num">{money(u.amount)}</td><td className="text-right num font-semibold">{money(u.dev_share)}</td></tr>)}</tbody>
                </table>
              ) : (
                <div className="p-6 text-[13.5px] text-ink-3">{published ? "Live. Nothing accepted yet: when a customer approves one of CostCheck's corrections, it appears here." : "Publish the agent to start earning."}</div>
              )}
            </section>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Gate({ n, title, ok, detail, action }: { n: number; title: string; ok: boolean; detail: string; action: React.ReactNode }) {
  return (
    <section className={`card p-5 flex gap-4 items-start ${ok ? "border-good/40" : ""}`}>
      <span className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 font-bold text-[13px] ${ok ? "bg-good text-white" : "bg-line-2 text-ink-3"}`}>{ok ? <Icon.Check size={15} /> : n}</span>
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-[15px]">{title}</div>
        <p className="text-[13.5px] text-ink-2 mt-0.5">{detail}</p>
      </div>
      {action}
    </section>
  );
}

function Evaluate({ data, busy, onRun, goBuild, goPublish }: { data: DevState; busy: string | null; onRun: () => void; goBuild: () => void; goPublish: () => void }) {
  const a = data.agent;
  const [showAll, setShowAll] = useState(false);
  if (!a) return <section className="card p-8 text-center text-ink-2">Build an agent first.</section>;
  const ev = a.eval;
  const failed = ev?.results.filter((r) => !r.pass) ?? [];
  const unapprovedFail = failed.some((f) => f.id === "M1" || f.id === "M2");
  const rows = ev ? (showAll ? ev.results : [...failed, ...ev.results.filter((r) => r.pass)].slice(0, Math.max(8, failed.length))) : [];
  return (
    <div className="flex flex-col gap-5 fn-in">
      <section className="card p-5 flex flex-wrap items-center gap-4">
        <span className="w-11 h-11 rounded-xl bg-fn-soft text-fn flex items-center justify-center"><Icon.Beaker size={20} /></span>
        <div className="flex-1 min-w-[260px]">
          <h2 className="text-[17px] font-semibold">Proving Ground</h2>
          <p className="text-[13.5px] text-ink-2">24 synthetic cases across 5 categories, run against a multi-entity sandbox company. Every category must pass before the agent can be published.</p>
        </div>
        <button className="btn btn-fn" disabled={!!busy || a.status === "published"} onClick={onRun}>{busy === "evaluate" ? <><Spinner size={14} /> Running 24 cases…</> : <><Icon.Play size={14} /> {ev ? "Run again" : "Run the Proving Ground"}</>}</button>
      </section>

      {ev ? (
        <>
          {!a.evalCurrent ? <div className="rounded-lg bg-warn-soft text-warn px-4 py-3 text-[13.5px]">You changed the agent after this run. Run it again to evaluate the current version.</div> : null}
          <div className="grid sm:grid-cols-5 gap-3">
            {CATEGORIES.map((c) => {
              const rs = ev.results.filter((r) => r.category === c);
              const p = rs.filter((r) => r.pass).length;
              const ok = p === rs.length;
              return (
                <div key={c} className={`card p-4 ${ok ? "" : "border-bad/40 bg-bad-soft/40"}`}>
                  <div className="text-[12.5px] text-ink-2">{c}</div>
                  <div className={`text-[22px] font-semibold num ${ok ? "text-good" : "text-bad"}`}>{p}/{rs.length}</div>
                </div>
              );
            })}
          </div>
          {ev.allPass && a.evalCurrent ? (
            <div className="rounded-xl bg-good-soft px-5 py-4 flex flex-wrap items-center justify-between gap-3">
              <div className="text-good font-semibold flex items-center gap-2"><Icon.Check /> All {ev.total} cases passed. Ready for review and publishing.</div>
              <button className="btn btn-primary btn-sm" onClick={goPublish}>Continue to Publish <Icon.Arrow size={14} /></button>
            </div>
          ) : unapprovedFail ? (
            <div className="rounded-xl border border-bad/30 bg-bad-soft/50 px-5 py-4 flex flex-wrap items-center justify-between gap-3">
              <div className="text-[14px]">
                <div className="font-semibold text-bad">The agent proposed corrections from timesheets nobody approved.</div>
                <div className="text-ink-2">A customer would see a confident correction built on unapproved data. Turn on “Abstain when timesheets aren&apos;t approved yet”.</div>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={goBuild}>Fix in Build</button>
            </div>
          ) : failed.length ? (
            <div className="rounded-xl border border-bad/30 bg-bad-soft/50 px-5 py-4 flex items-center justify-between gap-3 text-[14px]"><span className="font-semibold text-bad">{failed.length} case{failed.length > 1 ? "s" : ""} failed. Adjust the agent and run again.</span><button className="btn btn-secondary btn-sm" onClick={goBuild}>Back to Build</button></div>
          ) : null}
          <section className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="tbl">
                <thead><tr><th>Case</th><th>Category</th><th>Scenario</th><th>Expected</th><th>Agent did</th><th>Result</th></tr></thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className={r.pass ? "" : "bg-bad-soft/40"}>
                      <td className="font-mono text-[12.5px]">{r.id}</td>
                      <td className="text-[13px] text-ink-2 whitespace-nowrap">{r.category}</td>
                      <td className="text-[13.5px]">{r.title}</td>
                      <td className="text-[13px]">{r.expected}</td>
                      <td className="text-[13px]">{r.got}</td>
                      <td>{r.pass ? <Chip tone="good">Pass</Chip> : <Chip tone="bad">Fail</Chip>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!showAll && ev.results.length > rows.length ? <button className="w-full py-2.5 text-[13px] text-link hover:bg-canvas border-t border-line" onClick={() => setShowAll(true)}>Show all {ev.results.length} cases</button> : null}
          </section>
        </>
      ) : null}
    </div>
  );
}

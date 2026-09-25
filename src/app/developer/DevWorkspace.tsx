"use client";

import { useEffect, useState } from "react";
import type { DevState } from "@/lib/dev";
import type { AgentConfig } from "@/lib/costcheck";
import { Icon } from "@/components/icons";
import { Chip, Spinner } from "@/components/ui";
import { useAction } from "@/components/Toast";
import { usePoll } from "@/components/usePoll";
import { money, niceDateTime, relTime } from "@/lib/format";

const TABS = ["Discover", "Build", "Test & publish", "Earn"] as const;
type Tab = (typeof TABS)[number];
const CATEGORIES = ["Correct results", "Missing data", "Conflicts", "Permissions", "Failure handling"];

function defaultTab(s: DevState): Tab {
  const a = s.agent;
  if (!a) return "Discover";
  if (a.status === "published") return "Earn";
  if (a.eval) return "Test & publish";
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
      setTab("Test & publish");
      await post("evaluate");
    }
  }
  // Intuit's security review and publishing are two gates, run one after the other here.
  async function publishAgent() {
    if (!a?.security) {
      const r = await post("security", undefined, true);
      if (!r.ok) return;
    }
    await post("publish");
  }

  const done: Record<Tab, boolean> = {
    Discover: !!a,
    Build: !!a?.eval,
    "Test & publish": !!published,
    Earn: data.usage.length > 0,
  };

  return (
    <div className="px-6 lg:px-8 py-6 max-w-[1200px] mx-auto" data-agent={a?.status}>
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

      <nav className="mt-6 grid grid-cols-4 gap-1 rounded-xl bg-white border border-line p-1" aria-label="Steps" role="tablist">
        {TABS.map((t, i) => (
          <button key={t} onClick={() => setTab(t)} data-tab={t} role="tab" aria-selected={tab === t} className={`rounded-lg px-3 py-2.5 text-left flex items-center gap-2 ${tab === t ? "bg-fn text-white" : "hover:bg-canvas"}`}>
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
                    <tr key={d.key} className={d.buildable ? "bg-fn-soft/30" : ""} data-tour={d.buildable ? "demand" : undefined}>
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
                          a ? <button className="btn btn-secondary btn-sm" onClick={() => setTab("Build")}>Open {a.name}</button> : <button className="btn btn-fn btn-sm" disabled={!!busy} onClick={create} data-tour="build-agent">{busy === "create" ? <Spinner size={13} /> : <Icon.Plus size={14} />} Build an agent for this</button>
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
            <div className="grid lg:grid-cols-[minmax(0,1fr)_320px] gap-5 items-start fn-in">
              <div className="flex flex-col gap-5" data-tour="build">
                <section className="card p-5">
                  <div className="label">Template</div>
                  <div className="mt-1.5 text-[15px] font-semibold">Reconciliation agent</div>
                  <p className="text-[13.5px] text-ink-2">Compares two sources of truth, here SiteLog crew time and payroll. For each difference it proposes a fix with evidence.</p>
                  <label className="block text-[13px] font-semibold mt-4 max-w-[260px]">Price per accepted fix<span className="flex items-center gap-1 mt-1 font-normal">$<input type="number" min={0} step={1} disabled={published} value={draft.price} onChange={(e) => setDraft({ ...draft, price: Number(e.target.value) })} className="w-full" /></span></label>
                  <p className="text-[12.5px] text-ink-3 mt-1">Customers pay only when they accept a fix. You keep 80%.</p>
                </section>

                <section className="card p-5">
                  <div className="label">What it can read and do</div>
                  <p className="text-[13px] text-ink-2 mt-1">Customers see exactly this list before they install it.</p>
                  <ul className="mt-3 flex flex-col gap-2">
                    {data.catalog.filter((p) => draft.permissions.includes(p.key)).map((p) => (
                      <li key={p.key} className="flex gap-2.5 text-[14px]">
                        <Icon.Check size={15} className="text-good mt-0.5 shrink-0" />
                        <span><span className="font-semibold">{p.label}</span> <span className="text-ink-2 text-[13px]">· {p.detail}</span></span>
                      </li>
                    ))}
                  </ul>
                  <p className="text-[12.5px] text-ink-3 mt-3">It can&apos;t read bank data or post entries. The customer approves; IES posts.</p>
                </section>

                <section className="card p-5">
                  <div className="label">Behavior</div>
                  {([
                    ["abstainUnapproved", "Skip timesheets that aren't approved yet", "Don't suggest anything from time a foreman hasn't signed off."],
                    ["escalateConflicts", "Hand conflicts to a person", "When SiteLog and IES disagree, don't pick a side."],
                  ] as const).map(([k, t, d]) => (
                    <label key={k} className="flex gap-3 mt-3 cursor-pointer">
                      <input type="checkbox" disabled={published} checked={draft[k]} onChange={(e) => setDraft({ ...draft, [k]: e.target.checked })} className="mt-1" data-tour={k === "abstainUnapproved" ? "abstain" : undefined} />
                      <span><span className="font-semibold text-[14px]">{t}</span><span className="block text-[12.5px] text-ink-2">{d}</span></span>
                    </label>
                  ))}
                </section>
              </div>

              <aside className="flex flex-col gap-5 lg:sticky lg:top-4">
                {published ? (
                  <div className="card p-5 text-[13.5px] text-ink-2">This version is live. Editing a live agent isn&apos;t part of the prototype.</div>
                ) : (
                  <section className="card p-5 flex flex-col gap-2">
                    <button className="btn btn-fn" disabled={!!busy} onClick={() => save(true)} data-tour="run-tests">{busy === "evaluate" || busy === "save" ? <Spinner size={14} /> : <Icon.Beaker size={16} />} Save and run the tests</button>
                    <p className="text-[12.5px] text-ink-3">24 practice cases check it before any customer can install it.</p>
                  </section>
                )}
                <section className="card p-5">
                  <div className="label">Tools the platform provides</div>
                  <ul className="mt-2 flex flex-col gap-1.5 font-mono text-[12.5px] text-ink-2">
                    {["payroll.laborAllocations(period)", "sitelog.timesheets(period)", "evidence.attach(issue, rows)", "proposals.reclass(lines)"].map((x) => <li key={x}>{x}</li>)}
                  </ul>
                </section>
              </aside>
            </div>
          )
        ) : null}

        {tab === "Test & publish" ? <Evaluate data={data} busy={busy} onRun={() => post("evaluate")} goBuild={() => setTab("Build")} onPublish={publishAgent} /> : null}

        {tab === "Earn" ? (
          <div className="flex flex-col gap-5 fn-in" data-tour="earn">
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

function Gate({ title, ok, detail }: { title: string; ok: boolean; detail: string }) {
  return (
    <li className="flex gap-3 items-start">
      <span className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${ok ? "bg-good text-white" : "bg-line-2 text-ink-3"}`}>{ok ? <Icon.Check size={13} /> : <Icon.Minus size={13} />}</span>
      <span><span className="font-semibold text-[14px] block">{title}</span><span className="text-[13px] text-ink-2">{detail}</span></span>
    </li>
  );
}

function Evaluate({ data, busy, onRun, goBuild, onPublish }: { data: DevState; busy: string | null; onRun: () => void; goBuild: () => void; onPublish: () => void }) {
  const a = data.agent;
  const [showAll, setShowAll] = useState(false);
  if (!a) return <section className="card p-8 text-center text-ink-2">Build an agent first.</section>;
  const ev = a.eval;
  const published = a.status === "published";
  const passed = !!(ev?.allPass && a.evalCurrent);
  const failed = ev?.results.filter((r) => !r.pass) ?? [];
  const unapprovedFail = failed.some((f) => f.id === "M1" || f.id === "M2");
  const rows = ev ? (showAll ? ev.results : failed) : [];
  return (
    <div className="flex flex-col gap-5 fn-in">
      <section className="card p-5 flex flex-wrap items-center gap-4">
        <span className="w-11 h-11 rounded-xl bg-fn-soft text-fn flex items-center justify-center"><Icon.Beaker size={20} /></span>
        <div className="flex-1 min-w-[260px]">
          <h2 className="text-[17px] font-semibold">Proving Ground</h2>
          <p className="text-[13.5px] text-ink-2">24 practice cases in 5 groups, run on a sample company. Every group must pass before the agent can be published.</p>
        </div>
        {!published ? <button className="btn btn-secondary" disabled={!!busy} onClick={onRun}>{busy === "evaluate" ? <><Spinner size={14} /> Running 24 cases…</> : <><Icon.Play size={14} /> {ev ? "Run again" : "Run the tests"}</>}</button> : null}
      </section>

      {ev ? (
        <div className="flex flex-col gap-4" data-tour={passed ? "test-passed" : "test-results"}>
          {!a.evalCurrent ? <div className="rounded-lg bg-warn-soft text-warn px-4 py-3 text-[13.5px]">You changed the agent after this run. Run the tests again.</div> : null}
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
          {passed ? (
            <section className="card p-5 grid md:grid-cols-[minmax(0,1fr)_auto] gap-5 items-center">
              <ul className="flex flex-col gap-3">
                <Gate title={`All ${ev.total} test cases passed`} ok detail="The agent is right, or it steps aside when it isn't sure." />
                <Gate title="Intuit security review" ok={a.security?.status === "approved"} detail={a.security ? "Approved. It asks only for the data it needs." : "A separate check of what data it reads and where it goes. Runs when you publish (simulated here)."} />
                <Gate title="Live in the IES App Store" ok={published} detail={published ? `Since ${niceDateTime(a.published_at)}. Customers see it when this problem shows up in their close.` : "Customers are offered it on matching issues, with suggest-only access."} />
              </ul>
              {published ? (
                <div className="flex items-center gap-2 text-good font-semibold" data-tour="published"><Icon.Check /> Published</div>
              ) : (
                <button className="btn btn-fn" disabled={!!busy} onClick={onPublish} data-tour="publish">{busy === "security" || busy === "publish" ? <><Spinner size={14} /> Publishing…</> : <><Icon.Store size={15} /> Publish</>}</button>
              )}
            </section>
          ) : unapprovedFail ? (
            <div className="rounded-xl border border-bad/30 bg-bad-soft/50 px-5 py-4 flex flex-wrap items-center justify-between gap-3">
              <div className="text-[14px]">
                <div className="font-semibold text-bad">2 cases failed: it suggested fixes from timesheets nobody approved.</div>
                <div className="text-ink-2">A customer would get a confident fix built on unapproved data. Turn on “Skip timesheets that aren&apos;t approved yet”.</div>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={goBuild} data-tour="fix-in-build">Fix in Build</button>
            </div>
          ) : failed.length ? (
            <div className="rounded-xl border border-bad/30 bg-bad-soft/50 px-5 py-4 flex items-center justify-between gap-3 text-[14px]"><span className="font-semibold text-bad">{failed.length} case{failed.length > 1 ? "s" : ""} failed. Adjust the agent and run again.</span><button className="btn btn-secondary btn-sm" onClick={goBuild} data-tour="fix-in-build">Back to Build</button></div>
          ) : null}
          {rows.length ? (
            <section className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="tbl">
                  <thead><tr><th>Case</th><th>Group</th><th>Scenario</th><th>Expected</th><th>Agent did</th><th>Result</th></tr></thead>
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
            </section>
          ) : null}
          {!showAll ? <button className="self-start text-[13px] text-link hover:underline" onClick={() => setShowAll(true)}>See all {ev.results.length} cases</button> : null}
        </div>
      ) : null}
    </div>
  );
}

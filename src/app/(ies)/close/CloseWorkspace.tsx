"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { FootnoteLogo, Icon } from "@/components/icons";
import { Chip, MODE, Spinner, statusInfo } from "@/components/ui";
import Readiness from "@/components/Readiness";
import { useAction } from "@/components/Toast";
import { usePoll } from "@/components/usePoll";
import { money, relTime } from "@/lib/format";
import IssuePanel from "./IssuePanel";
import PoliciesDrawer from "./PoliciesDrawer";
import { issueCtx, type CloseState, type Step } from "./shared";

const GROUPS: { key: string; label: string }[] = [
  { key: "you", label: "Needs you" },
  { key: "waiting", label: "In progress" },
  { key: "done", label: "Resolved" },
  { key: "small", label: "Won't block the review" },
];

const ENTITIES = [
  { id: "hpb", name: "Harbor & Pine Builders", note: "4 active projects" },
  { id: "prs", name: "Pine Ridge Services", note: "No projects" },
  { id: "hpg", name: "Harbor & Pine Group", note: "Parent" },
];

export default function CloseWorkspace({ initialIssue }: { initialIssue: string | null }) {
  const { data, reload } = usePoll<CloseState>("/api/close", 2500);
  const act = useAction();
  const [selected, setSelected] = useState<string | null>(initialIssue);
  const [policiesOpen, setPoliciesOpen] = useState(false);
  const [animateLog, setAnimateLog] = useState(false);
  const [goal, setGoal] = useState("Prepare September's project-cost review for the leadership review on Oct 2. Make sure every project's margin is complete and correct.");
  const [entities, setEntities] = useState<string[]>(["hpb"]);
  const [starting, setStarting] = useState(false);
  const endAnimation = useCallback(() => setAnimateLog(false), []);

  useEffect(() => {
    if (data?.run && !selected) setSelected("log");
  }, [data?.run, selected]);

  const select = useCallback((id: string) => {
    setSelected(id);
    const url = new URL(window.location.href);
    if (id === "log") url.searchParams.delete("issue");
    else url.searchParams.set("issue", id);
    window.history.replaceState(null, "", url);
  }, []);

  async function start() {
    setStarting(true);
    const r = await act("/api/close/start", { goal, entities }, { quiet: true });
    if (r.ok) {
      setAnimateLog(true);
      setSelected("log");
      await reload();
    }
    setStarting(false);
  }

  if (!data) {
    return <div className="px-8 py-10 text-ink-3 flex items-center gap-2"><Spinner /> Loading the close workspace…</div>;
  }

  const current = data.issues.find((i) => i.id === selected) ?? null;
  const youCount = data.issues.filter((i) => statusInfo(i.status, issueCtx(i)).group === "you").length;

  return (
    <div className="px-6 lg:px-8 py-6 max-w-[1380px]">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-[13px] text-ink-3"><FootnoteLogo size={14} /> Close workspace</div>
          <h1 className="text-[26px] font-semibold leading-tight mt-1">September close</h1>
          <div className="text-[14px] text-ink-2 mt-0.5">Project-cost review for the leadership review on Thursday, Oct 2</div>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn btn-secondary" onClick={() => setPoliciesOpen(true)}><Icon.Sliders size={16} /> Policies</button>
          <Link href="/reports" className="btn btn-secondary"><Icon.Doc size={16} /> Project margins</Link>
        </div>
      </div>

      <div className="mt-5">
        <Readiness r={animateLog ? { ...data.readiness, reviewed: false, blockers: [], approvals: { applied: 0, awaiting: 0, expertSigned: 0, approvedByYou: 0 } } : data.readiness} onSelect={select} />
      </div>

      {!data.run ? (
        <section className="card mt-5 p-6 lg:p-8 grid lg:grid-cols-[1.4fr_1fr] gap-8 fn-in">
          <div>
            <div className="flex items-center gap-2"><FootnoteLogo size={18} /><h2 className="text-[20px] font-semibold">What should Footnote work on?</h2></div>
            <label htmlFor="goal" className="block text-[13px] font-semibold mt-5 mb-1.5">Goal</label>
            <textarea id="goal" rows={3} value={goal} onChange={(e) => setGoal(e.target.value)} className="w-full text-[15px] leading-relaxed" />
            <fieldset className="mt-4">
              <legend className="text-[13px] font-semibold mb-1.5">Entities</legend>
              <div className="flex flex-wrap gap-2">
                {ENTITIES.map((e) => {
                  const on = entities.includes(e.id);
                  return (
                    <label key={e.id} className={`flex items-center gap-2 rounded-lg border px-3 py-2 cursor-pointer text-[13.5px] ${on ? "border-fn bg-fn-soft" : "border-line hover:border-ink-3"}`}>
                      <input type="checkbox" checked={on} onChange={() => setEntities((v) => (on ? v.filter((x) => x !== e.id) : [...v, e.id]))} />
                      <span><span className="font-semibold">{e.name}</span> <span className="text-ink-3">· {e.note}</span></span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
            <div className="mt-6 flex items-center gap-3">
              <button className="btn btn-fn h-10 px-5 text-[15px]" onClick={start} disabled={starting || !goal.trim() || !entities.length}>
                {starting ? <><Spinner size={15} /> Starting…</> : <><Icon.Play size={15} /> Start review</>}
              </button>
              <span className="text-[12.5px] text-ink-3">Takes a few seconds. You can change what Footnote may do in Policies.</span>
            </div>
          </div>
          <div className="rounded-xl bg-canvas p-5">
            <div className="label">How Footnote works on this</div>
            <ul className="mt-3 flex flex-col gap-3 text-[14px]">
              {[
                ["Checks the books and connected sources", "Transactions, projects, payroll, receipts and SiteLog daily logs."],
                ["Acts on its own only where you allow it", "Like attaching an exact-match receipt. Nothing that changes amounts or treatment."],
                ["Asks a person only when the evidence runs out", "One text to whoever knows. No login for them."],
                ["Brings you the decisions", "With the evidence already assembled, and an accountant or a specialist agent when needed."],
              ].map(([t, d]) => (
                <li key={t} className="flex gap-3">
                  <span className="w-5 h-5 rounded-full bg-fn-soft text-fn flex items-center justify-center shrink-0 mt-0.5"><Icon.Check size={12} /></span>
                  <span><span className="font-semibold block">{t}</span><span className="text-ink-2 text-[13px]">{d}</span></span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : (
        <div className="grid lg:grid-cols-[340px_minmax(0,1fr)] gap-5 mt-5 items-start">
          <nav className="card overflow-hidden lg:sticky lg:top-4" aria-label="Issues">
            <button onClick={() => select("log")} className={`w-full text-left px-4 py-3 border-b border-line flex items-center gap-3 ${selected === "log" ? "bg-fn-soft" : "hover:bg-canvas"}`}>
              <span className="w-8 h-8 rounded-lg bg-fn text-white flex items-center justify-center shrink-0"><Icon.Spark size={16} /></span>
              <span className="min-w-0">
                <span className="block text-[14px] font-semibold">Footnote&apos;s investigation</span>
                <span className="block text-[12px] text-ink-3">{data.steps.length} steps · started {relTime(data.run.started_at)}</span>
              </span>
            </button>
            {animateLog ? (
              <div className="px-4 py-6 text-[13px] text-ink-3 flex items-center gap-2"><Spinner size={13} /> Issues appear when the investigation finishes</div>
            ) : null}
            {!animateLog && GROUPS.map((g) => {
              const items = data.issues.filter((i) => statusInfo(i.status, issueCtx(i)).group === g.key);
              if (!items.length) return null;
              return (
                <div key={g.key}>
                  <div className="px-4 pt-3 pb-1.5 label flex items-center justify-between">{g.label}{g.key === "you" ? <span className="text-fn">{youCount}</span> : null}</div>
                  {items.map((i) => {
                    const s = statusInfo(i.status, issueCtx(i));
                    const on = selected === i.id;
                    return (
                      <button key={i.id} onClick={() => select(i.id)} className={`w-full text-left px-4 py-2.5 flex gap-3 border-l-[3px] ${on ? "bg-fn-soft border-fn" : "border-transparent hover:bg-canvas"}`}>
                        <span className={`w-2 h-2 rounded-full mt-[7px] shrink-0 ${i.material ? (g.key === "done" ? "bg-qb" : "bg-warn") : "bg-line"}`} title={i.material ? "Material" : "Not material"} />
                        <span className="min-w-0 flex-1">
                          <span className={`block text-[13.5px] leading-snug ${g.key === "done" ? "text-ink-2" : "font-semibold text-ink"}`}>{i.title}</span>
                          <span className="mt-1 flex flex-wrap items-center gap-1.5">
                            <Chip tone={s.tone} className="!text-[11px] !px-2">{s.label}</Chip>
                            <span className="text-[11.5px] text-ink-3">{MODE[i.mode]?.label}</span>
                          </span>
                        </span>
                        <span className="text-[12.5px] num text-ink-2 whitespace-nowrap">{i.kind === "labor" && !i.proposal ? "≈ " : ""}{money(i.amount, { cents: false })}</span>
                      </button>
                    );
                  })}
                </div>
              );
            })}
            <div className="h-2" />
          </nav>

          <div className="min-w-0">
            {selected === "log" || !current ? (
              <Investigation steps={data.steps} goal={data.run.goal} animate={animateLog} onDone={endAnimation} onNext={() => {
                const first = data.issues.find((i) => statusInfo(i.status, issueCtx(i)).group === "you") ?? data.issues[0];
                if (first) select(first.id);
              }} youCount={youCount} />
            ) : (
              <IssuePanel key={current.id} issue={current} state={data} reload={reload} />
            )}
          </div>
        </div>
      )}
      {policiesOpen ? <PoliciesDrawer state={data} onClose={() => setPoliciesOpen(false)} reload={reload} /> : null}
    </div>
  );
}

const SOURCE_ICON: Record<string, (p: { size?: number }) => React.ReactNode> = {
  Transactions: Icon.Doc, Connections: Icon.Link, "Receipts inbox": Icon.Camera, "Transactions · Projects": Icon.Search,
  "Payroll · SiteLog": Icon.User, "Invoices · Contracts": Icon.Doc, Footnote: Icon.Spark,
};

function Investigation({ steps, goal, animate, onDone, onNext, youCount }: { steps: Step[]; goal: string; animate: boolean; onDone: () => void; onNext: () => void; youCount: number }) {
  const [shown, setShown] = useState(animate ? 0 : steps.length);
  useEffect(() => {
    if (!animate) {
      setShown(steps.length);
      return;
    }
    if (shown >= steps.length) {
      onDone();
      return;
    }
    const t = setTimeout(() => setShown((n) => n + 1), shown === 0 ? 350 : 750);
    return () => clearTimeout(t);
  }, [animate, shown, steps.length, onDone]);
  const running = shown < steps.length;

  return (
    <section className="card">
      <div className="px-6 pt-5 pb-4 border-b border-line">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-[19px] font-semibold flex items-center gap-2">Footnote&apos;s investigation {running ? <span className="text-fn"><Spinner size={15} /></span> : null}</h2>
          <Chip tone={running ? "fn" : "good"}>{running ? "Working…" : "Finished"}</Chip>
        </div>
        <p className="text-[13.5px] text-ink-2 mt-1.5"><span className="font-semibold text-ink">Goal:</span> {goal}</p>
      </div>
      <ol className="px-6 py-5 flex flex-col gap-4">
        {steps.slice(0, Math.max(shown, 0)).map((s) => {
          const I = SOURCE_ICON[s.source] ?? Icon.Search;
          const last = s.label === "Summary";
          return (
            <li key={s.seq} className={`flex gap-3.5 ${animate ? "fn-in" : ""}`}>
              <span className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${last ? "bg-fn text-white" : s.outcome === "issue" ? "bg-warn-soft text-warn" : s.outcome === "info" ? "bg-line-2 text-ink-2" : "bg-good-soft text-good"}`}>
                {last ? <Icon.Spark size={15} /> : <I size={15} />}
              </span>
              <div className="min-w-0 pt-0.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[14.5px] font-semibold">{s.label}</span>
                  {!last ? <span className="text-[11.5px] text-ink-3 border border-line rounded px-1.5">{s.source}</span> : null}
                </div>
                <p className="text-[13.5px] text-ink-2 mt-0.5 leading-relaxed">{s.detail}</p>
              </div>
            </li>
          );
        })}
        {running ? <li className="flex items-center gap-3 text-[13px] text-ink-3 pl-1"><Spinner size={14} /> Checking…</li> : null}
      </ol>
      {!running ? (
        <div className="px-6 pb-6 flex flex-wrap items-center gap-3">
          <button className="btn btn-fn" onClick={onNext}>{youCount ? `Review the ${youCount} item${youCount === 1 ? "" : "s"} that need you` : "Review the issues"} <Icon.Arrow size={15} /></button>
          <span className="text-[12.5px] text-ink-3">Everything Footnote did is listed on each issue, with the policy that allowed it.</span>
        </div>
      ) : null}
    </section>
  );
}

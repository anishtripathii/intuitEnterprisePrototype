"use client";

import Link from "next/link";
import { useState } from "react";
import type { ReportData } from "@/lib/report";
import { FootnoteLogo, Icon } from "@/components/icons";
import { ActivityList, Chip, FnTag, Spinner } from "@/components/ui";
import { Drawer } from "@/components/Modal";
import Readiness from "@/components/Readiness";
import { usePoll } from "@/components/usePoll";
import { money, niceDate } from "@/lib/format";

const pct = (n: number | null | undefined) => (n === null || n === undefined ? "—" : `${(n * 100).toFixed(1)}%`);

function Delta({ now, before }: { now: number | null; before: number | null | undefined }) {
  if (now === null || before === null || before === undefined) return <span className="text-ink-3">—</span>;
  const d = (now - before) * 100;
  if (Math.abs(d) < 0.05) return <span className="text-ink-3">no change</span>;
  return <span className={`font-semibold ${d < 0 ? "text-bad" : "text-good"}`}>{d > 0 ? "+" : "−"}{Math.abs(d).toFixed(1)} pts</span>;
}

export default function ProjectMargins() {
  const { data } = usePoll<ReportData>("/api/report", 4000);
  const [open, setOpen] = useState<string | null>(null);
  if (!data) return <div className="px-8 py-10 text-ink-3 flex items-center gap-2"><Spinner /> Loading the report…</div>;
  const row = data.rows.find((r) => r.projectId === open) ?? null;
  const t = data.totals;

  return (
    <div className="px-6 lg:px-8 py-6 max-w-[1320px]">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[13px] text-ink-3">Reports · Projects</div>
          <h1 className="text-[26px] font-semibold leading-tight mt-1">Project margins</h1>
          <div className="text-[14px] text-ink-2 mt-0.5">Harbor &amp; Pine Builders · September 2026 · for the leadership review on Oct 2</div>
        </div>
        <Link href="/close" className="btn btn-secondary"><FootnoteLogo size={14} /> Close workspace</Link>
      </div>

      <div className="mt-5"><Readiness r={data.readiness} linkBase="/close" /></div>

      <section className="card mt-5 p-5 border-fn/30">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="label">Note for Marcus Hale, CFO</div>
          {data.note.ai ? <FnTag label="Drafted by Claude from the activity trail" /> : <FnTag label="Drafted from the activity trail" />}
        </div>
        <p className="text-[15px] leading-relaxed mt-2 max-w-[95ch]">{data.note.text}</p>
      </section>

      <section className="card mt-5 overflow-hidden" data-tour="report">
        <div className="overflow-x-auto">
          <table className="tbl">
            <thead>
              <tr>
                <th>Project</th>
                <th className="!text-right">Revenue</th>
                <th className="!text-right">Job cost</th>
                <th className="!text-right">{data.reviewed ? "Margin at review start" : "Margin"}</th>
                {data.reviewed ? <th className="!text-right">Margin now</th> : null}
                {data.reviewed ? <th className="!text-right">Change</th> : null}
                <th>Why</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r) => (
                <tr key={r.projectId} className="row-click" onClick={() => setOpen(r.projectId)}>
                  <td>
                    <div className="font-semibold text-link">{r.name}</div>
                    <div className="text-[12px] text-ink-3">PM {r.pm}</div>
                  </td>
                  <td className="text-right num">{money(r.revenue, { cents: false })}</td>
                  <td className="text-right num">{money(r.cost, { cents: false })}</td>
                  <td className="text-right num">{pct(data.reviewed ? r.before?.pct : r.pct)}</td>
                  {data.reviewed ? <td className="text-right num font-semibold text-[15px]">{pct(r.pct)}</td> : null}
                  {data.reviewed ? <td className="text-right num"><Delta now={r.pct} before={r.before?.pct} /></td> : null}
                  <td className="max-w-[360px]">
                    {r.reasons.length ? (
                      <ul className="text-[12.5px] text-ink-2 flex flex-col gap-0.5">{r.reasons.map((w, i) => <li key={i}>{w.text}</li>)}</ul>
                    ) : r.open.some((o) => o.material) ? (
                      <Chip tone="warn">Open issue</Chip>
                    ) : data.reviewed ? (
                      <span className="text-[12.5px] text-good flex items-center gap-1"><Icon.Check size={13} /> Checked, no issues</span>
                    ) : (
                      <span className="text-[12.5px] text-ink-3">Not reviewed</span>
                    )}
                    {r.reasons.length && r.open.some((o) => o.material) ? <Chip tone="warn" className="mt-1">Still has an open issue</Chip> : null}
                  </td>
                </tr>
              ))}
              {data.unassigned.now || data.unassigned.before ? (
                <tr>
                  <td><div className="font-semibold">Not assigned to a project</div><div className="text-[12px] text-ink-3">Job costs with no project</div></td>
                  <td />
                  <td className="text-right num">{money(data.unassigned.now, { cents: false })}</td>
                  <td className="text-right num text-ink-3">{data.reviewed ? money(data.unassigned.before ?? 0, { cents: false }) : ""}</td>
                  {data.reviewed ? <td /> : null}
                  {data.reviewed ? <td /> : null}
                  <td className="text-[12.5px] text-ink-2">{data.unassigned.now ? "Waiting to be assigned" : "Assigned"}</td>
                </tr>
              ) : null}
              <tr className="bg-canvas">
                <td className="font-semibold">Builders total</td>
                <td className="text-right num font-semibold">{money(t.now.revenue, { cents: false })}</td>
                <td className="text-right num font-semibold">{money(t.now.cost, { cents: false })}</td>
                <td className="text-right num font-semibold">{pct(data.reviewed ? t.before?.pct : t.now.pct)}</td>
                {data.reviewed ? <td className="text-right num font-semibold">{pct(t.now.pct)}</td> : null}
                {data.reviewed ? <td className="text-right num"><Delta now={t.now.pct} before={t.before?.pct} /></td> : null}
                <td className="text-[12.5px] text-ink-2">
                  Direct labor {money(t.now.labor, { cents: false })}{t.before ? (Math.abs(t.now.labor - t.before.labor) < 1 ? ", unchanged" : "") : ""}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 text-[12.5px] text-ink-3 border-t border-line">Posted transactions only. Click a project for its evidence and action history.</div>
      </section>

      <div className="grid lg:grid-cols-2 gap-5 mt-5">
        <section className="card p-5">
          <h2 className="label mb-3">Still open</h2>
          {!data.reviewed ? <p className="text-[13.5px] text-ink-3">Nothing reviewed yet.</p> : data.open.length ? (
            <ul className="flex flex-col gap-2">
              {data.open.map((o) => (
                <li key={o.id}>
                  <Link href={`/close?issue=${o.id}`} className="flex items-center justify-between gap-3 rounded-lg border border-line px-3 py-2 hover:border-link">
                    <span className="text-[13.5px]">{o.title}</span>
                    <Chip tone={o.material ? "warn" : "gray"}>{o.material ? "Material" : "Won't block"}</Chip>
                  </Link>
                </li>
              ))}
            </ul>
          ) : <p className="text-[13.5px] text-good flex items-center gap-1.5"><Icon.Check size={15} /> Nothing open</p>}
        </section>
        <section className="card p-5">
          <h2 className="label mb-3">Recent activity</h2>
          <ActivityList items={data.history.slice(0, 6)} compact />
        </section>
      </div>

      {row ? (
        <Drawer
          title={row.name}
          eyebrow={<FnTag label="Evidence and action history" />}
          onClose={() => setOpen(null)}
          width={640}
        >
          <div className="flex flex-col gap-6">
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg border border-line p-3"><div className="text-[12px] text-ink-3">Margin now</div><div className="text-[22px] font-semibold num">{pct(row.pct)}</div></div>
              <div className="rounded-lg border border-line p-3"><div className="text-[12px] text-ink-3">At review start</div><div className="text-[22px] font-semibold num">{pct(row.before?.pct)}</div></div>
              <div className="rounded-lg border border-line p-3"><div className="text-[12px] text-ink-3">Revenue · cost</div><div className="text-[14px] font-semibold num mt-1.5">{money(row.revenue, { cents: false })} · {money(row.cost, { cents: false })}</div></div>
            </div>
            {row.reasons.length ? (
              <section>
                <h3 className="label mb-2">Why it moved</h3>
                <ul className="flex flex-col gap-1.5 text-[14px]">{row.reasons.map((w, i) => <li key={i} className="flex gap-2"><Icon.Arrow size={14} className="text-fn mt-1 shrink-0" /> {w.text}</li>)}</ul>
              </section>
            ) : null}
            <section>
              <h3 className="label mb-3">What was done to this number</h3>
              <ActivityList items={data.history.filter((h) => h.project_id === row.projectId || (h.issue_id && row.reasons.some((w) => w.issueId === h.issue_id))).reverse()} />
            </section>
            <section>
              <h3 className="label mb-2">What makes up the number</h3>
              <div className="rounded-lg border border-line overflow-hidden">
                <table className="tbl">
                  <tbody>
                    {data.projectTxns[row.projectId]?.map((x) => (
                      <tr key={x.id}>
                        <td className="!text-[12.5px] text-ink-3 whitespace-nowrap">{niceDate(x.date)}</td>
                        <td className="!text-[13px]"><div>{x.description}</div><div className="text-[11.5px] text-ink-3">{x.account}</div></td>
                        <td className="!text-[12px]">{x.receipt ? <a href={`/api/files/${x.receipt}`} target="_blank" className="text-link inline-flex items-center gap-1"><Icon.Camera size={12} /> Receipt</a> : x.source === "journal" ? <span className="text-fn">Adjustment</span> : null}</td>
                        <td className="!text-[13px] text-right num whitespace-nowrap">{money(x.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </Drawer>
      ) : null}
    </div>
  );
}

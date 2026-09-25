"use client";

import Link from "next/link";
import { Icon } from "@/components/icons";
import { Chip, FnTag, Spinner } from "@/components/ui";
import { usePoll } from "@/components/usePoll";
import { money, relTime } from "@/lib/format";

type Row = { id: string; question: string; status: string; fee: number; created_at: string; returned_at: string | null; decided_at: string | null };

const STATUS: Record<string, { label: string; tone: "warn" | "fn" | "good" | "gray" }> = {
  with_expert: { label: "Needs your review", tone: "warn" },
  info_requested: { label: "Waiting for information", tone: "fn" },
  returned: { label: "Returned · awaiting client approval", tone: "gray" },
  approved: { label: "Approved and posted by client", tone: "good" },
  declined: { label: "Declined by client", tone: "gray" },
};

export default function ExpertHome() {
  const { data } = usePoll<Row[]>("/api/expert/cases", 3000);
  return (
    <div className="px-6 lg:px-8 py-6 max-w-[1100px] mx-auto">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[26px] font-semibold">Case files</h1>
          <p className="text-[14px] text-ink-2 mt-0.5">Scoped cases from your clients&apos; books. You see the case and its evidence, nothing else.</p>
        </div>
        <FnTag label="Footnote expert review" />
      </div>
      <section className="card mt-5 overflow-hidden">
        {!data ? (
          <div className="p-6 text-ink-3 flex items-center gap-2"><Spinner /> Loading…</div>
        ) : !data.length ? (
          <div className="p-8 text-center">
            <div className="w-12 h-12 rounded-full bg-canvas text-ink-3 flex items-center justify-center mx-auto"><Icon.Mail /></div>
            <div className="font-semibold mt-3">No cases yet</div>
            <p className="text-[13.5px] text-ink-2 mt-1">When a client sends you a question from their close, it arrives here with the evidence attached.</p>
          </div>
        ) : (
          <table className="tbl">
            <thead><tr><th>Case</th><th>Client</th><th>Question</th><th>Status</th><th className="!text-right">Fee</th><th /></tr></thead>
            <tbody>
              {data.map((c) => (
                <tr key={c.id}>
                  <td className="whitespace-nowrap"><div className="font-semibold">{c.id}</div><div className="text-[12px] text-ink-3">{relTime(c.created_at)}</div></td>
                  <td className="text-[13.5px]">Harbor &amp; Pine Builders</td>
                  <td className="max-w-[380px] text-[13.5px]"><div className="line-clamp-2">{c.question}</div></td>
                  <td><Chip tone={STATUS[c.status]?.tone ?? "gray"}>{STATUS[c.status]?.label ?? c.status}</Chip></td>
                  <td className="text-right num">{money(c.fee, { cents: false })}</td>
                  <td><Link href={`/expert/cases/${c.id}`} className={`btn btn-sm ${["with_expert", "info_requested"].includes(c.status) ? "btn-primary" : "btn-secondary"}`}>{["with_expert", "info_requested"].includes(c.status) ? "Open case" : "View"}</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

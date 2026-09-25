import { Icon } from "./icons";
import { money, relTime } from "@/lib/format";

export type ReadinessData = {
  reviewed: boolean;
  ready: boolean;
  reviewDate: string;
  materiality: number;
  blockers: { id: string; title: string; status: string; amount: number }[];
  minorOpen: number;
  sources: { name: string; at: string | null; state: string }[];
  approvals: { applied: number; awaiting: number; expertSigned: number; approvedByYou: number };
};

const WAITING: Record<string, string> = {
  waiting_person: "waiting on a person",
  needs_agent: "needs a specialist agent",
  needs_approval: "needs your approval",
  needs_expert: "needs an accountant",
  with_expert: "with the accountant",
  expert_returned: "recommendation ready",
};

// Replaces v1's "% final": whether the review can go ahead, what blocks it, and how fresh each source is.
export default function Readiness({ r, onSelect, linkBase }: { r: ReadinessData; onSelect?: (id: string) => void; linkBase?: string }) {
  const tone = !r.reviewed ? "text-ink-2" : r.ready ? "text-good" : "text-warn";
  const Item = ({ b }: { b: ReadinessData["blockers"][number] }) => {
    const inner = (
      <>
        <span className="min-w-0 truncate text-ink">{b.title}</span>
        <span className="text-ink-3 whitespace-nowrap">· {WAITING[b.status] ?? b.status}</span>
      </>
    );
    return onSelect ? (
      <button onClick={() => onSelect(b.id)} className="w-full flex items-baseline gap-1.5 text-left text-[13px] hover:underline decoration-dotted">{inner}</button>
    ) : (
      <a href={`${linkBase ?? "/close"}?issue=${b.id}`} className="w-full flex items-baseline gap-1.5 text-[13px] hover:underline decoration-dotted">{inner}</a>
    );
  };
  return (
    <section className="card grid md:grid-cols-[1fr_1.4fr_1fr] divide-y md:divide-y-0 md:divide-x divide-line" aria-label="Readiness" data-tour="readiness">
      <div className="p-4">
        <div className="label">Ready for the Oct 2 review?</div>
        <div className={`mt-1.5 flex items-center gap-2 text-[18px] font-semibold ${tone}`}>
          {!r.reviewed ? <Icon.Clock size={18} /> : r.ready ? <Icon.Check size={18} /> : <Icon.Alert size={18} />}
          {!r.reviewed ? "Not reviewed yet" : r.ready ? "Yes, ready" : "Not yet"}
        </div>
        <div className="text-[12.5px] text-ink-2 mt-1">
          {!r.reviewed ? "Start the review to find what's missing." : r.ready ? `Nothing material is open${r.minorOpen ? ` · ${r.minorOpen} small item batched` : ""}.` : `${r.blockers.length} material item${r.blockers.length === 1 ? "" : "s"} over ${money(r.materiality, { cents: false })} open`}
        </div>
      </div>
      <div className="p-4 min-w-0">
        <div className="label">Material blockers</div>
        <div className="mt-2 flex flex-col gap-1.5">
          {!r.reviewed ? <span className="text-[13px] text-ink-3">Found by the review</span> : r.blockers.length ? r.blockers.slice(0, 3).map((b) => <Item key={b.id} b={b} />) : <span className="text-[13px] text-good font-medium">None</span>}
        </div>
      </div>
      <div className="p-4">
        <div className="label">Data last updated</div>
        <ul className="mt-2 flex flex-col gap-1 text-[12.5px]">
          {r.sources.map((s) => (
            <li key={s.name} className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${s.state === "fresh" ? "bg-qb" : "bg-warn"}`} />
              <span className="text-ink">{s.name}</span>
              <span className="text-ink-3 ml-auto whitespace-nowrap">{s.state === "fresh" && s.at ? relTime(s.at) : "not shared"}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

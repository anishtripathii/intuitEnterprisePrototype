import { FootnoteLogo, Icon } from "./icons";
import { niceDateTime, relTime } from "@/lib/format";

export function Avatar({ initials, color, size = 28 }: { initials: string; color: string; size?: number }) {
  return (
    <span className="inline-flex items-center justify-center rounded-full text-white font-semibold shrink-0" style={{ width: size, height: size, background: color, fontSize: size * 0.4 }}>
      {initials}
    </span>
  );
}

export function FnTag({ label = "Footnote", className = "" }: { label?: string; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full bg-fn-soft text-fn px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap ${className}`}>
      <FootnoteLogo size={12} />
      {label}
    </span>
  );
}

export function AiTag({ label = "AI" }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-fn-soft text-fn px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap">
      <Icon.Spark size={11} />
      {label}
    </span>
  );
}

type Tone = "good" | "warn" | "bad" | "fn" | "expert" | "gray" | "blue" | "fnStrong";
const TONES: Record<Tone, string> = {
  good: "bg-good-soft text-good",
  warn: "bg-warn-soft text-warn",
  bad: "bg-bad-soft text-bad",
  fn: "bg-fn-soft text-fn",
  fnStrong: "bg-fn text-white",
  expert: "bg-expert-soft text-expert",
  gray: "bg-line-2 text-ink-2",
  blue: "bg-[#e7f0fb] text-link",
};

export function Chip({ tone = "gray", children, className = "", dot = false }: { tone?: Tone; children: React.ReactNode; className?: string; dot?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[12px] font-semibold whitespace-nowrap ${TONES[tone]} ${className}`}>
      {dot ? <span className="w-1.5 h-1.5 rounded-full bg-current" /> : null}
      {children}
    </span>
  );
}

export const MODE: Record<string, { label: string; tone: Tone; hint: string }> = {
  auto: { label: "Autonomous", tone: "good", hint: "Footnote acts on its own within your policy. Nothing about amounts or treatment changes." },
  ask: { label: "Asked the source", tone: "gray", hint: "The evidence wasn't enough, so Footnote asked the person who knows." },
  assisted: { label: "Assisted", tone: "fn", hint: "An agent proposes a change with evidence. You approve before anything posts." },
  expert: { label: "Expert-led", tone: "expert", hint: "An accountant recommends. You approve and post." },
  minor: { label: "Small item", tone: "gray", hint: "Under your materiality limit. Batched so it doesn't interrupt anyone." },
};

export function ModeChip({ mode }: { mode: string }) {
  const m = MODE[mode] ?? MODE.minor;
  return <Chip tone={m.tone} dot>{m.label}</Chip>;
}

export function statusInfo(status: string, ctx: { asked?: string; expert?: string; caseStatus?: string }) {
  switch (status) {
    case "auto_resolved": return { label: "Done by Footnote", tone: "good" as Tone, group: "done" };
    case "resolved": return { label: "Resolved", tone: "good" as Tone, group: "done" };
    case "dismissed": return { label: "Dismissed", tone: "gray" as Tone, group: "done" };
    case "waiting_person": return { label: `Waiting on ${ctx.asked ?? "a person"}`, tone: "warn" as Tone, group: "waiting" };
    case "needs_agent": return { label: "Needs a specialist agent", tone: "fn" as Tone, group: "you" };
    case "needs_approval": return { label: "Needs your approval", tone: "fnStrong" as Tone, group: "you" };
    case "needs_expert": return { label: "Needs an accountant", tone: "expert" as Tone, group: "you" };
    case "with_expert": return ctx.caseStatus === "info_requested"
      ? { label: `${ctx.expert ?? "Expert"} asked for info`, tone: "warn" as Tone, group: "waiting" }
      : { label: `With ${ctx.expert ?? "the expert"}`, tone: "warn" as Tone, group: "waiting" };
    case "expert_returned": return { label: "Recommendation ready", tone: "fnStrong" as Tone, group: "you" };
    case "batched": return { label: "Batched · won't block", tone: "gray" as Tone, group: "small" };
    default: return { label: status, tone: "gray" as Tone, group: "waiting" };
  }
}

export function StatusChip({ status, ctx = {} }: { status: string; ctx?: { asked?: string; expert?: string; caseStatus?: string } }) {
  const s = statusInfo(status, ctx);
  return <Chip tone={s.tone}>{s.label}</Chip>;
}

export function Spinner({ size = 16 }: { size?: number }) {
  return <span className="inline-block rounded-full border-2 border-current border-r-transparent fn-spin" style={{ width: size, height: size }} aria-hidden />;
}

const ACTOR: Record<string, { label: string; cls: string }> = {
  agent: { label: "Footnote agent", cls: "bg-fn-soft text-fn" },
  partner: { label: "Partner agent", cls: "bg-[#e7f0fb] text-link" },
  person: { label: "Person", cls: "bg-good-soft text-good" },
  expert: { label: "Accountant", cls: "bg-expert-soft text-expert" },
  system: { label: "IES", cls: "bg-line-2 text-ink-2" },
};

const KIND_ICON: Record<string, (p: { size?: number }) => React.ReactNode> = {
  applied: Icon.Check, approved: Icon.Check, posted: Icon.Doc, answered: Icon.User, asked: Icon.Send, reminder: Icon.Bell, proposed: Icon.Spark,
  checked: Icon.Search, returned: Icon.Expert, sent_to_expert: Icon.Expert, info_requested: Icon.Help, info_received: Icon.User, installed: Icon.Store,
  rejected: Icon.X, undone: Icon.Undo,
};

export type ActivityItem = { id: number; kind: string; label: string; detail: string | null; actor_type: string; actor_name: string; policy: string | null; file: string | null; created_at: string };

export function ActivityList({ items, compact = false }: { items: ActivityItem[]; compact?: boolean }) {
  if (!items.length) return <div className="text-sm text-ink-3">Nothing yet.</div>;
  return (
    <ol className="relative flex flex-col gap-3.5">
      {items.map((e, i) => {
        const I = KIND_ICON[e.kind] ?? Icon.Doc;
        const a = ACTOR[e.actor_type] ?? ACTOR.system;
        return (
          <li key={e.id} className="flex gap-3 relative">
            {i < items.length - 1 ? <span className="absolute left-[13px] top-7 -bottom-3.5 w-px bg-line" aria-hidden /> : null}
            <span className={`w-7 h-7 rounded-full inline-flex items-center justify-center shrink-0 ${a.cls}`}><I size={14} /></span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <span className="text-[14px] font-semibold text-ink">{e.label}</span>
                <span className="text-[12px] text-ink-3" title={niceDateTime(e.created_at)}>{relTime(e.created_at)}</span>
              </div>
              <div className="text-[12.5px] text-ink-2 mt-0.5">
                <span className={`inline-block rounded px-1.5 py-px text-[10.5px] font-bold uppercase tracking-wide mr-1.5 ${a.cls}`}>{e.actor_type === "partner" || e.actor_type === "expert" ? e.actor_name.split(",")[0] : a.label}</span>
                {e.detail}
              </div>
              {e.policy && !compact ? <div className="text-[12px] text-fn mt-1 flex items-center gap-1"><Icon.Shield size={12} /> Policy: {e.policy}</div> : null}
              {e.file && !compact ? (
                <a href={`/api/files/${e.file}`} target="_blank" className="mt-1.5 inline-flex items-center gap-2 rounded-md border border-line p-1 pr-2 hover:border-link">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/api/files/${e.file}`} alt="Attached document" className="h-10 w-8 object-cover rounded-sm bg-canvas" />
                  <span className="text-[12px] text-link">View</span>
                </a>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

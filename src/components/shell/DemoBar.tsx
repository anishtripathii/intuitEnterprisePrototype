"use client";

import { useEffect, useRef, useState } from "react";
import { FootnoteLogo, Icon } from "../icons";
import { useToast } from "../Toast";

type Step = { minutes: string; who: string; title: string; href: string; as?: string };

// The 12-minute walkthrough from the product definition. Each step signs in as the right person.
export const DEMO_STEPS: Step[] = [
  { minutes: "0–2", who: "Priya · Controller", title: "Start the September review and watch the agent investigate", href: "/close", as: "u_priya" },
  { minutes: "2–4", who: "Luis · on his phone", title: "Answer the Home Depot text in one tap", href: "/phone/u_luis" },
  { minutes: "4–6", who: "Ravi · SiteLog developer", title: "Build CostCheck, pass the Proving Ground, publish", href: "/developer", as: "u_ravi" },
  { minutes: "6–8", who: "Priya · Controller", title: "Install CostCheck on the labor issue and approve its fix", href: "/close?issue=iss_labor", as: "u_priya" },
  { minutes: "8–9", who: "Priya · Controller", title: "Send the Lincoln invoice to Elena", href: "/close?issue=iss_rev", as: "u_priya" },
  { minutes: "9–10", who: "Elena · Accountant", title: "Ask Maya, change the treatment, return it", href: "/expert", as: "u_elena" },
  { minutes: "", who: "Maya · on her phone", title: "Confirm the cost estimate for Elena", href: "/phone/u_maya" },
  { minutes: "10–12", who: "Priya · Controller", title: "Approve Elena's recommendation, then open the margins report", href: "/close?issue=iss_rev", as: "u_priya" },
  { minutes: "", who: "Priya · Controller", title: "Project margins: before, after, and why", href: "/reports", as: "u_priya" },
];

export default function DemoBar({ note }: { note?: string }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const toast = useToast();
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  async function go(s: Step) {
    setBusy(true);
    if (s.as) {
      const r = await fetch("/api/auth/switch", { method: "POST", headers: { "content-type": "application/json", "x-demo-login": "1" }, body: JSON.stringify({ userId: s.as }) });
      if (!r.ok) {
        setBusy(false);
        return toast("Couldn't switch person", "bad");
      }
    }
    window.location.href = s.href;
  }
  async function reset() {
    setBusy(true);
    await fetch("/api/auth/switch", { method: "POST", headers: { "content-type": "application/json", "x-demo-login": "1" }, body: JSON.stringify({ userId: "u_priya" }) });
    await fetch("/api/demo/reset", { method: "POST" });
    window.location.href = "/login";
  }

  return (
    <div className="h-8 bg-[#1b1f2e] text-white text-[12px] flex items-center justify-between gap-3 px-3 shrink-0 relative z-40" ref={ref}>
      <div className="flex items-center gap-2 min-w-0">
        <FootnoteLogo size={14} />
        <span className="font-semibold">Footnote for IES · concept prototype</span>
        <span className="opacity-60 hidden md:inline truncate">{note ?? "Synthetic demo data · today is Oct 1, 2026 (September close)"}</span>
      </div>
      <button onClick={() => setOpen((v) => !v)} className="flex items-center gap-1.5 rounded px-2 py-1 hover:bg-white/10 font-semibold" aria-expanded={open}>
        <Icon.Map size={14} /> Demo guide <Icon.Chevron size={13} />
      </button>
      {open ? (
        <div className="absolute right-2 top-9 w-[440px] max-w-[calc(100vw-16px)] rounded-xl bg-white text-ink shadow-2xl border border-line p-2 fn-in">
          <div className="px-3 pt-2 pb-1 flex items-center justify-between">
            <div className="text-[13px] font-semibold">The 12-minute walkthrough</div>
            <button onClick={reset} disabled={busy} className="text-[12px] text-link hover:underline">Reset demo data</button>
          </div>
          <ol className="flex flex-col">
            {DEMO_STEPS.map((s, i) => (
              <li key={i}>
                <button disabled={busy} onClick={() => go(s)} className="w-full text-left flex gap-3 px-3 py-2 rounded-lg hover:bg-canvas">
                  <span className="w-6 h-6 rounded-full bg-fn-soft text-fn text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13.5px] font-medium leading-snug">{s.title}</span>
                    <span className="block text-[12px] text-ink-3">{s.who}{s.minutes ? ` · min ${s.minutes}` : ""}</span>
                  </span>
                  <Icon.ChevronRight size={14} className="text-ink-3 mt-1.5" />
                </button>
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </div>
  );
}

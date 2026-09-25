"use client";

import { useState } from "react";
import { Avatar } from "@/components/ui";
import { FootnoteLogo, Icon } from "@/components/icons";
import { DEMO_STEPS } from "@/components/shell/DemoBar";

type U = { id: string; name: string; email: string; role: string; title: string; initials: string; color: string };

const GROUPS: { label: string; note: string; roles: string[] }[] = [
  { label: "Finance leaders", note: "Work in IES", roles: ["controller", "cfo"] },
  { label: "Developer", note: "Builds agents on the platform", roles: ["developer"] },
  { label: "Experts", note: "Review cases they're sent", roles: ["accountant", "live_expert"] },
  { label: "People with the facts", note: "No login: they get a text", roles: ["pm"] },
];

export default function LoginForm({ users }: { users: U[] }) {
  const [email, setEmail] = useState("priya@harborpine.demo");
  const [password, setPassword] = useState("demo1234");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const r = await fetch("/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password }) });
    const j = await r.json();
    setBusy(false);
    if (!r.ok) return setError(j.error);
    window.location.href = j.home;
  }
  async function quick(u: U) {
    if (u.role === "pm") {
      window.location.href = `/phone/${u.id}`;
      return;
    }
    setBusy(true);
    const r = await fetch("/api/auth/switch", { method: "POST", headers: { "content-type": "application/json", "x-demo-login": "1" }, body: JSON.stringify({ userId: u.id }) });
    const j = await r.json();
    window.location.href = j.home ?? "/close";
  }

  return (
    <div className="min-h-screen bg-canvas flex flex-col">
      <div className="h-8 bg-[#1b1f2e] text-white text-[12px] flex items-center gap-2 px-3">
        <FootnoteLogo size={14} /> <span className="font-semibold">Footnote for IES · concept prototype</span>
        <span className="opacity-60 hidden sm:inline">· Intuit PM case · synthetic demo data</span>
      </div>
      <div className="flex-1 w-full max-w-[1180px] mx-auto px-4 py-10 grid lg:grid-cols-[400px_1fr] gap-8 items-start">
        <div className="card p-7">
          <div className="text-[20px] font-extrabold tracking-[0.07em] text-[#1f2d5c] leading-none">INTUIT</div>
          <div className="text-[18px] text-intuit leading-tight">Enterprise Suite</div>
          <h1 className="text-[22px] font-semibold mt-6">Sign in</h1>
          <p className="text-[13.5px] text-ink-2 mt-1">Every demo account uses the password <span className="font-mono">demo1234</span>.</p>
          <form onSubmit={signIn} className="mt-5 flex flex-col gap-3">
            <label className="text-[13px] font-semibold" htmlFor="email">Email</label>
            <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <label className="text-[13px] font-semibold mt-1" htmlFor="password">Password</label>
            <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            {error ? <div className="text-[13px] text-bad">{error}</div> : null}
            <button className="btn btn-primary mt-2" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
          </form>
        </div>

        <div className="flex flex-col gap-5">
          <div>
            <div className="flex items-center gap-2"><FootnoteLogo size={18} /><h2 className="text-[22px] font-semibold">Footnote for IES</h2></div>
            <p className="text-[15px] text-ink-2 mt-1 max-w-[64ch]">Agents do the work. Every decision has a trail. Harbor &amp; Pine&apos;s controller needs trustworthy project margins for Thursday&apos;s leadership review.</p>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            {GROUPS.map((g) => (
              <div key={g.label} className="card p-4">
                <div className="flex items-baseline justify-between"><span className="label">{g.label}</span><span className="text-[11.5px] text-ink-3">{g.note}</span></div>
                <div className="mt-2 flex flex-col gap-0.5">
                  {users.filter((u) => g.roles.includes(u.role)).map((u) => (
                    <button key={u.id} onClick={() => quick(u)} disabled={busy} className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-canvas text-left">
                      <Avatar initials={u.initials} color={u.color} size={32} />
                      <span className="min-w-0 flex-1">
                        <span className="block text-[14px] font-semibold text-ink">{u.name}</span>
                        <span className="block text-[12.5px] text-ink-3 truncate">{u.title}</span>
                      </span>
                      {u.role === "pm" ? <Icon.Phone size={15} className="text-ink-3" /> : <Icon.ChevronRight size={15} className="text-ink-3" />}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="card p-5">
            <div className="label">The 12-minute walkthrough</div>
            <ol className="mt-3 grid sm:grid-cols-2 gap-x-6 gap-y-2 text-[13.5px]">
              {DEMO_STEPS.map((s, i) => (
                <li key={i} className="flex gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-fn-soft text-fn text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                  <span><span className="font-medium">{s.title}</span> <span className="text-ink-3">· {s.who.split(" · ")[0]}</span></span>
                </li>
              ))}
            </ol>
            <p className="text-[12.5px] text-ink-3 mt-3">Use “Demo guide” in the top bar on any screen to jump to the next step.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

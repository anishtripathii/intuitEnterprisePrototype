"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { FootnoteLogo, Icon } from "../icons";
import { Avatar } from "../ui";
import { useToast } from "../Toast";
import DemoBar from "./DemoBar";

export type ShellUser = { id: string; name: string; role: string; title: string; initials: string; color: string };

// The IES navigation, kept as it is. Only the close workspace and reports are part of the prototype;
// the other areas are unchanged IES and say so when clicked.
const NAV: { label: string; href?: string; fn?: boolean }[] = [
  { label: "Close workspace", href: "/close", fn: true },
  { label: "Dashboards" },
  { label: "Transactions" },
  { label: "Multi-entity" },
  { label: "Sales" },
  { label: "Expenses" },
  { label: "Customers & leads" },
  { label: "Reports", href: "/reports" },
  { label: "Payroll" },
  { label: "Time" },
  { label: "Projects" },
  { label: "Financial planning" },
  { label: "Workflow automation" },
  { label: "Taxes" },
  { label: "My accountant" },
  { label: "Live Experts" },
  { label: "Lending & banking" },
];

export default function Shell({ user, users, children }: { user: ShellUser; users: ShellUser[]; children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const toast = useToast();
  const [meOpen, setMeOpen] = useState(false);
  const mRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (mRef.current && !mRef.current.contains(e.target as Node)) setMeOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  const outOfScope = (what: string) => toast(`${what} works as it does in IES today. It isn't part of this prototype.`, "info");

  async function switchUser(id: string) {
    setMeOpen(false);
    const r = await fetch("/api/auth/switch", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ userId: id }) });
    const j = await r.json();
    window.location.href = j.home ?? "/close";
  }
  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <DemoBar />
      <div className="flex flex-1 min-h-0">
        <aside className="w-[228px] shrink-0 bg-nav border-r border-line hidden md:flex flex-col">
          <div className="px-5 pt-4 pb-3">
            <div className="text-[18px] font-extrabold tracking-[0.07em] text-[#1f2d5c] leading-none">INTUIT</div>
            <div className="text-[16px] text-intuit leading-tight mt-0.5">Enterprise Suite</div>
          </div>
          <div className="px-4">
            <button onClick={() => outOfScope("Creating transactions")} className="w-full h-9 rounded-full border border-[#c3c7d0] text-[#8b909c] font-semibold text-sm flex items-center justify-center gap-1 bg-white hover:bg-canvas">
              <Icon.Plus size={16} /> New
            </button>
          </div>
          <div className="px-5 mt-5 mb-1 label">Menu</div>
          <nav className="flex-1 overflow-y-auto pb-4">
            {NAV.map((n) => {
              const active = !!n.href && path.startsWith(n.href);
              // Only the close workspace and reports are part of the prototype. They keep full-strength
              // text and a small dot; the rest of IES is shown softer.
              const cls = `w-full flex items-center justify-between pl-5 pr-4 py-[7px] text-[14px] border-l-4 text-left ${
                active ? "border-ink bg-[#e2e4e9] font-semibold text-ink" : n.href ? "border-transparent font-medium text-ink hover:bg-[#e8eaee]" : "border-transparent text-[#8b909c] hover:bg-[#eceef1]"
              }`;
              const inner = (
                <>
                  <span className="flex items-center gap-2">{n.fn ? <FootnoteLogo size={14} /> : null}{n.label}</span>
                  {n.href ? <span className="w-1.5 h-1.5 rounded-full bg-fn/60" aria-hidden /> : null}
                </>
              );
              return n.href ? (
                <Link key={n.label} href={n.href} className={cls}>{inner}</Link>
              ) : (
                <button key={n.label} onClick={() => outOfScope(n.label)} className={cls}>{inner}</button>
              );
            })}
          </nav>
          <div className="px-5 pb-2 text-[11.5px] text-ink-3 flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-fn/60" aria-hidden /> Works in this prototype</div>
          <div className="px-5 py-3 border-t border-line text-[12px] text-ink-3">Powered by <span className="font-bold text-qb">quickbooks</span></div>
        </aside>
        <div className="flex-1 min-w-0 flex flex-col">
          <header className="h-14 border-b border-line flex items-center justify-between px-5 shrink-0 bg-white">
            <div className="flex items-center gap-3 min-w-0">
              <span className="w-7 h-7 rounded bg-[#1f2d5c] text-white flex items-center justify-center font-bold text-[10px]">H&amp;P</span>
              <span className="text-[14px] font-semibold truncate">Harbor &amp; Pine Group</span>
              <span className="text-[12px] text-ink-3 hidden lg:inline">3 entities</span>
            </div>
            <div className="flex items-center gap-4 text-ink-2">
              <button onClick={() => outOfScope("Help")} aria-label="Help" className="hover:text-ink"><Icon.Help /></button>
              <div className="relative" ref={mRef}>
                <button onClick={() => setMeOpen((v) => !v)} aria-label="Profile and demo people" className="flex items-center gap-2">
                  <Avatar initials={user.initials} color={user.color} size={30} />
                  <span className="hidden lg:block text-left leading-tight"><span className="block text-[13px] font-semibold text-ink">{user.name}</span><span className="block text-[11.5px] text-ink-3">{user.title.split(" · ")[0]}</span></span>
                </button>
                {meOpen ? (
                  <div className="absolute right-0 z-50 mt-3 w-[300px] card shadow-xl py-2 text-sm fn-in">
                    <div className="px-4 pt-1 pb-1 label">Switch person</div>
                    {users.filter((u) => u.id !== user.id).map((u) => (
                      <button key={u.id} onClick={() => switchUser(u.id)} className="w-full flex items-center gap-2 px-4 py-1.5 hover:bg-canvas text-left">
                        <Avatar initials={u.initials} color={u.color} size={22} />
                        <span className="min-w-0"><span className="text-ink">{u.name}</span> <span className="text-ink-3 text-xs">· {u.title.split(" · ")[0]}</span></span>
                      </button>
                    ))}
                    <div className="border-t border-line mt-1 pt-1">
                      <button onClick={signOut} className="w-full text-left px-4 py-1.5 hover:bg-canvas text-ink">Sign out</button>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </header>
          <main className="flex-1 min-w-0 bg-white">{children}</main>
        </div>
      </div>
    </div>
  );
}

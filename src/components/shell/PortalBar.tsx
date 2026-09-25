"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Avatar } from "../ui";
import DemoBar from "./DemoBar";
import type { ShellUser } from "./Shell";

export default function PortalBar({ product, user, users, links }: { product: React.ReactNode; user: ShellUser & { firm?: string | null }; users: ShellUser[]; links: { label: string; href: string }[] }) {
  const router = useRouter();
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  async function switchUser(id: string) {
    setOpen(false);
    const r = await fetch("/api/auth/switch", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ userId: id }) });
    const j = await r.json();
    window.location.href = j.home ?? "/";
  }
  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  return (
    <>
      <DemoBar />
      <header className="h-14 bg-[#1f2d5c] text-white flex items-center justify-between px-5">
        <div className="flex items-center gap-6 min-w-0">
          <div className="leading-tight">{product}</div>
          <nav className="hidden md:flex items-center gap-1 text-[14px]">
            {links.map((l) => {
              const active = path === l.href.split("?")[0];
              return <Link key={l.href} href={l.href} className={`px-3 py-1.5 rounded ${active ? "bg-white/15 font-semibold" : "hover:bg-white/10"}`}>{l.label}</Link>;
            })}
          </nav>
        </div>
        <div className="relative" ref={ref}>
          <button onClick={() => setOpen((v) => !v)} className="flex items-center gap-2" aria-label="Profile and demo people">
            <span className="hidden sm:block text-right text-[12px] leading-tight"><span className="block font-semibold">{user.name}</span><span className="block opacity-75">{user.firm ?? user.title}</span></span>
            <Avatar initials={user.initials} color={user.color} size={30} />
          </button>
          {open ? (
            <div className="absolute right-0 z-50 mt-3 w-[300px] card shadow-xl py-2 text-sm text-ink fn-in">
              <div className="px-4 pt-1 pb-1 label">Switch person</div>
              {users.filter((u) => u.id !== user.id).map((u) => (
                <button key={u.id} onClick={() => switchUser(u.id)} className="w-full flex items-center gap-2 px-4 py-1.5 hover:bg-canvas text-left">
                  <Avatar initials={u.initials} color={u.color} size={22} />
                  <span className="min-w-0">{u.name} <span className="text-ink-3 text-xs">· {u.title.split(" · ")[0]}</span></span>
                </button>
              ))}
              <div className="border-t border-line mt-1 pt-1">
                <button onClick={signOut} className="w-full text-left px-4 py-1.5 hover:bg-canvas">Sign out</button>
              </div>
            </div>
          ) : null}
        </div>
      </header>
    </>
  );
}

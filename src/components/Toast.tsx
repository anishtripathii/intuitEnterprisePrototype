"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { Icon } from "./icons";

type Toast = { id: number; text: string; tone: "good" | "bad" | "info" };
const Ctx = createContext<(text: string, tone?: Toast["tone"]) => void>(() => {});

// Every action in the prototype confirms itself here, at the bottom of the screen, so feedback is
// visible wherever the page is scrolled.
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((text: string, tone: Toast["tone"] = "good") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-2), { id, text, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);
  return (
    <Ctx.Provider value={push}>
      {children}
      <div className="toast-stack fixed bottom-5 left-1/2 -translate-x-1/2 z-[100] flex flex-col items-center gap-2 pointer-events-none w-[min(560px,calc(100vw-32px))]" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`fn-in pointer-events-auto flex items-center gap-2.5 rounded-lg px-4 py-3 text-[14px] shadow-lg ${t.tone === "bad" ? "bg-bad text-white" : "bg-[#1f2330] text-white"}`}
          >
            {t.tone === "bad" ? <Icon.Alert size={16} /> : <span className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${t.tone === "good" ? "bg-qb" : "bg-fn"}`}><Icon.Check size={13} /></span>}
            <span>{t.text}</span>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useToast() {
  return useContext(Ctx);
}

// POST helper that reports the outcome through a toast.
export function useAction() {
  const toast = useToast();
  return useCallback(
    async <T = Record<string, unknown>,>(url: string, body?: unknown, opts: { quiet?: boolean } = {}): Promise<{ ok: boolean; data: T & { message?: string; error?: string } }> => {
      try {
        const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
        const data = (await r.json().catch(() => ({}))) as T & { message?: string; error?: string };
        if (!r.ok) toast(data.error ?? "That didn't work. Try again.", "bad");
        else if (!opts.quiet && data.message) toast(data.message, "good");
        return { ok: r.ok, data };
      } catch {
        toast("Can't reach the server. Is the prototype still running?", "bad");
        return { ok: false, data: {} as T & { message?: string; error?: string } };
      }
    },
    [toast],
  );
}

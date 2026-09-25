"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Modal } from "../Modal";
import { FootnoteLogo, Icon } from "../icons";
import { Spinner } from "../ui";
import { useToast } from "../Toast";
import { TRACKS, type Helpers, type TourStep, type TrackId } from "./steps";

type Active = { track: TrackId; step: number };
type Ctx = { openChooser: () => void; start: (track: TrackId) => Promise<void> };
const TourCtx = createContext<Ctx>({ openChooser: () => {}, start: async () => {} });
export const useTour = () => useContext(TourCtx);

// The tour's place survives page loads and person switches in a short-lived cookie.
function readActive(): Active | null {
  const m = document.cookie.match(/(?:^|; )fn_tour=([^;]+)/);
  if (!m) return null;
  const [track, step] = decodeURIComponent(m[1]).split(":");
  const t = TRACKS[track as TrackId];
  const n = Number(step);
  if (!t || !Number.isInteger(n) || n < 0 || n >= t.steps.length) return null;
  return { track: t.id, step: n };
}
function writeActive(a: Active | null) {
  document.cookie = a ? `fn_tour=${a.track}:${a.step}; path=/; max-age=7200; samesite=lax` : "fn_tour=; path=/; max-age=0; samesite=lax";
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const selectorFor = (t: string) => (/^[a-z-]+$/.test(t) ? `[data-tour="${t}"]` : t);
const stepSelector = (s: TourStep) => (s.issue ? `[data-issue="${s.issue}"] [data-tour="${s.target}"]` : `[data-tour="${s.target}"]`);

async function waitFor(target: string, timeout = 20000, alive: () => boolean = () => true): Promise<HTMLElement> {
  const sel = selectorFor(target);
  const t0 = Date.now();
  for (;;) {
    const el = document.querySelector<HTMLElement>(sel);
    if (el) return el;
    if (!alive()) throw new Error("cancelled");
    if (Date.now() - t0 > timeout) throw new Error(`Timed out waiting for ${sel}`);
    await sleep(200);
  }
}

async function switchTo(userId: string) {
  await fetch("/api/auth/switch", { method: "POST", headers: { "content-type": "application/json", "x-demo-login": "1" }, body: JSON.stringify({ userId }) });
}

const helpers: Helpers = {
  waitFor: (t, timeout) => waitFor(t, timeout),
  click: async (t, timeout) => {
    const el = await waitFor(t, timeout);
    el.click();
    await sleep(250);
  },
  check: async (t, timeout) => {
    const el = (await waitFor(t, timeout)) as HTMLInputElement;
    if (!el.checked) el.click();
    await sleep(250);
  },
  demo: async (action) => {
    const r = await fetch("/api/demo/tour", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action }) });
    if (!r.ok) throw new Error("demo step failed");
  },
  sleep,
};

export function TourProvider({ children }: { children: React.ReactNode }) {
  const toast = useToast();
  const pathname = usePathname();
  const [active, setActive] = useState<Active | null>(null);
  const [chooser, setChooser] = useState(false);
  const [starting, setStarting] = useState<TrackId | null>(null);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [rect, setRect] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  const navigated = useRef<string | null>(null);

  useEffect(() => setActive(readActive()), []);
  // While a demo runs, confirmations move to the top-right so they don't cover its buttons.
  useEffect(() => {
    if (active) document.body.dataset.tour = "on";
    else delete document.body.dataset.tour;
  }, [active]);

  const step = active ? TRACKS[active.track].steps[active.step] : null;
  const total = active ? TRACKS[active.track].steps.length : 0;

  // Get the screen ready for the current step, then find what it points at.
  useEffect(() => {
    if (!active || !step) return;
    let alive = true;
    setReady(false);
    setRect(null);
    (async () => {
      if (window.location.pathname !== step.path) {
        const key = `${active.track}:${active.step}`;
        if (navigated.current === key) return;
        navigated.current = key;
        await switchTo(step.as);
        window.location.href = step.path + (step.issue ? `?issue=${step.issue}` : "");
        return;
      }
      try {
        if (step.issue) {
          const item = await waitFor(`[data-issue-id="${step.issue}"]`, 30000, () => alive);
          if (item.getAttribute("aria-current") !== "true") item.click();
        }
        const el = await waitFor(stepSelector(step), 40000, () => alive);
        if (!alive) return;
        const tall = el.getBoundingClientRect().height > window.innerHeight * 0.6;
        el.scrollIntoView({ block: tall ? "start" : "center", behavior: "smooth" });
        await sleep(350);
        if (alive) setReady(true);
      } catch {
        if (alive) setReady(true); // show the explanation even if the element never appeared
      }
    })();
    return () => {
      alive = false;
    };
  }, [active, step, pathname]);

  // Follow the element as the page scrolls, resizes or re-renders.
  useEffect(() => {
    if (!ready || !step) return;
    const measure = () => {
      const el = document.querySelector<HTMLElement>(stepSelector(step));
      if (!el) return setRect(null);
      const r = el.getBoundingClientRect();
      setRect((p) => (p && Math.abs(p.top - r.top) < 0.5 && Math.abs(p.left - r.left) < 0.5 && Math.abs(p.width - r.width) < 0.5 && Math.abs(p.height - r.height) < 0.5 ? p : { top: r.top, left: r.left, width: r.width, height: r.height }));
    };
    measure();
    const id = setInterval(measure, 120);
    window.addEventListener("scroll", measure, true);
    window.addEventListener("resize", measure);
    return () => {
      clearInterval(id);
      window.removeEventListener("scroll", measure, true);
      window.removeEventListener("resize", measure);
    };
  }, [ready, step]);

  const stop = useCallback(() => {
    writeActive(null);
    setActive(null);
    setBusy(false);
    setReady(false);
  }, []);

  const start = useCallback(async (track: TrackId) => {
    setStarting(track);
    try {
      const r = await fetch("/api/demo/tour", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "start", track }) });
      const j = (await r.json()) as { path?: string; error?: string };
      if (!r.ok || !j.path) throw new Error(j.error);
      writeActive({ track, step: 0 });
      window.location.href = j.path;
    } catch {
      toast("Couldn't start the demo. Try again.", "bad");
      setStarting(null);
    }
  }, [toast]);

  async function next() {
    if (!active || !step) return;
    setBusy(true);
    try {
      await step.next?.(helpers);
    } catch {
      toast("That step didn't finish. Click Next to try again.", "bad");
      setBusy(false);
      return;
    }
    const n = active.step + 1;
    const steps = TRACKS[active.track].steps;
    if (n >= steps.length) {
      stop();
      toast(`That's Footnote for ${TRACKS[active.track].person}. Explore on your own, or start another demo from the top bar.`, "info");
      return;
    }
    const to = steps[n];
    writeActive({ track: active.track, step: n });
    if (to.as !== step.as) {
      await switchTo(to.as);
      window.location.href = to.path + (to.issue ? `?issue=${to.issue}` : "");
      return;
    }
    if (to.path !== window.location.pathname) {
      window.location.href = to.path + (to.issue ? `?issue=${to.issue}` : "");
      return;
    }
    setBusy(false);
    setActive({ track: active.track, step: n });
  }

  return (
    <TourCtx.Provider value={{ openChooser: () => setChooser(true), start }}>
      {children}
      {chooser ? <Chooser onClose={() => setChooser(false)} onStart={start} starting={starting} /> : null}
      {active && step ? (
        ready ? (
          <Callout step={step} rect={rect} index={active.step} total={total} person={TRACKS[active.track].person} busy={busy} onNext={next} onCancel={stop} />
        ) : (
          <div className="fixed bottom-5 right-5 z-[95] w-[320px] rounded-xl bg-white shadow-2xl border border-line p-4 flex items-center gap-3 fn-in" role="status">
            <Spinner size={16} />
            <span className="flex-1 text-[13.5px] text-ink-2">{step.waiting ?? "Getting the next screen ready…"}</span>
            <button className="text-[13px] text-link hover:underline" onClick={stop}>Cancel</button>
          </div>
        )
      ) : null}
    </TourCtx.Provider>
  );
}

function Callout({ step, rect, index, total, person, busy, onNext, onCancel }: { step: TourStep; rect: { top: number; left: number; width: number; height: number } | null; index: number; total: number; person: string; busy: boolean; onNext: () => void; onCancel: () => void }) {
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 360, h: 230 });
  useEffect(() => {
    if (box.current) setSize({ w: box.current.offsetWidth, h: box.current.offsetHeight });
  }, [step, busy]);

  // Place the explanation beside what it describes, wherever there's room.
  const vw = typeof window === "undefined" ? 1440 : window.innerWidth;
  const vh = typeof window === "undefined" ? 900 : window.innerHeight;
  const gap = 16;
  const pad = 12;
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(v, hi));
  let pos = { left: vw - size.w - 20, top: vh - size.h - 20 };
  if (rect) {
    const r = { ...rect, right: rect.left + rect.width, bottom: rect.top + rect.height };
    if (r.bottom + gap + size.h <= vh - pad) pos = { left: clamp(r.left, pad, vw - size.w - pad), top: r.bottom + gap };
    else if (r.right + gap + size.w <= vw - pad) pos = { left: r.right + gap, top: clamp(r.top, pad, vh - size.h - pad) };
    else if (r.left - gap - size.w >= pad) pos = { left: r.left - gap - size.w, top: clamp(r.top, pad, vh - size.h - pad) };
    else if (r.top - gap - size.h >= pad) pos = { left: clamp(r.left, pad, vw - size.w - pad), top: r.top - gap - size.h };
    else pos = { left: clamp(r.left + r.width - size.w - gap, pad, vw - size.w - pad), top: vh - size.h - 20 };
  }
  const last = index === total - 1;

  return (
    <>
      {rect ? (
        <div
          aria-hidden
          className="fixed z-[90] pointer-events-none rounded-xl transition-all duration-200"
          style={{ top: rect.top - 6, left: rect.left - 6, width: rect.width + 12, height: rect.height + 12, boxShadow: "0 0 0 3px rgba(79,70,229,.7), 0 0 0 9999px rgba(17,20,32,.28)" }}
        />
      ) : null}
      <div
        ref={box}
        role="dialog"
        aria-label={step.title}
        className="fixed z-[95] w-[360px] max-w-[calc(100vw-24px)] rounded-xl bg-white shadow-2xl border border-line p-5 fn-in"
        style={{ left: pos.left, top: pos.top }}
      >
        <div className="flex items-center justify-between gap-2 text-[12px] text-ink-3">
          <span className="flex items-center gap-1.5 font-semibold text-fn"><FootnoteLogo size={13} /> Footnote demo · {person}</span>
          <span className="num">{index + 1} of {total}</span>
        </div>
        <h2 className="text-[16.5px] font-semibold leading-snug mt-2">{step.title}</h2>
        <p className="text-[14px] text-ink-2 leading-relaxed mt-1.5">{step.body}</p>
        <div className="mt-4 flex items-center justify-between gap-2">
          <div className="flex gap-1" aria-hidden>
            {Array.from({ length: total }, (_, i) => <span key={i} className={`h-1.5 rounded-full ${i === index ? "w-4 bg-fn" : i < index ? "w-1.5 bg-fn/40" : "w-1.5 bg-line"}`} />)}
          </div>
          <div className="flex gap-2">
            <button className="btn btn-secondary btn-sm" onClick={onCancel}>Cancel</button>
            <button className="btn btn-fn btn-sm min-w-[84px]" onClick={onNext} disabled={busy} autoFocus>
              {busy ? <><Spinner size={13} /> Working…</> : last ? "Finish" : <>Next <Icon.Arrow size={13} /></>}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function Chooser({ onClose, onStart, starting }: { onClose: () => void; onStart: (t: TrackId) => void; starting: TrackId | null }) {
  return (
    <Modal title="See how Footnote helps" eyebrow={<span className="flex items-center gap-1.5 text-[12px] font-semibold text-fn"><FootnoteLogo size={13} /> Footnote demo</span>} onClose={onClose} width={640}>
      <div className="flex flex-col gap-4">
        <p className="text-[14px] text-ink-2">Pick whose side to see. A short guide walks you through it, one screen at a time. Click Next to move on, or Cancel to stop at any point.</p>
        <div className="grid sm:grid-cols-2 gap-3">
          {(Object.values(TRACKS)).map((t) => (
            <button key={t.id} disabled={!!starting} onClick={() => onStart(t.id)} className="text-left rounded-xl border border-line p-4 hover:border-fn hover:bg-fn-soft/40 flex flex-col gap-2 disabled:opacity-60">
              <span className="text-[12px] font-semibold text-fn uppercase tracking-wide">{t.id === "controller" ? "Finance leader" : "Developer"}</span>
              <span className="text-[16px] font-semibold">{t.person} · <span className="font-normal text-ink-2">{t.role}</span></span>
              <span className="text-[13.5px] text-ink-2 leading-relaxed">{t.pitch}</span>
              <span className="mt-auto pt-1 flex items-center justify-between text-[12.5px] text-ink-3">
                <span>{t.steps.length} steps</span>
                <span className="flex items-center gap-1 font-semibold text-fn">{starting === t.id ? <><Spinner size={12} /> Setting up…</> : <>Start <Icon.Arrow size={13} /></>}</span>
              </span>
            </button>
          ))}
        </div>
        <p className="text-[12.5px] text-ink-3">The demo starts from a fresh copy of the sample data.</p>
      </div>
    </Modal>
  );
}

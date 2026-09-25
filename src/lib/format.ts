import { demoNow } from "./clock";

export function money(n: number | null | undefined, opts: { cents?: boolean } = {}): string {
  const v = Number(n ?? 0);
  const cents = opts.cents ?? true;
  const s = Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: cents ? 2 : 0, maximumFractionDigits: cents ? 2 : 0 });
  return `${v < 0 ? "-" : ""}$${s}`;
}

export function moneyShort(n: number): string {
  const v = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (v >= 1_000_000) return `${sign}$${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 10_000) return `${sign}$${Math.round(v / 1000)}k`;
  if (v >= 1000) return `${sign}$${(v / 1000).toFixed(1)}k`;
  return `${sign}$${v.toFixed(0)}`;
}

export function pct(n: number, digits = 0): string {
  return `${(n * 100).toFixed(digits)}%`;
}

export function relTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const diff = demoNow() - new Date(iso).getTime();
  const m = Math.round(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: TZ });
}

// The demo company is in California, so dates render in Pacific time on both server and browser.
const TZ = "America/Los_Angeles";
const parse = (iso: string) => new Date(iso.length === 10 ? iso + "T12:00:00Z" : iso);

export function shortDate(iso: string | null | undefined): string {
  if (!iso) return "";
  return parse(iso).toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric", timeZone: TZ });
}

export function niceDate(iso: string | null | undefined): string {
  if (!iso) return "";
  return parse(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: TZ });
}

export function niceDateTime(iso: string | null | undefined): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: TZ });
}

export const PERIOD_LABEL: Record<string, string> = {
  "2026-09": "Sep 2026",
  "2026-08": "Aug 2026",
};

export function clockTime(ms: number): string {
  return new Date(ms).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: TZ }).replace(/\s?[AP]M$/, "");
}

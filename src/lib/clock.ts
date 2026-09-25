// Demo clock. The story takes place on Oct 1, 2026 (day 1 of the September close), so the app's
// "now" is the real time shifted by an offset chosen when a visitor's demo copy is seeded. On the
// server the offset comes from the current request's workspace; the root layout hands the same
// value to the browser as window.__fnOffset.
export const DEMO_ANCHOR = Date.parse("2026-10-01T15:47:00.000Z"); // Oct 1, 2026 · 8:47 AM Pacific

declare global {
  var __fnOffset: number | undefined;
  var __fnOffsetFn: (() => number) | undefined;
}

export function demoNow(): number {
  const fn = globalThis.__fnOffsetFn;
  return Date.now() + (fn ? fn() : globalThis.__fnOffset ?? 0);
}

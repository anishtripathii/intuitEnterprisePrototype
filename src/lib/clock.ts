// Demo clock. The story takes place on Oct 1, 2026 (day 1 of the September close), so the app's
// "now" is the real time shifted by a fixed offset chosen when the demo data was seeded. The server
// sets the offset when it opens the database; the root layout hands the same value to the browser.
export const DEMO_ANCHOR = Date.parse("2026-10-01T15:47:00.000Z"); // Oct 1, 2026 · 8:47 AM Pacific

declare global {
  var __fnOffset: number | undefined;
}

export function demoNow(): number {
  return Date.now() + (globalThis.__fnOffset ?? 0);
}

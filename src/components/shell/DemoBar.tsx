"use client";

import { FootnoteLogo, Icon } from "../icons";
import { useTour } from "../tour/Tour";

export default function DemoBar({ note }: { note?: string }) {
  const { openChooser } = useTour();
  return (
    <div className="h-8 bg-[#1b1f2e] text-white text-[12px] flex items-center justify-between gap-3 px-3 shrink-0 relative z-40">
      <div className="flex items-center gap-2 min-w-0">
        <FootnoteLogo size={14} />
        <span className="font-semibold">Footnote for IES · concept prototype</span>
        <span className="opacity-60 hidden md:inline truncate">{note ?? "Sample data · today is Oct 1, 2026 (September close)"}</span>
      </div>
      <button onClick={openChooser} className="flex items-center gap-1.5 rounded-full px-3 py-0.5 bg-fn hover:bg-fn-dark font-semibold">
        <Icon.Play size={12} /> Footnote demo
      </button>
    </div>
  );
}

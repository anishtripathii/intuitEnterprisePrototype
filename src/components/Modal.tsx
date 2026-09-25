"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { Icon } from "./icons";

function useEscape(onClose: () => void) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);
}

export function Modal({ title, eyebrow, onClose, children, footer, width = 560 }: { title: string; eyebrow?: React.ReactNode; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode; width?: number }) {
  useEscape(onClose);
  // Portaled to <body> so an animated (transformed) ancestor can't trap the fixed overlay.
  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-[#141824]/45" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-h-[90vh] flex flex-col fn-in" style={{ maxWidth: width }}>
        <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-4 border-b border-line">
          <div>
            {eyebrow ? <div className="mb-1">{eyebrow}</div> : null}
            <h2 className="text-[19px] font-semibold leading-snug">{title}</h2>
          </div>
          <button onClick={onClose} aria-label="Close" className="text-ink-3 hover:text-ink mt-0.5"><Icon.X /></button>
        </div>
        <div className="px-6 py-5 overflow-y-auto">{children}</div>
        {footer ? <div className="px-6 py-4 border-t border-line flex justify-end gap-2">{footer}</div> : null}
      </div>
    </div>,
    document.body,
  );
}

export function Drawer({ title, eyebrow, onClose, children, footer, width = 560 }: { title: React.ReactNode; eyebrow?: React.ReactNode; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode; width?: number }) {
  useEscape(onClose);
  return createPortal(
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-[#141824]/30" onClick={onClose} />
      <aside className="absolute top-0 right-0 bottom-0 bg-white shadow-2xl flex flex-col fn-slide w-full" style={{ maxWidth: width }}>
        <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-4 border-b border-line">
          <div className="min-w-0">
            {eyebrow ? <div className="mb-1">{eyebrow}</div> : null}
            <h2 className="text-[19px] font-semibold leading-snug">{title}</h2>
          </div>
          <button onClick={onClose} aria-label="Close" className="text-ink-3 hover:text-ink mt-0.5"><Icon.X /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {footer ? <div className="px-6 py-4 border-t border-line flex justify-end gap-2">{footer}</div> : null}
      </aside>
    </div>,
    document.body,
  );
}

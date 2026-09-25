import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement> & { size?: number };
const base = (size = 18, props: P) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
  ...props,
});

export const Icon = {
  Menu: ({ size, ...p }: P) => (<svg {...base(size, p)}><path d="M4 6h16M4 12h16M4 18h16" /></svg>),
  Chevron: ({ size, ...p }: P) => (<svg {...base(size, p)}><path d="m6 9 6 6 6-6" /></svg>),
  ChevronRight: ({ size, ...p }: P) => (<svg {...base(size, p)}><path d="m9 6 6 6-6 6" /></svg>),
  Search: ({ size, ...p }: P) => (<svg {...base(size, p)}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>),
  Bell: ({ size, ...p }: P) => (<svg {...base(size, p)}><path d="M6 8a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8" /><path d="M10 21a2 2 0 0 0 4 0" /></svg>),
  Gear: ({ size, ...p }: P) => (<svg {...base(size, p)}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" /></svg>),
  Help: ({ size, ...p }: P) => (<svg {...base(size, p)}><circle cx="12" cy="12" r="9" /><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01" /></svg>),
  Grid: ({ size, ...p }: P) => (<svg {...base(size, p)}><path d="M5 5h.01M12 5h.01M19 5h.01M5 12h.01M12 12h.01M19 12h.01M5 19h.01M12 19h.01M19 19h.01" strokeWidth={3} /></svg>),
  Clipboard: ({ size, ...p }: P) => (<svg {...base(size, p)}><rect x="6" y="4" width="12" height="17" rx="2" /><path d="M9 4V3h6v1M9 10h6M9 14h6" /></svg>),
  Megaphone: ({ size, ...p }: P) => (<svg {...base(size, p)}><path d="M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1ZM16 8a5 5 0 0 1 0 8" /></svg>),
  Plus: ({ size, ...p }: P) => (<svg {...base(size, p)}><path d="M12 5v14M5 12h14" /></svg>),
  X: ({ size, ...p }: P) => (<svg {...base(size, p)}><path d="M6 6l12 12M18 6 6 18" /></svg>),
  Check: ({ size, ...p }: P) => (<svg {...base(size, p)}><path d="m5 12 5 5 9-10" /></svg>),
  Alert: ({ size, ...p }: P) => (<svg {...base(size, p)}><path d="M12 3 2 20h20L12 3ZM12 10v4M12 17h.01" /></svg>),
  Clock: ({ size, ...p }: P) => (<svg {...base(size, p)}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>),
  Phone: ({ size, ...p }: P) => (<svg {...base(size, p)}><rect x="7" y="2" width="10" height="20" rx="2" /><path d="M11 18h2" /></svg>),
  Clip: ({ size, ...p }: P) => (<svg {...base(size, p)}><path d="m21 11-8.5 8.5a5 5 0 0 1-7-7L14 4a3.5 3.5 0 0 1 5 5l-8.5 8.5a2 2 0 0 1-3-3L15 7" /></svg>),
  Spark: ({ size, ...p }: P) => (<svg {...base(size, p)}><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3ZM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8L19 16Z" /></svg>),
  Link: ({ size, ...p }: P) => (<svg {...base(size, p)}><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></svg>),
  Send: ({ size, ...p }: P) => (<svg {...base(size, p)}><path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7Z" /></svg>),
  User: ({ size, ...p }: P) => (<svg {...base(size, p)}><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg>),
  Camera: ({ size, ...p }: P) => (<svg {...base(size, p)}><path d="M4 7h3l2-3h6l2 3h3a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1Z" /><circle cx="12" cy="13" r="4" /></svg>),
  Doc: ({ size, ...p }: P) => (<svg {...base(size, p)}><path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8l-5-5Z" /><path d="M14 3v5h5M9 13h6M9 17h6" /></svg>),
  Lock: ({ size, ...p }: P) => (<svg {...base(size, p)}><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>),
  Bank: ({ size, ...p }: P) => (<svg {...base(size, p)}><path d="M3 10 12 4l9 6M5 10v8M9 10v8M15 10v8M19 10v8M3 20h18" /></svg>),
  Refresh: ({ size, ...p }: P) => (<svg {...base(size, p)}><path d="M20 11a8 8 0 0 0-14.9-3M4 5v4h4M4 13a8 8 0 0 0 14.9 3M20 19v-4h-4" /></svg>),
  Arrow: ({ size, ...p }: P) => (<svg {...base(size, p)}><path d="M5 12h14M13 6l6 6-6 6" /></svg>),
  Code: ({ size, ...p }: P) => (<svg {...base(size, p)}><path d="m8 7-5 5 5 5M16 7l5 5-5 5" /></svg>),
  Undo: ({ size, ...p }: P) => (<svg {...base(size, p)}><path d="M9 14 4 9l5-5" /><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" /></svg>),
  Shield: ({ size, ...p }: P) => (<svg {...base(size, p)}><path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6l-8-3Z" /><path d="m9 12 2 2 4-4" /></svg>),
  Play: ({ size, ...p }: P) => (<svg {...base(size, p)}><path d="M7 4v16l13-8L7 4Z" /></svg>),
  Beaker: ({ size, ...p }: P) => (<svg {...base(size, p)}><path d="M9 3h6M10 3v6L4.5 18.5A1.7 1.7 0 0 0 6 21h12a1.7 1.7 0 0 0 1.5-2.5L14 9V3" /><path d="M7 15h10" /></svg>),
  Store: ({ size, ...p }: P) => (<svg {...base(size, p)}><path d="M4 9 5.5 4h13L20 9M4 9h16v11H4V9Zm0 0a2.7 2.7 0 0 0 5.3 0 2.7 2.7 0 0 0 5.4 0 2.7 2.7 0 0 0 5.3 0M10 20v-5h4v5" /></svg>),
  Mail: ({ size, ...p }: P) => (<svg {...base(size, p)}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></svg>),
  ArrowLeft: ({ size, ...p }: P) => (<svg {...base(size, p)}><path d="M19 12H5M11 6l-6 6 6 6" /></svg>),
  Sliders: ({ size, ...p }: P) => (<svg {...base(size, p)}><path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0" /><circle cx="16" cy="6" r="2" /><circle cx="10" cy="12" r="2" /><circle cx="18" cy="18" r="2" /></svg>),
  Map: ({ size, ...p }: P) => (<svg {...base(size, p)}><path d="m9 4-6 2v14l6-2 6 2 6-2V4l-6 2-6-2Zm0 0v14m6-12v14" /></svg>),
  Minus: ({ size, ...p }: P) => (<svg {...base(size, p)}><path d="M5 12h14" /></svg>),
  Expert: ({ size, ...p }: P) => (<svg {...base(size, p)}><circle cx="12" cy="7" r="4" /><path d="M5 21v-2a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v2M16 3.5 18 2M8 3.5 6 2" /></svg>),
};

export function FootnoteLogo({ size = 16 }: { size?: number }) {
  return (
    <span
      className="inline-flex items-center justify-center rounded-full bg-fn text-white font-bold"
      style={{ width: size, height: size, fontSize: size * 0.62, lineHeight: 1 }}
      aria-hidden
    >
      ¹
    </span>
  );
}

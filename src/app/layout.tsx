import type { Metadata } from "next";
import "./globals.css";
import { db } from "@/lib/db";
import { ToastProvider } from "@/components/Toast";

export const metadata: Metadata = {
  title: "Footnote for IES",
  description: "Concept prototype for the Intuit PM case: agents do the work, every decision has a trail.",
};

export const dynamic = "force-dynamic";

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  db(); // opens (and seeds) the database, which sets the demo clock offset
  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: `window.__fnOffset=${Number(globalThis.__fnOffset ?? 0)};` }} />
      </head>
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}

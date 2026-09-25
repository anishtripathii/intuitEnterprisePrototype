import type { Metadata } from "next";
import "./globals.css";
import { currentOffset, withWs } from "@/lib/db";
import { ToastProvider } from "@/components/Toast";

export const metadata: Metadata = {
  title: "Footnote for IES",
  description: "Concept prototype for the Intuit PM case: agents do the work, every decision has a trail.",
};

export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // Opens (and on first visit, seeds) this visitor's demo copy and reads its clock offset.
  const offset = await withWs(async () => currentOffset());
  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: `window.__fnOffset=${Number(offset)};` }} />
      </head>
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}

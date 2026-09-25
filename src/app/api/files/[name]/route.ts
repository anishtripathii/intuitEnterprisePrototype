import fs from "node:fs";
import path from "node:path";
import { UPLOAD_DIR } from "@/lib/db";

const TYPES: Record<string, string> = { svg: "image/svg+xml", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", heic: "image/heic", webp: "image/webp", gif: "image/gif", pdf: "application/pdf" };

export async function GET(_req: Request, ctx: { params: Promise<{ name: string }> }) {
  const { name } = await ctx.params;
  const safe = path.basename(name);
  const p = path.join(UPLOAD_DIR, safe);
  if (!fs.existsSync(p)) return new Response("Not found", { status: 404 });
  const ext = safe.split(".").pop()?.toLowerCase() ?? "";
  return new Response(fs.readFileSync(p), { headers: { "content-type": TYPES[ext] ?? "application/octet-stream", "cache-control": "no-store" } });
}

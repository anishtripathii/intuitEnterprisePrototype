import { run, setSetting } from "@/lib/db";
import { policies } from "@/lib/model";
import { isResponse, json, requireUser } from "@/lib/api";

export async function POST(req: Request) {
  const u = await requireUser(["controller", "cfo"]);
  if (isResponse(u)) return u;
  const body = (await req.json()) as { policies?: { key: string; mode: string; limit_amount: number | null }[]; materiality?: number };
  const current = policies();
  for (const p of body.policies ?? []) {
    const cur = current.find((c) => c.key === p.key);
    if (!cur || !cur.editable) continue;
    const mode = ["auto", "approval"].includes(p.mode) ? p.mode : cur.mode;
    const limit = p.limit_amount === null || p.limit_amount === undefined || Number.isNaN(Number(p.limit_amount)) ? null : Math.max(0, Number(p.limit_amount));
    run("update policies set mode=?, limit_amount=? where key=?", mode, limit, p.key);
  }
  if (body.materiality !== undefined && Number(body.materiality) >= 0) setSetting("materiality", String(Math.round(Number(body.materiality))));
  return json({ ok: true, message: "Policies saved" });
}

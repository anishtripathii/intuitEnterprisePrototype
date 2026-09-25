import { createAgent, evaluate, publish, saveConfig, submitSecurity } from "@/lib/dev";
import { isResponse, json, requireUser } from "@/lib/api";

export async function POST(req: Request, ctx: { params: Promise<{ action: string }> }) {
  const u = await requireUser(["developer"]);
  if (isResponse(u)) return u;
  const { action } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const r =
    action === "create" ? (createAgent(u.id), { ok: true, message: "Agent created from the Reconciliation template" })
    : action === "save" ? saveConfig(u.id, body)
    : action === "evaluate" ? evaluate(u.id)
    : action === "security" ? submitSecurity(u.id)
    : action === "publish" ? publish(u.id)
    : { ok: false, message: "Unknown action" };
  return r.ok ? json(r) : json({ error: r.message }, 409);
}

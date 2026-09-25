import { createAgent, evaluate, publish, saveConfig, submitSecurity } from "@/lib/dev";
import { handler, isResponse, json, requireUser } from "@/lib/api";

export const POST = handler(async (req, ctx: { params: Promise<{ action: string }> }) => {
  const u = await requireUser(["developer"]);
  if (isResponse(u)) return u;
  const { action } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const r =
    action === "create" ? (await createAgent(u.id), { ok: true, message: "Agent created from the Reconciliation template" })
    : action === "save" ? await saveConfig(u.id, body)
    : action === "evaluate" ? await evaluate(u.id)
    : action === "security" ? await submitSecurity(u.id)
    : action === "publish" ? await publish(u.id)
    : { ok: false, message: "Unknown action" };
  return r.ok ? json(r) : json({ error: r.message }, 409);
});

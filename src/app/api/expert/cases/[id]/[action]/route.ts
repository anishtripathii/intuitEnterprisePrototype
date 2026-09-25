import { requestInfo, returnRecommendation } from "@/lib/engine";
import { handler, isResponse, json, requireUser } from "@/lib/api";

export const POST = handler(async (req, ctx: { params: Promise<{ id: string; action: string }> }) => {
  const u = await requireUser(["accountant", "live_expert"]);
  if (isResponse(u)) return u;
  const { id, action } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as Record<string, string>;
  const r =
    action === "request-info"
      ? body.message?.trim() ? await requestInfo(id, u, body.toUserId ?? "", body.message.trim()) : { ok: false, message: "Write your question first" }
      : action === "return"
        ? await returnRecommendation(id, u, body.treatment ?? "", body.rationale ?? "")
        : { ok: false, message: "Unknown action" };
  return r.ok ? json(r) : json({ error: r.message }, 409);
});

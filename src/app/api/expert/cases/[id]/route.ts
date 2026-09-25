import { expertCase } from "@/lib/engine";
import { handler, isResponse, json, requireUser } from "@/lib/api";

export const GET = handler(async (_req, ctx: { params: Promise<{ id: string }> }) => {
  const u = await requireUser(["accountant", "live_expert"]);
  if (isResponse(u)) return u;
  const c = await expertCase((await ctx.params).id);
  if (!c || c.case.expert_id !== u.id) return json({ error: "This case isn't assigned to you." }, 404);
  return json(c);
});

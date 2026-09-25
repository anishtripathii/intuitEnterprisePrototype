import { expertCase } from "@/lib/engine";
import { isResponse, json, requireUser } from "@/lib/api";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const u = await requireUser(["accountant", "live_expert"]);
  if (isResponse(u)) return u;
  const c = expertCase((await ctx.params).id);
  if (!c || c.case.expert_id !== u.id) return json({ error: "This case isn't assigned to you." }, 404);
  return json(c);
}

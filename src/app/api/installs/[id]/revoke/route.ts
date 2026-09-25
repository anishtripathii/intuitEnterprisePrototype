import { revokeInstall } from "@/lib/engine";
import { isResponse, json, requireUser } from "@/lib/api";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const u = await requireUser(["controller", "cfo"]);
  if (isResponse(u)) return u;
  return revokeInstall(Number((await ctx.params).id), u) ? json({ ok: true, message: "Access removed" }) : json({ error: "Not found" }, 404);
}

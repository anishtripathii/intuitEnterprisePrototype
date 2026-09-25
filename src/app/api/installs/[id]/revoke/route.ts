import { revokeInstall } from "@/lib/engine";
import { handler, isResponse, json, requireUser } from "@/lib/api";

export const POST = handler(async (_req, ctx: { params: Promise<{ id: string }> }) => {
  const u = await requireUser(["controller", "cfo"]);
  if (isResponse(u)) return u;
  return (await revokeInstall(Number((await ctx.params).id), u)) ? json({ ok: true, message: "Access removed" }) : json({ error: "Not found" }, 404);
});

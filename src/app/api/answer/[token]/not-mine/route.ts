import { one } from "@/lib/db";
import { passOn } from "@/lib/engine";
import type { QuestionRow } from "@/lib/model";
import { handler, json } from "@/lib/api";

export const POST = handler(async (req, ctx: { params: Promise<{ token: string }> }) => {
  const q = await one<QuestionRow>("select * from questions where token=?", (await ctx.params).token);
  if (!q) return json({ error: "This link has expired." }, 404);
  const { suggestUserId } = (await req.json().catch(() => ({}))) as { suggestUserId?: string };
  return (await passOn(q.id, suggestUserId || null)) ? json({ ok: true }) : json({ error: "This question is already closed." }, 409);
});

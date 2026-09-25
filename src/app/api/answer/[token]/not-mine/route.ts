import { one } from "@/lib/db";
import { passOn } from "@/lib/engine";
import type { QuestionRow } from "@/lib/model";
import { json } from "@/lib/api";

export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const q = one<QuestionRow>("select * from questions where token=?", (await ctx.params).token);
  if (!q) return json({ error: "This link has expired." }, 404);
  const { suggestUserId } = (await req.json().catch(() => ({}))) as { suggestUserId?: string };
  return passOn(q.id, suggestUserId || null) ? json({ ok: true }) : json({ error: "This question is already closed." }, 409);
}

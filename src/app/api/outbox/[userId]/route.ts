import { db } from "@/lib/db";
import { json } from "@/lib/api";

// Demo-only: the simulated phone reads the texts/emails a person received.
export async function GET(_req: Request, ctx: { params: Promise<{ userId: string }> }) {
  const { userId } = await ctx.params;
  const user = db().prepare("select id,name,phone,title,initials,color from users where id=?").get(userId);
  if (!user) return json({ error: "Unknown user" }, 404);
  const rows = db()
    .prepare("select o.*, q.status as q_status, q.answer_label from outbox o left join questions q on o.link = '/a/' || q.token where o.user_id=? order by o.created_at asc, o.id asc")
    .all(userId);
  return json({ user, messages: rows });
}

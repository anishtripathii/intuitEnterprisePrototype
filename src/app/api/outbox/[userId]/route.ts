import { all, one } from "@/lib/db";
import { handler, json } from "@/lib/api";

// Demo-only: the simulated phone reads the texts a person received in this visitor's demo copy.
export const GET = handler(async (_req, ctx: { params: Promise<{ userId: string }> }) => {
  const { userId } = await ctx.params;
  const user = await one("select id,name,phone,title,initials,color from users where id=?", userId);
  if (!user) return json({ error: "Unknown user" }, 404);
  const messages = await all(
    "select o.*, q.status as q_status, q.answer_label from outbox o left join questions q on o.link = '/a/' || q.token where o.user_id=? order by o.created_at asc, o.id asc",
    userId,
  );
  return json({ user, messages });
});

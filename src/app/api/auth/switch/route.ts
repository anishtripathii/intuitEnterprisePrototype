import { one } from "@/lib/db";
import { createSession, currentUser, homeFor } from "@/lib/auth";
import { handler, json } from "@/lib/api";

// Demo convenience: switch between the people in the story without typing passwords.
export const POST = handler(async (req) => {
  const me = await currentUser();
  const { userId } = (await req.json()) as { userId?: string };
  const target = await one<{ id: string; role: string }>("select id, role from users where id=?", userId ?? "");
  if (!target) return json({ error: "Unknown user" }, 404);
  if (!me && !req.headers.get("x-demo-login")) return json({ error: "Sign in required" }, 401);
  await createSession(target.id);
  return json({ home: homeFor(target.role, target.id) });
});

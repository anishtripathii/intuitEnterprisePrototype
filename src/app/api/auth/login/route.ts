import { one } from "@/lib/db";
import { verifyPassword } from "@/lib/hash";
import { createSession, homeFor } from "@/lib/auth";
import { handler, json } from "@/lib/api";

export const POST = handler(async (req) => {
  const { email, password } = (await req.json()) as { email?: string; password?: string };
  const u = await one<{ id: string; role: string; password_hash: string }>("select id, role, password_hash from users where lower(email)=lower(?)", email ?? "");
  if (!u || !verifyPassword(password ?? "", u.password_hash)) return json({ error: "That email and password don't match a demo account." }, 401);
  await createSession(u.id);
  return json({ home: homeFor(u.role, u.id) });
});

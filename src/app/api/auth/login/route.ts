import { db } from "@/lib/db";
import { verifyPassword } from "@/lib/hash";
import { createSession, homeFor } from "@/lib/auth";
import { json } from "@/lib/api";

export async function POST(req: Request) {
  const { email, password } = (await req.json()) as { email?: string; password?: string };
  const u = db().prepare("select id, role, password_hash from users where lower(email)=lower(?)").get(email ?? "") as { id: string; role: string; password_hash: string } | undefined;
  if (!u || !verifyPassword(password ?? "", u.password_hash)) return json({ error: "That email and password don't match a demo account." }, 401);
  await createSession(u.id);
  return json({ home: homeFor(u.role, u.id) });
}

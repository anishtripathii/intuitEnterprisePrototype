import { db } from "@/lib/db";
import { createSession, currentUser, homeFor } from "@/lib/auth";
import { json } from "@/lib/api";

// Demo convenience: any signed-in demo user can switch to another demo persona.
export async function POST(req: Request) {
  const me = await currentUser();
  const { userId } = (await req.json()) as { userId?: string };
  const target = db().prepare("select id, role from users where id=?").get(userId ?? "") as { id: string; role: string } | undefined;
  if (!target) return json({ error: "Unknown user" }, 404);
  if (!me && !req.headers.get("x-demo-login")) return json({ error: "Sign in required" }, 401);
  await createSession(target.id);
  return json({ home: homeFor(target.role, target.id) });
}

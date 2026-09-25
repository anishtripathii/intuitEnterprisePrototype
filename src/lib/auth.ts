import { cookies } from "next/headers";
import { db, nowIso } from "./db";
import { randomToken } from "./hash";

export type User = {
  id: string;
  name: string;
  email: string;
  role: string;
  title: string;
  phone: string | null;
  firm: string | null;
  initials: string;
  color: string;
};

const SESSION = "fn_session";

export async function currentUser(): Promise<User | null> {
  const c = await cookies();
  const t = c.get(SESSION)?.value;
  if (!t) return null;
  const u = db()
    .prepare("select u.id,u.name,u.email,u.role,u.title,u.phone,u.firm,u.initials,u.color from sessions s join users u on u.id=s.user_id where s.token=?")
    .get(t) as User | undefined;
  return u ?? null;
}

export async function createSession(userId: string) {
  const t = randomToken();
  db().prepare("insert into sessions(token,user_id,created_at) values(?,?,?)").run(t, userId, nowIso());
  const c = await cookies();
  c.set(SESSION, t, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 14 });
}

export async function destroySession() {
  const c = await cookies();
  const t = c.get(SESSION)?.value;
  if (t) db().prepare("delete from sessions where token=?").run(t);
  c.delete(SESSION);
}

export function homeFor(role: string, id?: string): string {
  if (role === "accountant" || role === "live_expert") return "/expert";
  if (role === "developer") return "/developer";
  if (role === "pm") return id ? `/phone/${id}` : "/login";
  if (role === "cfo") return "/reports";
  return "/close";
}

export const IES_ROLES = ["controller", "cfo", "bookkeeper"];

import { cookies } from "next/headers";
import { currentWorkspaceId, dropWorkspace, newWorkspaceId, WS_COOKIE } from "@/lib/db";
import { json } from "@/lib/api";

// Gives this visitor a brand-new copy of the demo and discards the old one.
export async function POST() {
  const c = await cookies();
  const old = await currentWorkspaceId().catch(() => null);
  if (old) await dropWorkspace(old);
  c.set(WS_COOKIE, newWorkspaceId(), { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
  c.delete("fn_session");
  return json({ ok: true });
}

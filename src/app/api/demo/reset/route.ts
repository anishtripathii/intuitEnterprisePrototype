import { cookies } from "next/headers";
import { resetDb } from "@/lib/db";
import { isResponse, json, requireUser } from "@/lib/api";

export async function POST() {
  const u = await requireUser();
  if (isResponse(u)) return u;
  resetDb();
  const c = await cookies();
  c.delete("fn_session");
  return json({ ok: true });
}

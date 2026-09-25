import { all } from "@/lib/db";
import { isResponse, json, requireUser } from "@/lib/api";

export async function GET() {
  const u = await requireUser(["accountant", "live_expert"]);
  if (isResponse(u)) return u;
  return json(all("select id, question, status, fee, created_at, returned_at, decided_at from cases where expert_id=? order by created_at desc", u.id));
}

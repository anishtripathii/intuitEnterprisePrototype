import { all } from "@/lib/db";
import { handler, isResponse, json, requireUser } from "@/lib/api";

export const GET = handler(async () => {
  const u = await requireUser(["accountant", "live_expert"]);
  if (isResponse(u)) return u;
  return json(await all("select id, question, status, fee, created_at, returned_at, decided_at from cases where expert_id=? order by created_at desc", u.id));
});

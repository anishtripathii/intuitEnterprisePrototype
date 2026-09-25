import { devState } from "@/lib/dev";
import { isResponse, json, requireUser } from "@/lib/api";

export async function GET() {
  const u = await requireUser(["developer"]);
  if (isResponse(u)) return u;
  return json(devState(u.id));
}

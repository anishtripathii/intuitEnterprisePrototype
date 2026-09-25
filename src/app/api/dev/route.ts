import { devState } from "@/lib/dev";
import { handler, isResponse, json, requireUser } from "@/lib/api";

export const GET = handler(async () => {
  const u = await requireUser(["developer"]);
  if (isResponse(u)) return u;
  return json(await devState(u.id));
});

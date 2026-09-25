import { reportData } from "@/lib/report";
import { handler, isResponse, json, requireUser } from "@/lib/api";

export const GET = handler(async () => {
  const u = await requireUser(["controller", "cfo", "bookkeeper"]);
  if (isResponse(u)) return u;
  return json(await reportData());
});

import { reportData } from "@/lib/report";
import { isResponse, json, requireUser } from "@/lib/api";

export async function GET() {
  const u = await requireUser(["controller", "cfo", "bookkeeper"]);
  if (isResponse(u)) return u;
  return json(await reportData());
}

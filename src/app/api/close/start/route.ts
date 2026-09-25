import { startReview } from "@/lib/engine";
import { isResponse, json, requireUser } from "@/lib/api";

export async function POST(req: Request) {
  const u = await requireUser(["controller", "cfo", "bookkeeper"]);
  if (isResponse(u)) return u;
  const { goal, entities } = (await req.json().catch(() => ({}))) as { goal?: string; entities?: string[] };
  if (!goal?.trim()) return json({ error: "Describe what the agent should work on." }, 400);
  if (!entities?.length) return json({ error: "Choose at least one entity." }, 400);
  const id = await startReview(u.id, goal.trim(), entities);
  return json({ ok: true, runId: id });
}

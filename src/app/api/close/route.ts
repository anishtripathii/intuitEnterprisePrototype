import { all, one } from "@/lib/db";
import { issueViews, lookups, policies, readiness } from "@/lib/model";
import { isResponse, json, requireUser } from "@/lib/api";

const CONTROLLER = ["controller", "cfo", "bookkeeper"];

export async function GET() {
  const u = await requireUser(CONTROLLER);
  if (isResponse(u)) return u;
  const runRow = one<{ id: string; goal: string; entities: string; status: string; started_at: string }>("select id, goal, entities, status, started_at from runs order by started_at desc limit 1");
  const L = lookups();
  return json({
    run: runRow ? { ...runRow, entities: JSON.parse(runRow.entities) as string[] } : null,
    steps: runRow ? all("select seq, label, detail, source, outcome from run_steps where run_id=? order by seq", runRow.id) : [],
    issues: runRow ? issueViews(runRow.id) : [],
    readiness: readiness(),
    policies: policies(),
    installs: all<{ id: number; agent_id: string; name: string; entities: string; installed_at: string }>(
      "select i.id, i.agent_id, a.name, i.entities, i.installed_at from installs i join agents a on a.id=i.agent_id where i.revoked_at is null order by i.id desc",
    ).map((i) => ({ ...i, entities: JSON.parse(i.entities) as string[] })),
    projects: [...L.projects.values()].map((p) => ({ id: p.id, name: p.name })),
    experts: [...L.users.values()].filter((x) => x.role === "accountant" || x.role === "live_expert").map((x) => ({ id: x.id, name: x.name, firm: x.firm, own: x.role === "accountant" })),
  });
}

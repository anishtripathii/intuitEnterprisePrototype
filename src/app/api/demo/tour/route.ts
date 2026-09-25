import { cookies } from "next/headers";
import { createSession } from "@/lib/auth";
import { currentWorkspaceId, dropWorkspace, newWorkspaceId, one, withWs, WS_COOKIE } from "@/lib/db";
import { answerQuestion, returnRecommendation, startReview } from "@/lib/engine";
import { createAgent, evaluate, publish, saveConfig, submitSecurity } from "@/lib/dev";
import { lookups } from "@/lib/model";
import { json } from "@/lib/api";

const GOAL = "Prepare September's project-cost review for the leadership review on Oct 2. Make sure every project's margin is complete and correct.";
const RATIONALE = "This contract is satisfied over time. The foundation milestone bills 15% of the price for 12% of the cost, so milestones overstate progress. Measure by cost incurred, like Builders' other jobs, and defer the excess.";

// The guided "Footnote demo". `start` gives the visitor a fresh copy of the data, set up for the chosen
// person; the other actions play the part of someone outside the current screen (Luis, Elena).
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { action?: string; track?: string };
  try {
    if (body.action === "start") {
      const track = body.track === "developer" ? "developer" : "controller";
      const old = await currentWorkspaceId().catch(() => null);
      if (old) await dropWorkspace(old);
      const ws = newWorkspaceId();
      (await cookies()).set(WS_COOKIE, ws, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
      await withWs(async () => {
        if (track === "controller") {
          // SiteLog's agent is already live, so Priya's story can use it.
          await createAgent("u_ravi");
          await saveConfig("u_ravi", { abstainUnapproved: true });
          await evaluate("u_ravi");
          await submitSecurity("u_ravi");
          await publish("u_ravi");
          await createSession("u_priya");
        } else {
          // Priya's review has run, so Harbor & Pine is waiting on the demand board.
          await startReview("u_priya", GOAL, ["hpb"]);
          await createSession("u_ravi");
        }
      }, ws);
      return json({ ok: true, path: track === "controller" ? "/close" : "/developer" });
    }

    return await withWs(async () => {
      if (body.action === "luis-answers") {
        const q = await one<{ id: string }>("select id from questions where asked_user_id='u_luis' and status='open' order by asked_at desc limit 1");
        if (q) await answerQuestion(q.id, { value: "p_oak", label: "Oak Ave Retail Fit-out" }, { name: "Luis Romero", via: "by text, in one tap" });
        return json({ ok: true });
      }
      if (body.action === "elena-returns") {
        const c = await one<{ id: string }>("select id from cases where expert_id='u_elena' and status in ('with_expert','info_requested') order by created_at desc limit 1");
        const elena = (await lookups()).users.get("u_elena");
        if (c && elena) await returnRecommendation(c.id, { id: elena.id, name: elena.name }, "cost_to_cost", RATIONALE);
        return json({ ok: true });
      }
      return json({ error: "Unknown demo step" }, 400);
    });
  } catch (e) {
    console.error("[demo tour]", e);
    return json({ error: "The demo couldn't continue. Try again." }, 500);
  }
}

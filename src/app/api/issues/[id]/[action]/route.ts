import { answerQuestion, approveIssue, getIssue, installAgent, rejectIssue, remind, replyToExpert, sendToExpert, undoIssue } from "@/lib/engine";
import { handler, isResponse, json, requireUser } from "@/lib/api";

type Ctx = { params: Promise<{ id: string; action: string }> };

export const POST = handler(async (req, ctx: Ctx) => {
  const u = await requireUser(["controller", "cfo", "bookkeeper"]);
  if (isResponse(u)) return u;
  const { id, action } = await ctx.params;
  const issue = await getIssue(id);
  if (!issue) return json({ error: "Issue not found" }, 404);
  const body = (await req.json().catch(() => ({}))) as Record<string, string | string[] | undefined>;
  const done = (r: { ok: boolean; message: string }) => (r.ok ? json(r) : json({ error: r.message }, 409));
  switch (action) {
    case "approve":
      return done(await approveIssue(id, u, { projectId: body.projectId as string | undefined }));
    case "reject":
      return done(await rejectIssue(id, u, String(body.reason ?? "")));
    case "undo":
      return done(await undoIssue(id, u));
    case "remind":
      return (await remind(id, u.name)) ? json({ ok: true, message: "Reminder sent" }) : json({ error: "There's no open question to remind about" }, 409);
    case "answer":
      if (!issue.question_id) return json({ error: "No open question" }, 409);
      return done(await answerQuestion(issue.question_id, { value: String(body.value ?? ""), label: body.label as string | undefined }, { name: u.name, via: "answered in IES" }));
    case "send-to-expert":
      return done(await sendToExpert(id, String(body.expertId ?? ""), String(body.question ?? "").trim(), u));
    case "install":
      return done(await installAgent(String(body.agentId ?? ""), (body.entities as string[]) ?? [], u, id));
    case "reply":
      if (!issue.case_id) return json({ error: "No case on this issue" }, 409);
      if (!String(body.body ?? "").trim()) return json({ error: "Write a reply first" }, 400);
      return done(await replyToExpert(issue.case_id, u, String(body.body).trim()));
    default:
      return json({ error: "Unknown action" }, 404);
  }
});

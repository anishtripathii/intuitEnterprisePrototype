import { one } from "@/lib/db";
import { answerQuestion } from "@/lib/engine";
import { lookups, type QuestionRow, type Txn } from "@/lib/model";
import { handler, json } from "@/lib/api";
import { money, niceDate } from "@/lib/format";

type Ctx = { params: Promise<{ token: string }> };

// Public, no-login endpoint behind the link in a text message. The token is the only credential,
// and it opens this one question.
async function load(token: string) {
  const q = await one<QuestionRow>("select * from questions where token=?", token);
  if (!q) return null;
  const t = q.txn_id ? await one<Txn>("select * from transactions where id=?", q.txn_id) : undefined;
  return { q, t, L: await lookups() };
}

export const GET = handler(async (_req, ctx: Ctx) => {
  const r = await load((await ctx.params).token);
  if (!r) return json({ error: "This link has expired." }, 404);
  const { q, t, L } = r;
  const expertId = q.case_id ? (await one<{ expert_id: string }>("select expert_id from cases where id=?", q.case_id))?.expert_id : null;
  const asker = expertId ? L.users.get(expertId) : null;
  const receipt = t ? await one<{ file: string }>("select file from receipts where matched_txn_id=?", t.id) : undefined;
  return json({
    status: q.status,
    prompt: q.prompt,
    options: JSON.parse(q.options),
    askedName: L.users.get(q.asked_user_id)?.name ?? "",
    from: asker ? `${asker.name} · ${asker.firm}` : "Harbor & Pine finance",
    vendor: t ? L.vendors.get(t.vendor_id ?? "") ?? t.description : null,
    amount: t ? money(t.amount) : null,
    date: t ? niceDate(t.date) : null,
    receipt: receipt?.file ?? null,
    answerLabel: q.answer_label,
    others: [...L.users.values()].filter((u) => ["pm", "controller"].includes(u.role) && u.id !== q.asked_user_id).map((u) => ({ id: u.id, name: u.name, title: u.title })),
  });
});

export const POST = handler(async (req, ctx: Ctx) => {
  const r = await load((await ctx.params).token);
  if (!r) return json({ error: "This link has expired." }, 404);
  const { q, L } = r;
  if (q.status !== "open") return json({ error: "Already answered. Thanks!" }, 409);
  const body = (await req.json().catch(() => ({}))) as { value?: string; label?: string; note?: string };
  if (!body.value) return json({ error: "Pick an answer first." }, 400);
  const res = await answerQuestion(q.id, { value: body.value, label: body.label, note: body.note?.trim() || null }, { name: L.users.get(q.asked_user_id)?.name ?? "Unknown", via: "by text, in one tap" });
  return res.ok ? json(res) : json({ error: res.message }, 409);
});

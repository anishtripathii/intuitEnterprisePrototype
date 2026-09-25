import Anthropic from "@anthropic-ai/sdk";
import { nowIso, one, run } from "./db";

// Claude writes three things in Footnote: the text sent to a person, the expert case summary, and
// the margin note for the CFO. Without credentials the app uses templates built from the same evidence.
const MODEL = "claude-opus-5";

let client: Anthropic | null = null;
let disabled = false;

export function aiAvailable(): boolean {
  return !disabled && !!(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

async function generate(system: string, prompt: string, maxTokens = 2000): Promise<string | null> {
  if (!aiAvailable()) return null;
  try {
    client ??= new Anthropic();
    const res = await client.beta.messages.create(
      {
        model: MODEL,
        max_tokens: maxTokens,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        output_config: { effort: "low" },
        system,
        messages: [{ role: "user", content: prompt }],
      },
      { timeout: 45_000 },
    );
    if (res.stop_reason === "refusal") return null;
    const text = res.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();
    return text || null;
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
      disabled = true;
    }
    console.error("[footnote-ai]", error instanceof Anthropic.APIError ? `${error.status} ${error.message}` : error);
    return null;
  }
}

async function cached(key: string): Promise<string | null> {
  const row = await one<{ value: string }>("select value from ai_cache where key=?", key);
  return row?.value ?? null;
}
async function store(key: string, value: string) {
  await run("insert into ai_cache(key,value,created_at) values(?,?,?) on conflict(key) do update set value=excluded.value", key, value, nowIso());
}

export async function phraseQuestion(input: { vendor: string; amount: string; date: string; card: string | null; fact: string; recipientFirstName: string }, fallback: string): Promise<{ text: string; ai: boolean }> {
  const out = await generate(
    "You write one-line text messages from a company's finance team to a non-finance employee. Plain language, no accounting jargon, under 160 characters, no greeting, no emoji. End with the question.",
    `Write the SMS asking ${input.recipientFirstName} for this missing fact.\nPurchase: ${input.vendor}, ${input.amount}, ${input.date}${input.card ? `, company card ending ${input.card}` : ""}.\nMissing fact: ${input.fact === "project" ? "which job/project it was for, plus a receipt photo" : input.fact === "purpose" ? "what the purchase was for (office supplies, job materials, or software)" : input.fact}.`,
    300,
  );
  return out ? { text: out.replace(/^"|"$/g, ""), ai: true } : { text: fallback, ai: false };
}

export async function explainMargins(key: string, input: Record<string, unknown>, fallback: string): Promise<{ text: string; ai: boolean }> {
  const hit = await cached(key);
  if (hit) return { text: hit, ai: true };
  const out = await generate(
    "You write the note a controller sends the CFO with September project margins. 3-4 short sentences, plain English. Only use the numbers provided. Say which margins moved, why, who confirmed or approved each change, and what is still open. No preamble, no bullet points.",
    JSON.stringify(input),
    700,
  );
  if (out) {
    await store(key, out);
    return { text: out, ai: true };
  }
  return { text: fallback, ai: false };
}

export async function summarizeCase(key: string, input: Record<string, unknown>, fallback: string): Promise<{ text: string; ai: boolean }> {
  const hit = await cached(key);
  if (hit) return { text: hit, ai: true };
  const out = await generate(
    "You prepare a case file for an outside CPA who will make an accounting judgment call. Write 3-5 bullet points (start each with '• '): the facts, the evidence available, and the exact decision needed. Neutral, factual, no recommendation.",
    JSON.stringify(input),
    800,
  );
  if (out) {
    await store(key, out);
    return { text: out, ai: true };
  }
  return { text: fallback, ai: false };
}

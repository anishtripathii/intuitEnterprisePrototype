import { demoFile } from "@/lib/files";

export async function GET(_req: Request, ctx: { params: Promise<{ name: string }> }) {
  const body = demoFile((await ctx.params).name);
  if (!body) return new Response("Not found", { status: 404 });
  return new Response(body, { headers: { "content-type": "image/svg+xml", "cache-control": "public, max-age=3600" } });
}

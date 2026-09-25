import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { dropWorkspace, newWorkspaceId, WS_COOKIE, WS_PATTERN } from "@/lib/db";

export const dynamic = "force-dynamic";

// A link that starts the prototype over: this visitor's demo copy is discarded, they're signed out,
// any guided demo in progress ends, and they land on the sign-in page with fresh data.
export async function GET(req: Request) {
  const c = await cookies();
  const old = c.get(WS_COOKIE)?.value;
  if (old && WS_PATTERN.test(old)) await dropWorkspace(old).catch((e) => console.error("[reset]", e));
  c.set(WS_COOKIE, newWorkspaceId(), { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
  c.delete("fn_session");
  c.delete("fn_tour");
  return NextResponse.redirect(new URL("/login", req.url), { headers: { "cache-control": "no-store" } });
}

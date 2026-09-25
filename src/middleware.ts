import { NextResponse, type NextRequest } from "next/server";

const WS_COOKIE = "fn_ws";
const WS_PATTERN = /^[a-z0-9]{12}$/;

// Every visitor gets their own demo copy, identified by this cookie. The database schema for it is
// created on the first request that needs it.
export function middleware(req: NextRequest) {
  const ws = req.cookies.get(WS_COOKIE)?.value;
  if (ws && WS_PATTERN.test(ws)) return NextResponse.next();
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  const id = [...crypto.getRandomValues(new Uint8Array(12))].map((b) => chars[b % chars.length]).join("");
  req.cookies.set(WS_COOKIE, id);
  const res = NextResponse.next({ request: { headers: req.headers } });
  res.cookies.set(WS_COOKIE, id, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/files).*)"],
};

import { NextResponse } from "next/server";
import { currentUser, type User } from "./auth";
import { withWs } from "./db";

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

export async function requireUser(roles?: string[]): Promise<User | NextResponse> {
  const u = await currentUser();
  if (!u) return json({ error: "Sign in required" }, 401);
  if (roles && !roles.includes(u.role)) return json({ error: "Not allowed for this role" }, 403);
  return u;
}

export function isResponse(x: unknown): x is NextResponse {
  return x instanceof NextResponse;
}

// Runs a route handler inside the visitor's demo workspace (one transaction per request).
export function handler<C>(fn: (req: Request, ctx: C) => Promise<Response>) {
  return async (req: Request, ctx: C): Promise<Response> => {
    try {
      return await withWs(() => fn(req, ctx));
    } catch (e) {
      console.error("[api]", e);
      return json({ error: "Something went wrong on the server. Try again." }, 500);
    }
  };
}

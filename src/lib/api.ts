import { NextResponse } from "next/server";
import { currentUser, type User } from "./auth";

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

export const FINANCE_ROLES = ["controller", "cfo", "bookkeeper", "entity_accountant"];

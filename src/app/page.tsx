import { redirect } from "next/navigation";
import { currentUser, homeFor } from "@/lib/auth";
import { withWs } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function Home() {
  const u = await withWs(() => currentUser());
  redirect(u ? homeFor(u.role, u.id) : "/login");
}

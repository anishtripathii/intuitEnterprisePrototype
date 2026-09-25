import { redirect } from "next/navigation";
import Shell, { type ShellUser } from "@/components/shell/Shell";
import { currentUser, homeFor, IES_ROLES } from "@/lib/auth";
import { all, one } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function IesLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (!IES_ROLES.includes(user.role)) redirect(homeFor(user.role, user.id));
  const users = all<ShellUser>("select id,name,role,title,initials,color from users where id != 'u_aisha' order by rowid");
  const needsYou = one<{ n: number }>("select count(*) n from issues where status in ('needs_approval','needs_agent','needs_expert','expert_returned')")?.n ?? 0;
  return (
    <Shell user={user} users={users} needsYou={needsYou}>
      {children}
    </Shell>
  );
}

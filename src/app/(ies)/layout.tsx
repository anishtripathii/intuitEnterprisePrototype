import { redirect } from "next/navigation";
import Shell, { type ShellUser } from "@/components/shell/Shell";
import { currentUser, homeFor, IES_ROLES, type User } from "@/lib/auth";
import { all, withWs } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function IesLayout({ children }: { children: React.ReactNode }) {
  const data = await withWs(async () => {
    const user = await currentUser();
    if (!user) return null;
    const users = await all<ShellUser>("select id,name,role,title,initials,color from users where id != 'u_aisha' order by sort");
    return { user, users };
  });
  if (!data) redirect("/login");
  const user: User = data.user;
  if (!IES_ROLES.includes(user.role)) redirect(homeFor(user.role, user.id));
  return (
    <Shell user={user} users={data.users}>
      {children}
    </Shell>
  );
}

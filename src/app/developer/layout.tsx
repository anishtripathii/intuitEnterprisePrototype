import { redirect } from "next/navigation";
import PortalBar from "@/components/shell/PortalBar";
import type { ShellUser } from "@/components/shell/Shell";
import { currentUser, homeFor } from "@/lib/auth";
import { all, withWs } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function DeveloperLayout({ children }: { children: React.ReactNode }) {
  const data = await withWs(async () => {
    const user = await currentUser();
    const users = await all<ShellUser>("select id,name,role,title,initials,color from users where id != 'u_aisha' order by sort");
    return { user, users };
  });
  const user = data.user;
  if (!user) redirect("/login");
  if (user.role !== "developer") redirect(homeFor(user.role, user.id));
  return (
    <div className="min-h-screen bg-canvas">
      <PortalBar
        user={user}
        users={data.users}
        product={<><div className="text-[11px] tracking-[0.14em] font-bold opacity-80">INTUIT DEVELOPER</div><div className="text-[15px] font-semibold">Footnote agent platform</div></>}
        links={[{ label: "My agents", href: "/developer" }]}
      />
      <main>{children}</main>
    </div>
  );
}

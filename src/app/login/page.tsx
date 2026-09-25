import { all, withWs } from "@/lib/db";
import LoginForm from "./LoginForm";

export const dynamic = "force-dynamic";

type U = { id: string; name: string; email: string; role: string; title: string; initials: string; color: string };

export default async function LoginPage() {
  const users = await withWs(() => all<U>("select id,name,email,role,title,initials,color from users where id != 'u_aisha' order by sort"));
  return <LoginForm users={users} />;
}

import { db } from "@/lib/db";
import LoginForm from "./LoginForm";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  const users = db().prepare("select id,name,email,role,title,initials,color from users where id != 'u_aisha' order by rowid").all() as {
    id: string; name: string; email: string; role: string; title: string; initials: string; color: string;
  }[];
  return <LoginForm users={users} />;
}

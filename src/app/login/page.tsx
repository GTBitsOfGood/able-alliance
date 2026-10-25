import { redirect } from "next/navigation";
import { auth } from "@/auth";
import LoginContent from "./LoginContent";

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) {
    if (session.user.type === "Admin" || session.user.type === "SuperAdmin") {
      redirect("/admin");
    }
    if (session.user.type === "Student" || session.user.type === "Driver") {
      redirect("/rides");
    }
  }

  return <LoginContent />;
}

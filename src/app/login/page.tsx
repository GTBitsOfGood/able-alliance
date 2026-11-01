import { redirect } from "next/navigation";
import { auth } from "@/auth";
import LoginContent from "./LoginContent";

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) {
    if (
      session.user.activeType === "Admin" ||
      session.user.activeType === "SuperAdmin"
    ) {
      redirect("/admin");
    }
    if (
      session.user.activeType === "Student" ||
      session.user.activeType === "Driver"
    ) {
      redirect("/rides");
    }
  }

  return <LoginContent />;
}

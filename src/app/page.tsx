"use client";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import React, { useEffect } from "react";

export default function Home() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const userType = session?.user?.type;

  useEffect(() => {
    if (status === "loading") return;
    if (userType === "Admin" || userType === "SuperAdmin") {
      router.replace("/admin");
    } else if (userType === "Student" || userType === "Driver") {
      router.replace("/rides");
    }
  }, [status, userType, router]);

  return null;
}

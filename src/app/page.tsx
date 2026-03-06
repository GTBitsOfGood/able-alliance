"use client";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import React, { useEffect } from "react";
export default function Home() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const userType = session?.user?.type;
  useEffect(() => {
    if (userType === "Admin" || userType === "SuperAdmin") {
      router.replace("/admin");
    }
  }, [status, userType, router]);
  return <div>Test</div>;
}

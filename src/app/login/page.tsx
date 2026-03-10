"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import Link from "next/link";
import styles from "./styles.module.css";

const ERROR_MESSAGES: Record<string, string> = {
  no_ticket: "No authentication ticket was provided.",
  invalid_ticket: "Your login ticket was invalid or expired.",
  user_not_found: "Your account is not registered in this application.",
  cas_unavailable: "The authentication server is unavailable.",
  server_error: "An unexpected error occurred.",
};

function LoginContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.content}>
          {/* Header Row with Logo, Divider, and Service Label */}
          <div className={styles.headerRow}>
            <div className={styles.logoImage}></div>
            <div className={styles.divider}></div>
            <div className={styles.serviceText}>
              Parking and Transportation Services
            </div>
          </div>

          {/* Main Heading */}
          <h1 className={styles.appTitle}>Student Paratransit Service</h1>

          {/* Sign-in button */}
          <Link href="/api/auth/cas/login" className={styles.loginButton}>
            <span className={styles.loginButtonText}>Log in with GT SSO</span>
          </Link>

          {/* Error message */}
          {error && (
            <div className={styles.errorMessage}>
              Error:{" "}
              {ERROR_MESSAGES[error] || "An error occurred during login."}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#003057]">
          <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-xl text-center">
            Loading...
          </div>
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}

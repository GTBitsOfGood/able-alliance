"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import Link from "next/link";
import styles from "./styles.module.css";

const ERROR_MESSAGES: Record<string, string> = {
  no_ticket: "No authentication ticket was provided.",
  invalid_ticket: "Your login ticket was invalid or expired.",
  user_not_found:
    "No account found. If you are a student, contact Office of Disability Services to register an account.",
  cas_unavailable: "The authentication server is unavailable.",
  server_error: "An unexpected error occurred.",
};

function LoginContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");

  return (
    <div className={styles.container}>
      {error && (
        <div className={styles.errorBanner} role="alert">
          <svg
            className={styles.errorBannerIcon}
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span>
            <strong>Error:</strong>{" "}
            {ERROR_MESSAGES[error] ?? "An error occurred during login."}
          </span>
        </div>
      )}
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

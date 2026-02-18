"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

const ERROR_MESSAGES: Record<string, string> = {
  no_ticket: "No authentication ticket was provided. Please try again.",
  invalid_ticket: "Your login ticket was invalid or expired. Please try again.",
  cas_unavailable:
    "The authentication server is unavailable. Please try again later.",
  server_error: "An unexpected error occurred. Please try again.",
};

function LoginContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#003057]">
      <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-xl">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-[#003057]">Able Alliance</h1>
          <p className="mt-1 text-sm text-[#B3A369]">
            Georgia Tech Accessible Transit
          </p>
        </div>

        {/* Error message */}
        {error && (
          <div className="mb-6 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {ERROR_MESSAGES[error] || "An error occurred during login."}
          </div>
        )}

        {/* Sign-in button */}
        <a
          href="/api/auth/cas/login"
          className="flex w-full items-center justify-center rounded-md bg-[#003057] px-4 py-3 text-base font-semibold text-white transition-colors hover:bg-[#004080]"
        >
          <svg
            className="mr-2 h-5 w-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
          </svg>
          Sign in with Georgia Tech
        </a>

        <p className="mt-6 text-center text-xs text-gray-500">
          You will be redirected to Georgia Tech&apos;s Central Authentication
          Service (CAS) to log in with your GT credentials.
        </p>
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

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import styles from "./AppNavbar.module.css";

export default function AppNavbar() {
  const pathname = usePathname();
  const { data: session, status } = useSession();

  if (pathname === "/login") return null;
  if (status !== "authenticated") return null;

  const userType = session.user?.type;
  const showRides = userType === "Student" || userType === "Driver";
  const showAdmin = userType === "Admin" || userType === "SuperAdmin";
  const fullName =
    [session.user?.firstName, session.user?.lastName]
      .filter(Boolean)
      .join(" ") ||
    session.user?.name ||
    "User";
  const avatarLetter = fullName.charAt(0).toUpperCase();

  return (
    <header className={styles.navbar}>
      <div className={styles.inner}>
        <div className={styles.left}>
          <h3 className={styles.brand}>GT Paratransit</h3>

          <nav className={styles.navLinks} aria-label="Primary navigation">
            {showRides && (
              <Link href="/rides" className={styles.link}>
                Your Rides
              </Link>
            )}
            {showAdmin && (
              <Link href="/admin" className={styles.link}>
                Admin Dashboard
              </Link>
            )}
          </nav>
        </div>

        <div className={styles.right}>
          <Link
            href={`/profile/${session.user.userId}`}
            className={styles.profileLink}
          >
            <span className={styles.avatar} aria-hidden="true">
              {avatarLetter}
            </span>
            <span className={styles.userName}>{fullName}</span>
          </Link>
        </div>
      </div>
    </header>
  );
}

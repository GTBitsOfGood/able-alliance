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

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  const linkClass = (href: string) =>
    `${styles.link} ${isActive(href) ? styles.linkActive : ""}`.trim();

  // The profile name is a nav link too, so it takes the same active treatment.
  const profileHref = `/profile/${session.user.userId}`;
  const profileActive = isActive(profileHref);

  const avatarClass =
    userType === "Driver"
      ? styles.avatarDriver
      : userType === "Admin" || userType === "SuperAdmin"
        ? styles.avatarAdmin
        : styles.avatarStudent;

  return (
    <header className={styles.navbar}>
      <div className={styles.inner}>
        <div className={styles.left}>
          <h3 className={styles.brand}>GT Paratransit</h3>

          <nav className={styles.navLinks} aria-label="Primary navigation">
            {showRides && (
              <Link
                href="/rides"
                className={linkClass("/rides")}
                aria-current={isActive("/rides") ? "page" : undefined}
              >
                Your Rides
              </Link>
            )}
            {showAdmin && (
              <Link
                href="/admin"
                className={linkClass("/admin")}
                aria-current={isActive("/admin") ? "page" : undefined}
              >
                Admin Dashboard
              </Link>
            )}
          </nav>
        </div>

        <div className={styles.right}>
          <Link
            href={profileHref}
            className={styles.profileLink}
            aria-current={profileActive ? "page" : undefined}
          >
            <span
              className={`${styles.avatar} ${avatarClass}`}
              aria-hidden="true"
            >
              {avatarLetter}
            </span>
            <span
              className={`${styles.userName} ${profileActive ? styles.userNameActive : ""}`.trim()}
            >
              {fullName}
            </span>
          </Link>
        </div>
      </div>
    </header>
  );
}

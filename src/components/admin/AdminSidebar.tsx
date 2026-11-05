"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import styles from "./AdminSidebar.module.css";
import { useAdminRides } from "@/hooks/useAdminRides";

export default function AdminSidebar() {
  const { actionRequiredCount, loading } = useAdminRides();
  const { data: session } = useSession();
  const pathname = usePathname();

  const [directoryOpen, setDirectoryOpen] = useState(true);
  const [configOpen, setConfigOpen] = useState(true);

  const userType = session?.user?.activeType;
  const isSuperAdmin = userType === "SuperAdmin";
  const userId = session?.user?.userId;
  const fullName =
    [session?.user?.firstName, session?.user?.lastName]
      .filter(Boolean)
      .join(" ") || "User";
  const avatarLetter = fullName.charAt(0).toUpperCase();

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  return (
    <aside className={styles.sidebar}>
      <div className={styles.top}>
        <h3 className={styles.brand}>GT Paratransit</h3>

        <nav className={styles.nav}>
          {/* Rides */}
          <Link
            href="/admin/rides"
            className={`${styles.navItem} ${isActive("/admin/rides") ? styles.active : ""}`}
          >
            <Image src="/car.svg" alt="" width={20} height={16} />
            <span>Rides</span>
            {!loading && actionRequiredCount > 0 && (
              <span
                className={styles.notificationBadge}
                aria-label={`${actionRequiredCount} rides require action`}
              >
                {actionRequiredCount}
              </span>
            )}
          </Link>

          {/* Shifts */}
          <Link
            href="/admin/shifts"
            className={`${styles.navItem} ${pathname.startsWith("/admin/shifts") ? styles.active : ""}`}
          >
            <Image src="/clock.svg" alt="" width={20} height={20} />
            <span>Shifts</span>
          </Link>

          {/* Auto-Schedule */}
          <Link
            href="/admin/auto-schedule"
            className={`${styles.navItem} ${pathname.startsWith("/admin/auto-schedule") ? styles.active : ""}`}
          >
            <Image src="/calendar.svg" alt="" width={20} height={20} />
            <span>Auto-Schedule</span>
          </Link>

          <Link
            href="/admin/audit-log"
            className={`${styles.navItem} ${pathname.startsWith("/admin/audit-log") ? styles.active : ""}`}
          >
            <Image src="/archive.svg" alt="" width={20} height={20} />
            <span>Audit Log</span>
          </Link>

          {/* Directory */}
          <div>
            <button
              className={styles.navGroup}
              onClick={() => setDirectoryOpen((o) => !o)}
            >
              <Image src="/folder.svg" alt="" width={20} height={20} />
              <span>Directory</span>
              <span
                className={`${styles.chevron} ${directoryOpen ? styles.chevronUp : styles.chevronDown}`}
              />
            </button>
            {directoryOpen && (
              <div className={styles.subItems}>
                {(["Students", "Drivers", "Vehicles"] as const).map((tab) => (
                  <Link
                    key={tab}
                    href={`/admin/directory/${tab.toLowerCase()}`}
                    className={`${styles.subItem} ${isActive(`/admin/directory/${tab.toLowerCase()}`) ? styles.active : ""}`}
                  >
                    {tab}
                  </Link>
                ))}
                {isSuperAdmin && (
                  <Link
                    href="/admin/directory/admins"
                    className={`${styles.subItem} ${isActive("/admin/directory/admins") ? styles.active : ""}`}
                  >
                    Admins
                  </Link>
                )}
              </div>
            )}
          </div>

          {/* Configurations */}
          <div>
            <button
              className={styles.navGroup}
              onClick={() => setConfigOpen((o) => !o)}
            >
              <Image src="/settings.svg" alt="" width={20} height={20} />
              <span>Configurations</span>
              <span
                className={`${styles.chevron} ${configOpen ? styles.chevronUp : styles.chevronDown}`}
              />
            </button>
            {configOpen && (
              <div className={styles.subItems}>
                <Link
                  href="/admin/configurations/locations"
                  className={`${styles.subItem} ${isActive("/admin/configurations/locations") ? styles.active : ""}`}
                >
                  Locations
                </Link>
                <Link
                  href="/admin/configurations/accommodations"
                  className={`${styles.subItem} ${isActive("/admin/configurations/accommodations") ? styles.active : ""}`}
                >
                  Accommodations
                </Link>
              </div>
            )}
          </div>
        </nav>
      </div>

      <div className={styles.bottom}>
        <Link href={`/profile/${userId}`} className={styles.userCard}>
          <div className={styles.avatar}>{avatarLetter}</div>
          <div className={styles.userInfo}>
            <div className={styles.userName}>{fullName}</div>
            <div className={styles.userRole}>{userType}</div>
          </div>
        </Link>
      </div>
    </aside>
  );
}

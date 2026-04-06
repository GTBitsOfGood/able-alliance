"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSearchParams, usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import styles from "./AdminSidebar.module.css";

type AdminTableType =
  | "Students"
  | "Drivers"
  | "Vehicles"
  | "Locations"
  | "Accommodations"
  | "Admins"
  | "Rides";

function AdminSidebarContent() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const [directoryOpen, setDirectoryOpen] = useState(true);
  const [configOpen, setConfigOpen] = useState(true);

  const userType = session?.user?.type;
  const isSuperAdmin = userType === "SuperAdmin";
  const userId = session?.user?.userId;
  const fullName =
    [session?.user?.firstName, session?.user?.lastName]
      .filter(Boolean)
      .join(" ") || "User";
  const avatarLetter = fullName.charAt(0).toUpperCase();

  const currentTab: AdminTableType | null =
    pathname === "/admin"
      ? (searchParams.get("tab") as AdminTableType) || "Students"
      : null;

  const isActive = (tab: AdminTableType) => currentTab === tab;

  return (
    <aside className={styles.sidebar}>
      <div className={styles.top}>
        <h3 className={styles.brand}>GT Paratransit</h3>

        <nav className={styles.nav}>
          {/* Rides */}
          <Link
            href="/admin?tab=Rides"
            className={`${styles.navItem} ${isActive("Rides") ? styles.active : ""}`}
          >
            <Image src="/car.svg" alt="" width={20} height={16} />
            <span>Rides</span>
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
                {(["Students", "Drivers", "Vehicles"] as AdminTableType[]).map(
                  (tab) => (
                    <Link
                      key={tab}
                      href={`/admin?tab=${tab}`}
                      className={`${styles.subItem} ${isActive(tab) ? styles.active : ""}`}
                    >
                      {tab}
                    </Link>
                  ),
                )}
                {isSuperAdmin && (
                  <Link
                    href="/admin?tab=Admins"
                    className={`${styles.subItem} ${isActive("Admins") ? styles.active : ""}`}
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
                  href="/admin?tab=Locations"
                  className={`${styles.subItem} ${isActive("Locations") ? styles.active : ""}`}
                >
                  Locations
                </Link>
                <Link
                  href="/admin?tab=Accommodations"
                  className={`${styles.subItem} ${isActive("Accommodations") ? styles.active : ""}`}
                >
                  Accommodations
                </Link>
              </div>
            )}
          </div>
        </nav>
      </div>

      <div className={styles.bottom}>
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a href="/api/auth/cas/logout" className={styles.logoutBtn}>
          Logout
        </a>
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

export default function AdminSidebar() {
  return (
    <Suspense fallback={<aside className={styles.sidebar} />}>
      <AdminSidebarContent />
    </Suspense>
  );
}

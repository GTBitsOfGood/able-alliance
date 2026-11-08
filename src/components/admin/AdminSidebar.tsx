"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import styles from "./AdminSidebar.module.css";
import { useAdminRides } from "@/hooks/useAdminRides";
import BogIcon from "@/components/BogIcon/BogIcon";
import { MenuCloseIcon, MenuHamburgerIcon } from "@/components/AppNavbar.icons";

export default function AdminSidebar() {
  const { actionRequiredCount, loading } = useAdminRides();
  const { data: session } = useSession();
  const pathname = usePathname();

  const [directoryOpen, setDirectoryOpen] = useState(true);
  const [configOpen, setConfigOpen] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuOpenedForPathname, setMenuOpenedForPathname] = useState(pathname);
  if (pathname !== menuOpenedForPathname) {
    setMenuOpenedForPathname(pathname);
    if (menuOpen) setMenuOpen(false);
  }

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
    <aside
      className={`${styles.sidebar} ${menuOpen ? styles.mobileMenuOpen : ""}`}
    >
      <div className={styles.mobileHeader}>
        <h3 className={styles.mobileBrand}>GT Paratransit</h3>
        <Link
          href={`/profile/${userId}`}
          className={styles.mobileProfile}
          aria-label={`Profile: ${fullName}`}
        >
          <span className={styles.avatar} aria-hidden="true">
            {avatarLetter}
          </span>
        </Link>
        <button
          type="button"
          className={styles.mobileToggle}
          onClick={() => setMenuOpen((open) => !open)}
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
          aria-controls="admin-mobile-navigation"
        >
          {menuOpen ? (
            <MenuCloseIcon className={styles.menuIcon} />
          ) : (
            <MenuHamburgerIcon className={styles.menuIcon} />
          )}
        </button>
      </div>
      <div className={styles.top}>
        <h3 className={styles.brand}>GT Paratransit</h3>

        <nav
          className={styles.nav}
          id="admin-mobile-navigation"
          aria-label="Admin navigation"
        >
          {/* Rides */}
          <Link
            href="/admin/rides"
            className={`${styles.navItem} ${isActive("/admin/rides") ? styles.active : ""}`}
            aria-label="Rides"
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

          <Link
            href="/admin/chats"
            className={`${styles.navItem} ${isActive("/admin/chats") ? styles.active : ""}`}
            aria-current={isActive("/admin/chats") ? "page" : undefined}
            aria-label="Chats"
          >
            <BogIcon name="chats" size={20} weight="regular" />
            <span>Chats</span>
          </Link>

          {/* Shifts */}
          <Link
            href="/admin/shifts"
            className={`${styles.navItem} ${pathname.startsWith("/admin/shifts") ? styles.active : ""}`}
            aria-label="Shifts"
          >
            <Image src="/clock.svg" alt="" width={20} height={20} />
            <span>Shifts</span>
          </Link>

          {/* Auto-Schedule */}
          <Link
            href="/admin/auto-schedule"
            className={`${styles.navItem} ${pathname.startsWith("/admin/auto-schedule") ? styles.active : ""}`}
            aria-label="Auto-Schedule"
          >
            <Image src="/calendar.svg" alt="" width={20} height={20} />
            <span>Auto-Schedule</span>
          </Link>

          <Link
            href="/admin/audit-log"
            className={`${styles.navItem} ${pathname.startsWith("/admin/audit-log") ? styles.active : ""}`}
            aria-label="Audit Log"
          >
            <Image src="/archive.svg" alt="" width={20} height={20} />
            <span>Audit Log</span>
          </Link>

          {/* Directory */}
          <div>
            <button
              className={styles.navGroup}
              onClick={() => setDirectoryOpen((o) => !o)}
              aria-label="Directory"
              aria-expanded={directoryOpen}
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
              aria-label="Configurations"
              aria-expanded={configOpen}
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

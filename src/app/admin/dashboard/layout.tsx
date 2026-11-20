import type { ReactNode } from "react";

import DashboardNavigation from "@/components/admin/DashboardNavigation";
import styles from "@/components/admin/dashboard.module.css";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className="text-heading-1">Dashboard</h1>
      </header>
      <DashboardNavigation />
      {children}
    </div>
  );
}

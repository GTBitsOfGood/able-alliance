import type { ReactNode } from "react";

import BogButton from "@/components/BogButton/BogButton";

import styles from "./dashboard.module.css";

export default function DashboardReportState({
  loading,
  error,
  refreshError,
  refreshRoutes,
  children,
}: {
  loading: boolean;
  error: string | null;
  refreshError: string | null;
  refreshRoutes: () => void;
  children: ReactNode;
}) {
  if (loading) {
    return (
      <div className={`${styles.panel} ${styles.empty}`} role="status">
        Loading ride statistics…
      </div>
    );
  }

  if (error) {
    return (
      <div className={`${styles.panel} ${styles.empty}`}>
        <p role="alert">Unable to load ride statistics.</p>
        <BogButton
          type="button"
          variant="secondary"
          size="small"
          onClick={refreshRoutes}
        >
          Try again
        </BogButton>
      </div>
    );
  }

  return (
    <>
      {refreshError && (
        <p role="status" className={styles.refreshNotice}>
          {refreshError}
        </p>
      )}
      {children}
    </>
  );
}

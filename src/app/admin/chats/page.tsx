"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import BogTable, {
  type ColumnHeaderCellContent,
  type TableRow,
} from "@/components/BogTable/BogTable";
import AdminChatView from "@/app/admin/AdminChatView";
import { routeStatusLabels } from "@/utils/route-status";
import type { AdminRouteResponse } from "@/utils/types/api";
import styles from "./styles.module.css";

type ChatUser = {
  id: string;
  firstName: string;
  lastName: string;
};

type ChatEntry = {
  id: string;
  student: ChatUser;
  driver: ChatUser | null;
  scheduledPickupTime: string;
  status: string;
};

const COLUMNS: ColumnHeaderCellContent[] = [
  { content: "Student", datatype: "string" },
  { content: "Driver", datatype: "string" },
  { content: "Ride time", datatype: "string" },
  { content: "Status", datatype: "string" },
  { content: "Chat", datatype: "string" },
];

export default function AdminChatsPage() {
  const { data: session, status: sessionStatus } = useSession();
  const [routes, setRoutes] = useState<ChatEntry[]>([]);
  const [selectedRoute, setSelectedRoute] = useState<ChatEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isAuthorized =
    session?.user?.type === "Admin" || session?.user?.type === "SuperAdmin";

  useEffect(() => {
    if (sessionStatus !== "authenticated") return;
    if (session.user.type !== "Admin" && session.user.type !== "SuperAdmin")
      return;

    const loadRoutes = async () => {
      try {
        const response = await fetch("/api/routes");
        if (!response.ok) throw new Error("Unable to load chats.");
        const data = await response.json();
        setRoutes(
          Array.isArray(data)
            ? (data as AdminRouteResponse[])
                .map((route) => ({
                  id: route.id,
                  student: route.student,
                  driver: route.driver,
                  scheduledPickupTime: route.scheduledPickupTime,
                  status: route.status,
                }))
                .sort(
                  (a, b) =>
                    new Date(b.scheduledPickupTime).getTime() -
                    new Date(a.scheduledPickupTime).getTime(),
                )
            : [],
        );
      } catch (caught) {
        setError(
          caught instanceof Error ? caught.message : "Unable to load chats.",
        );
      } finally {
        setLoading(false);
      }
    };

    void loadRoutes();
  }, [session, sessionStatus]);

  if (sessionStatus === "loading") {
    return <main className="p-6 text-gray-600">Loading chats...</main>;
  }

  if (!isAuthorized) {
    return (
      <main className={styles.page}>
        <h1 className={styles.title}>Chats</h1>
        <p className={styles.error} role="alert">
          You do not have access to chats.
        </p>
      </main>
    );
  }

  const rows: TableRow[] = routes.map((route) => ({
    styleProps: { id: `chat-${route.id}` },
    cells: [
      { content: `${route.student.firstName} ${route.student.lastName}` },
      {
        content: route.driver
          ? `${route.driver.firstName} ${route.driver.lastName}`
          : "—",
      },
      { content: new Date(route.scheduledPickupTime).toLocaleString() },
      {
        content:
          routeStatusLabels[route.status as keyof typeof routeStatusLabels] ??
          route.status,
      },
      { content: <span className={styles.viewChat}>View chat</span> },
    ],
  }));

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>Chats</h1>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      {!error && (
        <div className={styles.tableWrap}>
          {loading ? (
            <p className={styles.empty}>Loading chats...</p>
          ) : routes.length === 0 ? (
            <p className={styles.empty}>No chats found.</p>
          ) : (
            <BogTable
              columnHeaders={COLUMNS}
              rows={rows}
              onRowClick={(_, rowElement) => {
                const routeId = rowElement.id.replace(/^chat-/, "");
                setSelectedRoute(
                  routes.find((route) => route.id === routeId) ?? null,
                );
              }}
            />
          )}
        </div>
      )}

      {selectedRoute && (
        <div className={styles.drawerLayer}>
          <button
            type="button"
            className={styles.drawerBackdrop}
            aria-label="Close chat"
            onClick={() => setSelectedRoute(null)}
          />
          <aside className={styles.drawer} aria-label="Chat transcript">
            <AdminChatView
              routeId={selectedRoute.id}
              rideLabel={[
                `${selectedRoute.student.firstName} ${selectedRoute.student.lastName}`,
                selectedRoute.driver
                  ? `Driver: ${selectedRoute.driver.firstName} ${selectedRoute.driver.lastName}`
                  : null,
              ]
                .filter(Boolean)
                .join(" · ")}
              routeStatus={selectedRoute.status}
              studentId={selectedRoute.student.id}
              driverId={selectedRoute.driver?.id ?? null}
              onClose={() => setSelectedRoute(null)}
            />
          </aside>
        </div>
      )}
    </main>
  );
}

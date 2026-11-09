"use client";

import type { ReactNode } from "react";
import { AdminRidesContext, useAdminRidesData } from "@/hooks/useAdminRides";

/** One live data source keeps the ride list and navigation badge in sync. */
export default function AdminRidesProvider({
  children,
}: {
  children: ReactNode;
}) {
  const rides = useAdminRidesData();
  return (
    <AdminRidesContext.Provider value={rides}>
      {children}
    </AdminRidesContext.Provider>
  );
}
